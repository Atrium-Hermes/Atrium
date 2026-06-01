#!/usr/bin/env node
// Side-effect import: loads ~/.atrium/.env BEFORE any module that reads env at
// eval time (e.g. shared/schema.ts NETWORKS). Must stay the first import.
import "./env.js";
import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { publishCommand } from "./commands/publish.js";
import {
  listCommand,
  infoCommand,
  invokeCommand,
  fetchCommand,
  withdrawCommand,
  balanceCommand,
} from "./commands/registry.js";
import { benchmarkCommand, attestCommand } from "./commands/benchmark.js";

const program = new Command();

program
  .name("atrium")
  .description("Atrium — Skill provenance & royalty marketplace for AI agents")
  .version("0.1.0");

// ─── init ───
program
  .command("init")
  .description("Generate DID identity + wallet")
  .option("--force", "Overwrite existing identity")
  .option("--import-private-key <key>", "Import existing wallet private key (0x...)")
  .action(initCommand);

// ─── publish ───
program
  .command("publish <skill-path>")
  .description("Sign, upload to IPFS, register skill on-chain")
  .option("-n, --network <name>", "Network: base-sepolia | base", "base-sepolia")
  .option("--dry-run", "Validate + show what would happen, no chain tx")
  .option("--skip-benchmark", "Publish without benchmark.json")
  .option("--encrypt", "Encrypt the body; key released only to paying callers (key-service)")
  .action(publishCommand);

// ─── list ───
program
  .command("list")
  .description("List skills on the registry")
  .option("-n, --network <name>", "Network", "base-sepolia")
  .option("--mine", "Only show skills authored by me")
  .action(listCommand);

// ─── info ───
program
  .command("info <skill-id>")
  .description("Show detailed info about a skill")
  .option("-n, --network <name>", "Network", "base-sepolia")
  .action(infoCommand);

// ─── invoke ───
program
  .command("invoke <skill-id>")
  .description("Pay to invoke a skill (USDC + auto-split to creator + parents)")
  .option("-n, --network <name>", "Network", "base-sepolia")
  .action(invokeCommand);

// ─── fetch ───
program
  .command("fetch <skill-id>")
  .description("Fetch skill body from IPFS (does NOT pay creator)")
  .option("-n, --network <name>", "Network", "base-sepolia")
  .action(fetchCommand);

// ─── benchmark ───
program
  .command("benchmark <skill-id>")
  .description("Run skill's benchmark suite locally and compute success rate")
  .option("-n, --network <name>", "Network", "base-sepolia")
  .option("-o, --output <file>", "Write detailed result JSON to file")
  .action(benchmarkCommand);

// ─── attest ───
program
  .command("attest <skill-id>")
  .description("Post benchmark attestation on-chain")
  .requiredOption("--merkle-root <root>", "Merkle root from `atrium benchmark`")
  .requiredOption("--success-rate <bps>", "Success rate in basis points (0-10000)", (v) => parseInt(v, 10))
  .requiredOption("--sample-count <n>", "Number of test cases", (v) => parseInt(v, 10))
  .option("-n, --network <name>", "Network", "base-sepolia")
  .action(attestCommand);

// ─── withdraw ───
program
  .command("withdraw")
  .description("Claim accumulated USDC earnings")
  .option("-n, --network <name>", "Network", "base-sepolia")
  .action(withdrawCommand);

// ─── balance ───
program
  .command("balance")
  .description("Show USDC balance + withdrawable")
  .option("-n, --network <name>", "Network", "base-sepolia")
  .action(balanceCommand);

program.parseAsync().catch((err) => {
  console.error(`\n✗ ${err.message}`);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
