// USDC has 6 decimals (NOT 18). These helpers mirror parseUsdc/formatUsdc in
// shared/schema.ts — kept local so the indexer stays a self-contained workspace.
// If the canonical helpers change, update these to match.

export const USDC_DECIMALS = 6;
const SCALE = 10n ** BigInt(USDC_DECIMALS);

/** "1.5" → 1500000n */
export function parseUsdc(amount: string): bigint {
  const [whole, frac = ""] = amount.split(".");
  const padded = (frac + "000000").slice(0, USDC_DECIMALS);
  return BigInt(whole || "0") * SCALE + BigInt(padded || "0");
}

/** 1500000n (or its string form) → "1.5" */
export function formatUsdc(amount: bigint | string): string {
  const v = typeof amount === "string" ? BigInt(amount || "0") : amount;
  const whole = v / SCALE;
  const frac = v % SCALE;
  const fracStr = frac.toString().padStart(USDC_DECIMALS, "0").replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}
