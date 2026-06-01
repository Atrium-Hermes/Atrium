import { ed25519 } from "@noble/curves/ed25519";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import { base58 } from "@scure/base";
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// did:key uses multicodec prefix 0xed01 for Ed25519
const ED25519_PUB_MULTICODEC = new Uint8Array([0xed, 0x01]);

export interface Identity {
  did: string;
  publicKey: string;       // hex
  privateKey: string;      // hex (sensitive)
  walletAddress: string;   // Tied to wallet for on-chain ops (separate)
}

const HOME_DIR = join(homedir(), ".atrium");
const KEY_FILE = join(HOME_DIR, "identity.json");

export function ensureHomeDir(): void {
  if (!existsSync(HOME_DIR)) {
    mkdirSync(HOME_DIR, { recursive: true });
    chmodSync(HOME_DIR, 0o700);
  }
}

export function generateIdentity(walletAddress: string): Identity {
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = ed25519.getPublicKey(privateKey);

  const prefixed = new Uint8Array(ED25519_PUB_MULTICODEC.length + publicKey.length);
  prefixed.set(ED25519_PUB_MULTICODEC, 0);
  prefixed.set(publicKey, ED25519_PUB_MULTICODEC.length);

  const did = `did:key:z${base58.encode(prefixed)}`;

  return {
    did,
    publicKey: bytesToHex(publicKey),
    privateKey: bytesToHex(privateKey),
    walletAddress,
  };
}

export function saveIdentity(identity: Identity): void {
  ensureHomeDir();
  writeFileSync(KEY_FILE, JSON.stringify(identity, null, 2), { mode: 0o600 });
}

export function loadIdentity(): Identity {
  if (!existsSync(KEY_FILE)) {
    throw new Error("No identity found. Run `atrium init` first.");
  }
  return JSON.parse(readFileSync(KEY_FILE, "utf-8"));
}

export function hasIdentity(): boolean {
  return existsSync(KEY_FILE);
}

/**
 * Sign a canonical hash with Ed25519 private key.
 * Returns hex-encoded signature with ed25519: prefix.
 */
export function sign(message: Uint8Array, privateKeyHex: string): string {
  const privKey = hexToBytes(privateKeyHex);
  const sig = ed25519.sign(message, privKey);
  return `ed25519:0x${bytesToHex(sig)}`;
}

export function verify(message: Uint8Array, signature: string, publicKeyHex: string): boolean {
  if (!signature.startsWith("ed25519:0x")) return false;
  const sigBytes = hexToBytes(signature.slice("ed25519:0x".length));
  const pubKey = hexToBytes(publicKeyHex);
  try {
    return ed25519.verify(sigBytes, message, pubKey);
  } catch {
    return false;
  }
}

/**
 * Compute canonical hash of a skill for signing.
 * Mirrors the spec in docs/SKILL_SPEC.md.
 */
export function canonicalSkillHash(args: {
  name: string;
  version: string;
  did: string;
  bodyCid: string;
  pricePerCall: bigint;
  parentSkills: string[];
  parentBps: number[];
}): Uint8Array {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [
    encoder.encode(args.name),
    encoder.encode(args.version),
    encoder.encode(args.did),
    encoder.encode(args.bodyCid),
    encoder.encode(args.pricePerCall.toString()),
  ];
  // Parent skills hash
  const parentBuf = encoder.encode(
    args.parentSkills.map((s, i) => `${s}:${args.parentBps[i]}`).join(",")
  );
  parts.push(parentBuf);

  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const concat = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    concat.set(p, offset);
    offset += p.length;
  }
  return sha256(concat);
}

export function didHash(did: string): `0x${string}` {
  const hash = sha256(new TextEncoder().encode(did));
  return `0x${bytesToHex(hash)}` as `0x${string}`;
}
