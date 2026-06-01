// Metadata every decoded log carries, independent of event kind.
export interface EventMeta {
  txHash: string;
  logIndex: number;
  blockNumber: bigint;
  blockTimestamp: number; // unix seconds
}

// Helpers for normalizing on-chain values into the DB's text representation.
export const addr = (a: string): string => a.toLowerCase();
export const big = (v: bigint): string => v.toString();
