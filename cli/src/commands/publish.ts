import chalk from "chalk";
import ora from "ora";
import { loadIdentity, sign, canonicalSkillHash, didHash } from "../lib/did.js";
import { getIpfsClient } from "../lib/ipfs.js";
import { getChainContext, REGISTRY_ABI } from "../lib/chain.js";
import { parseSkill, serializeSkill, formatSkill } from "../lib/skill.js";
import { parseUsdc, type NetworkName } from "../../../shared/schema.js";
import { newContentKey, encryptBody, wrapEncryptedBody } from "../../../shared/crypto.js";
import type { Hex } from "viem";

const KEY_SERVICE = process.env.ATRIUM_KEY_SERVICE || "http://localhost:3002";

interface PublishOptions {
  network?: NetworkName;
  dryRun?: boolean;
  skipBenchmark?: boolean;
  encrypt?: boolean;
}

export async function publishCommand(skillPath: string, opts: PublishOptions): Promise<void> {
  const spinner = ora();
  const network = opts.network ?? (process.env.ATRIUM_NETWORK as NetworkName) ?? "base-sepolia";

  // 1. Load identity
  const identity = loadIdentity();
  console.log(chalk.gray(`\nAuthor: ${identity.did}`));
  console.log(chalk.gray(`Wallet: ${identity.walletAddress}`));
  console.log(chalk.gray(`Network: ${network}\n`));

  // 2. Parse and validate skill
  spinner.start("Parsing skill manifest");
  const skill = parseSkill(skillPath);

  // Ensure manifest's DID matches local identity
  if (skill.manifest.author_did !== identity.did) {
    spinner.warn(`Manifest DID (${skill.manifest.author_did}) differs from local (${identity.did}). Updating manifest.`);
    skill.manifest.author_did = identity.did;
  }
  spinner.succeed(`Parsed: ${skill.manifest.name} v${skill.manifest.version}`);

  console.log("\n" + formatSkill(skill.manifest) + "\n");

  // 2b. Optionally encrypt the body before pinning. Only ciphertext goes to IPFS;
  // the content key is registered with the key-service (released to paying callers).
  let contentKeyHex: string | undefined;
  if (opts.encrypt) {
    const key = newContentKey();
    contentKeyHex = key.toString("hex");
    const encMd = serializeSkill(skill.manifest, "\n" + wrapEncryptedBody(encryptBody(skill.body, key)));
    const buf = Buffer.from(encMd, "utf-8");
    const idx = skill.files.findIndex((f) => f.path === "skill.md" || f.path.endsWith("/skill.md"));
    if (idx >= 0) skill.files[idx] = { path: skill.files[idx].path, content: buf };
    else skill.files.push({ path: "skill.md", content: buf });
    spinner.info("Body encrypted (AES-256-GCM) — only ciphertext is pinned to IPFS");
  }

  // 3. Upload to IPFS
  let bodyCid: string;
  if (opts.dryRun) {
    bodyCid = "bafkreih_dryrun_placeholder_0000000000000000000000000000000";
    spinner.info("Dry run: skipping IPFS upload");
  } else {
    spinner.start("Uploading to IPFS via Pinata");
    const ipfs = getIpfsClient();
    bodyCid = await ipfs.pinDirectory(skill.files);
    spinner.succeed(`Pinned to IPFS: ${chalk.cyan(bodyCid)}`);
  }

  // 4. Compute canonical hash + sign
  spinner.start("Signing manifest");
  const priceWei = parseUsdc(skill.manifest.price_per_call_usdc);
  const parentSkillIds = skill.manifest.parent_skills.map((p) => p.skill_id);
  const parentBps = skill.manifest.parent_skills.map((p) => p.royalty_bps);

  const hash = canonicalSkillHash({
    name: skill.manifest.name,
    version: skill.manifest.version,
    did: identity.did,
    bodyCid,
    pricePerCall: priceWei,
    parentSkills: parentSkillIds,
    parentBps,
  });
  const signature = sign(hash, identity.privateKey);
  skill.manifest.author_signature = signature;
  spinner.succeed("Signed with Ed25519");

  // 5. Register on-chain
  if (opts.dryRun) {
    console.log(chalk.gray("\nDry run: skipping on-chain registration"));
    console.log(chalk.gray(`Would register: ${bodyCid}`));
    console.log(chalk.gray(`Would price:    ${skill.manifest.price_per_call_usdc} USDC/call`));
    console.log(chalk.gray(`Would split:    ${parentBps.reduce((s, b) => s + b, 0) / 100}% to ${parentBps.length} parents`));
    return;
  }

  const ctx = getChainContext(network);
  if (!ctx.walletClient || !ctx.account) {
    throw new Error("ATRIUM_PRIVATE_KEY not set in ~/.atrium/.env");
  }

  spinner.start("Predicting skillId");
  const predictedSkillId = (await ctx.publicClient.readContract({
    address: ctx.registry,
    abi: REGISTRY_ABI,
    functionName: "computeSkillId",
    args: [bodyCid, didHash(identity.did), ctx.account],
  })) as Hex;
  spinner.succeed(`SkillId: ${chalk.cyan(predictedSkillId)}`);

  spinner.start("Registering on-chain");
  const txHash = await ctx.walletClient.writeContract({
    address: ctx.registry,
    abi: REGISTRY_ABI,
    functionName: "registerSkill",
    args: [
      bodyCid,
      didHash(identity.did),
      priceWei,
      parentSkillIds as Hex[],
      parentBps,
    ],
    chain: ctx.publicClient.chain!,
    account: ctx.walletAccount!,
  });

  spinner.text = `Waiting for confirmation... ${chalk.gray(txHash)}`;
  const receipt = await ctx.publicClient.waitForTransactionReceipt({ hash: txHash });

  if (receipt.status === "reverted") {
    spinner.fail("Transaction reverted");
    process.exit(1);
  }

  spinner.succeed(`Registered on-chain in block ${receipt.blockNumber}`);

  // 5b. If encrypted, register the content key with the key-service (creator-signed).
  if (opts.encrypt && contentKeyHex) {
    spinner.start("Registering decryption key with key-service");
    const signature = await ctx.walletAccount!.signMessage({ message: `atrium-key:${predictedSkillId}` });
    // The just-registered skill may not be visible on the RPC read-replica yet
    // (public Base Sepolia lags), so retry until the key-service sees the creator.
    let registered = false;
    let lastErr = "";
    for (let attempt = 1; attempt <= 8 && !registered; attempt++) {
      try {
        const res = await fetch(`${KEY_SERVICE}/keys/${predictedSkillId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyHex: contentKeyHex, signature }),
        });
        if (res.ok) {
          registered = true;
          break;
        }
        lastErr = `${res.status} ${await res.text()}`;
      } catch (e) {
        lastErr = (e as Error).message;
      }
      spinner.text = `Registering decryption key (attempt ${attempt}, RPC catching up)…`;
      await new Promise((r) => setTimeout(r, 4000));
    }
    if (registered) spinner.succeed(`Key registered with key-service (${KEY_SERVICE})`);
    else {
      spinner.fail(`Key registration failed: ${lastErr}`);
      console.log(chalk.yellow(`  Body is encrypted but the key wasn't stored — the skill is undecryptable. Re-publish.`));
    }
  }

  // 6. Show result
  console.log();
  console.log(chalk.green.bold("◆ Published"));
  console.log(`  Skill ID:    ${chalk.cyan(predictedSkillId)}`);
  console.log(`  IPFS CID:    ${chalk.cyan(bodyCid)}`);
  console.log(`  Tx:          ${chalk.cyan(txHash)}`);
  console.log(`  Explorer:    https://sepolia.basescan.org/tx/${txHash}`);
  console.log();
  console.log(chalk.gray("Discover via MCP:"));
  console.log(chalk.gray(`  atrium-mcp://skill/${predictedSkillId}`));
  console.log();
}
