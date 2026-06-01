// Display helpers. The indexer already returns human USDC strings (e.g. "0.005")
// alongside raw base units, so the frontend mostly formats for presentation.

/** Append the USDC ticker to an already-formatted amount string. */
export function usdc(amount: string | null | undefined): string {
  return `${amount ?? "0"} USDC`;
}

/** base-units bigint (6 decimals) → human string, e.g. 1500000n → "1.5". */
export function formatUsdc(amount: bigint | string): string {
  const v = typeof amount === "string" ? BigInt(amount || "0") : amount;
  const scale = 10n ** 6n;
  const frac = (v % scale).toString().padStart(6, "0").replace(/0+$/, "");
  return frac ? `${v / scale}.${frac}` : (v / scale).toString();
}

/** 0xabc…1234 */
export function truncate(value: string, lead = 6, tail = 4): string {
  if (!value) return "";
  if (value.length <= lead + tail + 1) return value;
  return `${value.slice(0, lead)}…${value.slice(-tail)}`;
}

/** Compact number formatting: 1234 → "1.2k". */
export function compact(n: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/** Unix seconds → "3h ago" / "2d ago". */
export function relativeTime(unixSeconds: number): string {
  if (!unixSeconds) return "—";
  const diff = Date.now() / 1000 - unixSeconds;
  const units: Array<[number, string]> = [
    [60, "s"],
    [3600, "m"],
    [86400, "h"],
    [86400 * 30, "d"],
    [86400 * 365, "mo"],
    [Infinity, "y"],
  ];
  let prev = 1;
  for (const [limit, label] of units) {
    if (diff < limit) return `${Math.max(1, Math.floor(diff / prev))}${label} ago`;
    prev = limit;
  }
  return "—";
}
