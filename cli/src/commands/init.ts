import chalk from "chalk";
import { generateIdentity, saveIdentity, hasIdentity, loadIdentity } from "../lib/did.js";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

interface InitOptions {
  force?: boolean;
  importPrivateKey?: string;
}

export async function initCommand(opts: InitOptions): Promise<void> {
  const homeDir = join(homedir(), ".atrium");
  const envPath = join(homeDir, ".env");

  if (hasIdentity() && !opts.force) {
    const existing = loadIdentity();
    console.log(chalk.yellow("\nIdentity already exists:"));
    console.log(`  DID: ${chalk.cyan(existing.did)}`);
    console.log(`  Wallet: ${chalk.cyan(existing.walletAddress)}`);
    console.log(chalk.gray("\nUse --force to regenerate (destroys existing keys)."));
    return;
  }

  // Generate or import wallet
  let privateKey: `0x${string}`;
  if (opts.importPrivateKey) {
    privateKey = opts.importPrivateKey as `0x${string}`;
    if (!privateKey.startsWith("0x") || privateKey.length !== 66) {
      throw new Error("Invalid private key format (expected 0x + 64 hex chars)");
    }
  } else {
    privateKey = generatePrivateKey();
  }

  const account = privateKeyToAccount(privateKey);

  // Generate Ed25519 DID keypair (separate from wallet)
  const identity = generateIdentity(account.address);
  saveIdentity(identity);

  // Save private key to .env (gitignored)
  const envContent = `# Atrium environment — DO NOT COMMIT
ATRIUM_PRIVATE_KEY=${privateKey}
ATRIUM_NETWORK=base-sepolia

# Optional: IPFS provider
# PINATA_JWT=eyJhbGc...

# Optional: deployed registry overrides
# ATRIUM_REGISTRY_SEPOLIA=0x...
# ATRIUM_REGISTRY_MAINNET=0x...
`;

  if (!existsSync(envPath) || opts.force) {
    writeFileSync(envPath, envContent, { mode: 0o600 });
  }

  console.log(chalk.green("\n✓ Atrium identity created\n"));
  console.log(`  ${chalk.bold("DID:")}     ${chalk.cyan(identity.did)}`);
  console.log(`  ${chalk.bold("Wallet:")}  ${chalk.cyan(identity.walletAddress)}`);
  console.log(`  ${chalk.bold("Keys:")}    ${chalk.gray(join(homedir(), ".atrium"))}`);
  console.log();
  console.log(chalk.bold("Next steps:"));
  console.log("  1. Fund your wallet with Base Sepolia ETH for gas");
  console.log(`     ${chalk.gray("Faucet: https://www.alchemy.com/faucets/base-sepolia")}`);
  console.log("  2. Get Base Sepolia USDC for testing");
  console.log(`     ${chalk.gray("Faucet: https://faucet.circle.com")}`);
  console.log("  3. Set PINATA_JWT in ~/.atrium/.env (https://pinata.cloud)");
  console.log("  4. Try " + chalk.cyan("atrium publish <skill-dir>"));
  console.log();
}
