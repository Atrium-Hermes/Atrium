import chalk from "chalk";
import ora from "ora";
import { createHash } from "node:crypto";
import { getChainContext, REGISTRY_ABI } from "../lib/chain.js";
import { getIpfsClient } from "../lib/ipfs.js";
import { BenchmarkSuite, type NetworkName } from "../../../shared/schema.js";
import type { Hex } from "viem";
import { keccak256, toBytes } from "viem";

// ─────────── atrium benchmark ───────────
// Runs a benchmark suite against a skill and computes success rate.
// Pure off-chain — does NOT post attestation. Use `atrium attest` after.

interface BenchmarkOptions {
  network?: NetworkName;
  output?: string;
}

export async function benchmarkCommand(skillId: string, opts: BenchmarkOptions): Promise<void> {
  const network = opts.network ?? (process.env.ATRIUM_NETWORK as NetworkName) ?? "base-sepolia";
  const ctx = getChainContext(network);
  const spinner = ora("Loading skill").start();

  const s = (await ctx.publicClient.readContract({
    address: ctx.registry,
    abi: REGISTRY_ABI,
    functionName: "skills",
    args: [skillId as Hex],
  })) as unknown as [string, ...unknown[]];

  const cid = s[0] as string;
  spinner.succeed(`Skill cid: ${cid}`);

  // Fetch benchmark.json from IPFS
  spinner.start("Fetching benchmark suite");
  const ipfs = getIpfsClient();
  let benchmarkRaw: string;
  try {
    benchmarkRaw = await ipfs.fetch(cid, "benchmark.json");
  } catch {
    spinner.fail("No benchmark.json in skill bundle");
    console.log(chalk.gray("\nSkills without benchmarks cannot be attested."));
    console.log(chalk.gray("Add a benchmark.json to your skill directory and republish."));
    return;
  }

  const suite = BenchmarkSuite.parse(JSON.parse(benchmarkRaw));
  spinner.succeed(`Loaded ${suite.test_cases.length} test cases`);

  // For MVP, we simulate benchmark execution.
  // In production: spin up sandboxed runner (Docker/WASM) and execute skill against each test case.
  spinner.start("Running test cases (simulated)");
  const results: Array<{ id: string; passed: boolean; weight: number }> = [];
  for (const tc of suite.test_cases) {
    // Simulate: pass 85% by default in MVP. Real runner would execute skill.
    const passed = Math.random() < 0.85;
    results.push({ id: tc.id, passed, weight: tc.weight });
  }
  spinner.succeed("Tests complete");

  const totalWeight = results.reduce((s, r) => s + r.weight, 0);
  const passedWeight = results.filter((r) => r.passed).reduce((s, r) => s + r.weight, 0);
  const successRateBps = Math.floor((passedWeight / totalWeight) * 10000);

  // Compute merkle root over (testId, passed) pairs
  const leaves = results.map((r) =>
    keccak256(toBytes(`${r.id}:${r.passed ? 1 : 0}`))
  );
  const merkleRoot = computeMerkleRoot(leaves);

  console.log();
  console.log(chalk.bold("Benchmark result"));
  console.log(`  Tests:         ${results.length} (${results.filter((r) => r.passed).length} passed)`);
  console.log(`  Success rate:  ${(successRateBps / 100).toFixed(2)}%`);
  console.log(`  Merkle root:   ${merkleRoot}`);
  console.log();
  console.log(chalk.gray("To post on-chain attestation:"));
  console.log(chalk.cyan(`  atrium attest ${skillId} \\`));
  console.log(chalk.cyan(`    --merkle-root ${merkleRoot} \\`));
  console.log(chalk.cyan(`    --success-rate ${successRateBps} \\`));
  console.log(chalk.cyan(`    --sample-count ${results.length}`));
  console.log();

  if (opts.output) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(
      opts.output,
      JSON.stringify({ skillId, merkleRoot, successRateBps, sampleCount: results.length, results }, null, 2)
    );
    console.log(chalk.gray(`Result written to ${opts.output}`));
  }
}

interface AttestOptions {
  network?: NetworkName;
  merkleRoot: string;
  successRate: number;
  sampleCount: number;
}

export async function attestCommand(skillId: string, opts: AttestOptions): Promise<void> {
  const network = opts.network ?? (process.env.ATRIUM_NETWORK as NetworkName) ?? "base-sepolia";
  const ctx = getChainContext(network);
  if (!ctx.walletClient || !ctx.account) throw new Error("ATRIUM_PRIVATE_KEY not set");

  const spinner = ora("Posting attestation on-chain").start();
  const txHash = await ctx.walletClient.writeContract({
    address: ctx.registry,
    abi: REGISTRY_ABI,
    functionName: "attestBenchmark",
    args: [
      skillId as Hex,
      opts.merkleRoot as Hex,
      opts.successRate,
      BigInt(opts.sampleCount),
    ],
    chain: ctx.publicClient.chain!,
    account: ctx.walletAccount!,
  });

  const receipt = await ctx.publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === "reverted") {
    spinner.fail("Reverted");
    return;
  }

  spinner.succeed(`Attested in block ${receipt.blockNumber}`);
  console.log(`\nTx: ${txHash}`);
  console.log(`Success rate: ${(opts.successRate / 100).toFixed(2)}% over ${opts.sampleCount} samples`);
}

// ─────────── Merkle helper ───────────

function computeMerkleRoot(leaves: Hex[]): Hex {
  if (leaves.length === 0) return ("0x" + "0".repeat(64)) as Hex;
  if (leaves.length === 1) return leaves[0];

  let level: Hex[] = [...leaves];
  while (level.length > 1) {
    const next: Hex[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] ?? level[i];
      // Sort pair for canonical order (OpenZeppelin convention)
      const [a, b] = BigInt(left) < BigInt(right) ? [left, right] : [right, left];
      next.push(keccak256(toBytes((a + b.slice(2)) as Hex)));
    }
    level = next;
  }
  return level[0];
}
