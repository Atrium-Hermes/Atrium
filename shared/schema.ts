import { z } from "zod";

// ─────────── Skill manifest schema ───────────

export const InputSchema = z.object({
  name: z.string(),
  type: z.enum(["string", "number", "boolean", "array", "object"]),
  description: z.string().optional(),
  required: z.boolean().default(false),
  default: z.any().optional(),
});

export const OutputSchema = z.object({
  name: z.string(),
  type: z.enum(["string", "number", "boolean", "array", "object"]),
  schema: z.any().optional(),
});

export const ParentSkillRef = z.object({
  skill_id: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  royalty_bps: z.number().int().min(0).max(5000),
});

export const SkillManifest = z.object({
  // Identity
  name: z.string().min(3).max(64),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  author_did: z.string().regex(/^did:(gitlawb|key):[a-zA-Z0-9]+$/),
  author_signature: z.string().regex(/^ed25519:0x[a-fA-F0-9]+$/).optional(),

  // Discovery
  description: z.string().min(10).max(2000),
  tags: z.array(z.string()).min(1).max(20),
  categories: z.array(z.string()).min(1).max(5),
  language: z.string().default("en"),

  // Execution
  runtime: z.enum(["python", "node", "wasm", "prompt-only"]),
  entrypoint: z.string().optional(),
  requires: z.array(z.string()).default([]),
  inputs: z.array(InputSchema).default([]),
  outputs: z.array(OutputSchema).default([]),

  // Economics (USDC with 6 decimals; string to preserve precision)
  price_per_call_usdc: z.string().regex(/^\d+(\.\d{1,6})?$/),
  parent_skills: z.array(ParentSkillRef).max(5).default([]),

  // Provenance
  created_at: z.string().datetime(),
  hermes_session: z.string().optional(),
  openclaude_version: z.string().optional(),
  derivation_method: z.enum(["hermes-loop", "manual", "openclaude", "imported"]),
});

export type SkillManifest = z.infer<typeof SkillManifest>;
export type ParentSkillRef = z.infer<typeof ParentSkillRef>;

// ─────────── Benchmark schema ───────────

export const TestCase = z.object({
  id: z.string(),
  input: z.record(z.any()),
  expected_output_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  tolerance: z.string().default("exact"),
  weight: z.number().positive().default(1.0),
});

export const BenchmarkSuite = z.object({
  version: z.string(),
  test_cases: z.array(TestCase).min(1).max(100),
  merkle_root: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
});

export type BenchmarkSuite = z.infer<typeof BenchmarkSuite>;
export type TestCase = z.infer<typeof TestCase>;

// ─────────── On-chain types (mirror Solidity structs) ───────────

export interface ChainSkill {
  cid: string;
  creator: `0x${string}`;
  didHash: `0x${string}`;
  pricePerCall: bigint;
  parentSkills: `0x${string}`[];
  parentBps: number[];
  createdAt: bigint;
  lastInvoked: bigint;
  totalInvocations: bigint;
  totalEarned: bigint;
  active: boolean;
}

export interface ChainAttestation {
  benchmarkHash: `0x${string}`;
  successRate: number;
  attestedAt: bigint;
  attester: `0x${string}`;
  sampleCount: bigint;
}

// ─────────── Network config ───────────

export const NETWORKS = {
  "base-sepolia": {
    chainId: 84532,
    rpc: "https://sepolia.base.org",
    // MockUSDC (open faucet) deployed for testing; override via ATRIUM_USDC_SEPOLIA.
    // Circle's canonical Base Sepolia USDC is 0x036CbD53842c5426634e7929541eC2318f3dCF7e.
    usdc: (process.env.ATRIUM_USDC_SEPOLIA ??
      "0xA713c88927523279B874640003Ed697e509732a7") as `0x${string}`,
    registry: process.env.ATRIUM_REGISTRY_SEPOLIA as `0x${string}` | undefined,
    explorer: "https://sepolia.basescan.org",
  },
  base: {
    chainId: 8453,
    rpc: "https://mainnet.base.org",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
    registry: process.env.ATRIUM_REGISTRY_MAINNET as `0x${string}` | undefined,
    explorer: "https://basescan.org",
  },
} as const;

export type NetworkName = keyof typeof NETWORKS;

// ─────────── Helpers ───────────

export const USDC_DECIMALS = 6;

export function parseUsdc(amount: string): bigint {
  const [whole, frac = ""] = amount.split(".");
  const padded = (frac + "000000").slice(0, USDC_DECIMALS);
  return BigInt(whole) * 10n ** BigInt(USDC_DECIMALS) + BigInt(padded || "0");
}

export function formatUsdc(amount: bigint): string {
  const whole = amount / 10n ** BigInt(USDC_DECIMALS);
  const frac = amount % 10n ** BigInt(USDC_DECIMALS);
  const fracStr = frac.toString().padStart(USDC_DECIMALS, "0").replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}
