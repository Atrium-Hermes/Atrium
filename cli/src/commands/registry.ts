import chalk from "chalk";
import ora from "ora";
import { loadIdentity } from "../lib/did.js";
import { getChainContext, REGISTRY_ABI, USDC_ABI, ensureAllowance, getUsdcBalance } from "../lib/chain.js";
import { getIpfsClient } from "../lib/ipfs.js";
import { parseSkill } from "../lib/skill.js";
import { formatUsdc, parseUsdc, type NetworkName } from "../../../shared/schema.js";
import { isEncrypted, extractEnvelope, decryptBody } from "../../../shared/crypto.js";
import matter from "gray-matter";
import type { Hex, Address } from "viem";

// ─────────── atrium list ───────────

export async function listCommand(opts: { network?: NetworkName; mine?: boolean }): Promise<void> {
  const network = opts.network ?? (process.env.ATRIUM_NETWORK as NetworkName) ?? "base-sepolia";
  const ctx = getChainContext(network);
  const spinner = ora("Fetching skills").start();

  let skillIds: Hex[];
  if (opts.mine) {
    const identity = loadIdentity();
    skillIds = (await ctx.publicClient.readContract({
      address: ctx.registry,
      abi: REGISTRY_ABI,
      functionName: "getSkillsByCreator",
      args: [identity.walletAddress as Address],
    })) as Hex[];
  } else {
    skillIds = (await ctx.publicClient.readContract({
      address: ctx.registry,
      abi: REGISTRY_ABI,
      functionName: "listSkills",
      args: [0n, 50n],
    })) as Hex[];
  }

  spinner.succeed(`Found ${skillIds.length} skill(s)`);

  if (skillIds.length === 0) {
    console.log(chalk.gray("\nNo skills yet. Try `atrium publish examples/skills/hello-world`"));
    return;
  }

  console.log();
  for (const id of skillIds) {
    const s = (await ctx.publicClient.readContract({
      address: ctx.registry,
      abi: REGISTRY_ABI,
      functionName: "skills",
      args: [id],
    })) as [string, Address, Hex, bigint, bigint, bigint, bigint, bigint, boolean];

    const [cid, creator, , price, createdAt, , totalInvocations, totalEarned, active] = s;

    if (!active && !opts.mine) continue;

    console.log(`${chalk.cyan(id.slice(0, 10))}…${chalk.gray(id.slice(-6))} ${active ? "" : chalk.gray("[inactive]")}`);
    console.log(`  ${chalk.gray("creator:")}     ${creator}`);
    console.log(`  ${chalk.gray("price:")}       ${formatUsdc(price)} USDC/call`);
    console.log(`  ${chalk.gray("invocations:")} ${totalInvocations.toString()}`);
    console.log(`  ${chalk.gray("earned:")}      ${formatUsdc(totalEarned)} USDC`);
    console.log(`  ${chalk.gray("cid:")}         ${cid}`);
    console.log(`  ${chalk.gray("created:")}     ${new Date(Number(createdAt) * 1000).toISOString()}`);
    console.log();
  }
}

// ─────────── atrium info ───────────

export async function infoCommand(skillId: string, opts: { network?: NetworkName }): Promise<void> {
  const network = opts.network ?? (process.env.ATRIUM_NETWORK as NetworkName) ?? "base-sepolia";
  const ctx = getChainContext(network);

  const spinner = ora("Loading skill").start();

  const s = (await ctx.publicClient.readContract({
    address: ctx.registry,
    abi: REGISTRY_ABI,
    functionName: "skills",
    args: [skillId as Hex],
  })) as [string, Address, Hex, bigint, bigint, bigint, bigint, bigint, boolean];

  const [cid, creator, didHashOnChain, price, createdAt, lastInvoked, totalInvocations, totalEarned, active] = s;

  if (!creator || creator === "0x0000000000000000000000000000000000000000") {
    spinner.fail("Skill not found");
    return;
  }

  // Fetch attestation
  const att = (await ctx.publicClient.readContract({
    address: ctx.registry,
    abi: REGISTRY_ABI,
    functionName: "attestations",
    args: [skillId as Hex],
  })) as [Hex, number, bigint, Address, bigint];

  // Fetch IPFS body
  spinner.text = "Fetching manifest from IPFS";
  let manifest: any = null;
  try {
    const ipfs = getIpfsClient();
    const body = await ipfs.fetch(cid, "skill.md");
    const parsed = matter(body);
    manifest = parsed.data;
  } catch (err) {
    spinner.warn("Could not fetch IPFS body — showing on-chain data only");
  }
  spinner.stop();

  console.log();
  console.log(chalk.bold(manifest?.name ?? skillId));
  if (manifest) {
    console.log(chalk.gray(manifest.description));
    console.log(`  tags:        ${manifest.tags?.join(", ")}`);
    console.log(`  runtime:     ${manifest.runtime}`);
  }
  console.log();
  console.log(chalk.bold("On-chain"));
  console.log(`  Skill ID:    ${chalk.cyan(skillId)}`);
  console.log(`  Creator:     ${creator}`);
  console.log(`  DID hash:    ${didHashOnChain}`);
  console.log(`  Price:       ${formatUsdc(price)} USDC`);
  console.log(`  Invocations: ${totalInvocations.toString()}`);
  console.log(`  Total earned: ${formatUsdc(totalEarned)} USDC`);
  console.log(`  Active:      ${active ? chalk.green("yes") : chalk.red("no")}`);
  console.log(`  Created:     ${new Date(Number(createdAt) * 1000).toISOString()}`);
  if (lastInvoked > 0n) {
    console.log(`  Last call:   ${new Date(Number(lastInvoked) * 1000).toISOString()}`);
  }

  if (att[3] !== "0x0000000000000000000000000000000000000000") {
    console.log();
    console.log(chalk.bold("Attestation"));
    console.log(`  Success rate: ${(att[1] / 100).toFixed(2)}%`);
    console.log(`  Samples:      ${att[4].toString()}`);
    console.log(`  Attester:     ${att[3]}`);
    console.log(`  Attested at:  ${new Date(Number(att[2]) * 1000).toISOString()}`);
  } else {
    console.log();
    console.log(chalk.yellow("⚠ No benchmark attestation yet"));
  }

  console.log();
  console.log(chalk.gray(`IPFS: https://gateway.pinata.cloud/ipfs/${cid}`));
}

// ─────────── atrium invoke ───────────

export async function invokeCommand(skillId: string, opts: { network?: NetworkName }): Promise<void> {
  const network = opts.network ?? (process.env.ATRIUM_NETWORK as NetworkName) ?? "base-sepolia";
  const ctx = getChainContext(network);
  if (!ctx.walletClient || !ctx.account) {
    throw new Error("ATRIUM_PRIVATE_KEY not set");
  }

  const spinner = ora("Loading skill").start();
  const s = (await ctx.publicClient.readContract({
    address: ctx.registry,
    abi: REGISTRY_ABI,
    functionName: "skills",
    args: [skillId as Hex],
  })) as [string, Address, Hex, bigint, bigint, bigint, bigint, bigint, boolean];

  const [cid, creator, , price, , , , , active] = s;
  if (!active) {
    spinner.fail("Skill inactive");
    return;
  }

  spinner.succeed(`Skill ${skillId.slice(0, 10)}… price ${formatUsdc(price)} USDC`);

  // Check balance
  const balance = await getUsdcBalance(ctx, ctx.account);
  if (balance < price) {
    console.log(chalk.red(`\nInsufficient USDC: have ${formatUsdc(balance)}, need ${formatUsdc(price)}`));
    console.log(chalk.gray("Get test USDC: https://faucet.circle.com"));
    return;
  }

  // Approve if needed
  spinner.start("Checking allowance");
  const { txHash: approveTx } = await ensureAllowance(ctx, price);
  if (approveTx) {
    spinner.succeed(`Approved USDC: ${approveTx}`);
  } else {
    spinner.succeed("Allowance sufficient");
  }

  // Invoke
  spinner.start("Invoking skill (escrow + split payout)");
  const txHash = await ctx.walletClient.writeContract({
    address: ctx.registry,
    abi: REGISTRY_ABI,
    functionName: "invokeSkill",
    args: [skillId as Hex],
    chain: ctx.publicClient.chain!,
    account: ctx.walletAccount!,
  });

  const receipt = await ctx.publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === "reverted") {
    spinner.fail("Reverted");
    return;
  }
  spinner.succeed(`Invoked in block ${receipt.blockNumber}`);

  console.log();
  console.log(chalk.green.bold("✓ Skill invoked"));
  console.log(`  Tx:          ${txHash}`);
  console.log(`  Paid:        ${formatUsdc(price)} USDC → ${creator}`);
  console.log(`  IPFS body:   ipfs://${cid}`);
  console.log();
  console.log(chalk.gray("To use the skill, fetch the body and load into your agent runtime."));
  console.log(chalk.gray(`  atrium fetch ${skillId} > skill.md`));
}

// ─────────── atrium fetch ───────────

export async function fetchCommand(skillId: string, opts: { network?: NetworkName }): Promise<void> {
  const network = opts.network ?? (process.env.ATRIUM_NETWORK as NetworkName) ?? "base-sepolia";
  const ctx = getChainContext(network);

  const s = (await ctx.publicClient.readContract({
    address: ctx.registry,
    abi: REGISTRY_ABI,
    functionName: "skills",
    args: [skillId as Hex],
  })) as [string, Address, Hex, bigint, bigint, bigint, bigint, bigint, boolean];

  const [cid] = s;
  const ipfs = getIpfsClient();
  const body = await ipfs.fetch(cid, "skill.md");

  if (!isEncrypted(body)) {
    process.stdout.write(body);
    return;
  }

  // Encrypted: claim the decryption key from the key-service. The service only
  // releases it if this wallet has an on-chain invocation (i.e. has paid).
  if (!ctx.walletAccount || !ctx.account) {
    throw new Error("Body is encrypted — set ATRIUM_PRIVATE_KEY to claim the decryption key.");
  }
  const env = extractEnvelope(body);
  if (!env) throw new Error("Encrypted marker present but the envelope is unreadable.");

  const keyService = process.env.ATRIUM_KEY_SERVICE || "http://localhost:3002";
  const address = ctx.account.toLowerCase();
  const signature = await ctx.walletAccount!.signMessage({ message: `atrium-grant:${skillId}:${address}` });
  const res = await fetch(`${keyService}/grant/${skillId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: ctx.account, signature }),
  });
  if (!res.ok) {
    throw new Error(`Key-service refused (${res.status}): ${await res.text()}. Did you invoke (pay for) this skill?`);
  }
  const { keyHex } = (await res.json()) as { keyHex: string };
  process.stdout.write(decryptBody(env, Buffer.from(keyHex, "hex")));
}

// ─────────── atrium withdraw ───────────

export async function withdrawCommand(opts: { network?: NetworkName }): Promise<void> {
  const network = opts.network ?? (process.env.ATRIUM_NETWORK as NetworkName) ?? "base-sepolia";
  const ctx = getChainContext(network);
  if (!ctx.walletClient || !ctx.account) throw new Error("ATRIUM_PRIVATE_KEY not set");

  const spinner = ora("Checking balance").start();
  const owed = (await ctx.publicClient.readContract({
    address: ctx.registry,
    abi: REGISTRY_ABI,
    functionName: "withdrawable",
    args: [ctx.account],
  })) as bigint;

  if (owed === 0n) {
    spinner.info("Nothing to withdraw");
    return;
  }
  spinner.succeed(`Withdrawable: ${formatUsdc(owed)} USDC`);

  spinner.start("Withdrawing");
  const txHash = await ctx.walletClient.writeContract({
    address: ctx.registry,
    abi: REGISTRY_ABI,
    functionName: "withdraw",
    chain: ctx.publicClient.chain!,
    account: ctx.walletAccount!,
  });
  await ctx.publicClient.waitForTransactionReceipt({ hash: txHash });
  spinner.succeed(`Withdrew ${formatUsdc(owed)} USDC: ${txHash}`);
}

// ─────────── atrium balance ───────────

export async function balanceCommand(opts: { network?: NetworkName }): Promise<void> {
  const network = opts.network ?? (process.env.ATRIUM_NETWORK as NetworkName) ?? "base-sepolia";
  const ctx = getChainContext(network);
  if (!ctx.account) throw new Error("ATRIUM_PRIVATE_KEY not set");

  const identity = loadIdentity();
  const balance = await getUsdcBalance(ctx, ctx.account);
  const owed = (await ctx.publicClient.readContract({
    address: ctx.registry,
    abi: REGISTRY_ABI,
    functionName: "withdrawable",
    args: [ctx.account],
  })) as bigint;

  console.log();
  console.log(chalk.bold("Atrium account"));
  console.log(`  DID:           ${chalk.cyan(identity.did)}`);
  console.log(`  Wallet:        ${chalk.cyan(ctx.account)}`);
  console.log(`  Network:       ${network}`);
  console.log();
  console.log(chalk.bold("USDC"));
  console.log(`  Balance:       ${formatUsdc(balance)} USDC`);
  console.log(`  Withdrawable:  ${formatUsdc(owed)} USDC ${owed > 0n ? chalk.green("(claim with `atrium withdraw`)") : ""}`);
  console.log();
}
