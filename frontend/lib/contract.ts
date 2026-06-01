import { parseAbi, sha256, toBytes, encodePacked, keccak256, type Address, type Hex } from "viem";

export const REGISTRY_ADDRESS = (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ||
  "0x0000000000000000000000000000000000000000") as Address;
export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ||
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e") as Address;
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "84532");

export const USDC_DECIMALS = 6;

export const REGISTRY_ABI = parseAbi([
  "function registerSkill(string cid, bytes32 didHash, uint256 pricePerCall, bytes32[] parentSkills, uint16[] parentBps) returns (bytes32 skillId)",
  "function invokeSkill(bytes32 skillId)",
  "function withdraw()",
  "function deactivateSkill(bytes32 skillId)",
  "function withdrawable(address) view returns (uint256)",
  "function getSkillsByCreator(address) view returns (bytes32[])",
  "function computeSkillId(string cid, bytes32 didHash, address creator) pure returns (bytes32)",
]);

export const USDC_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function faucet()", // MockUSDC testnet faucet: mints 1,000 mUSDC to caller
]);

// USDC has 6 decimals. "1.5" → 1500000n. Mirrors shared/schema.ts parseUsdc.
export function parseUsdc(amount: string): bigint {
  const [whole, frac = ""] = amount.split(".");
  const padded = (frac + "000000").slice(0, USDC_DECIMALS);
  return BigInt(whole || "0") * 10n ** BigInt(USDC_DECIMALS) + BigInt(padded || "0");
}

// didHash = sha256(utf8(did)) — MUST match cli/src/lib/did.ts didHash() exactly,
// or the on-chain skillId won't match what the CLI/indexer expect.
export function didHash(did: string): Hex {
  return sha256(toBytes(did));
}

// Predict skillId locally (matches AtriumRegistry.computeSkillId).
export function computeSkillId(cid: string, did: string, creator: Address): Hex {
  return keccak256(encodePacked(["string", "bytes32", "address"], [cid, didHash(did), creator]));
}
