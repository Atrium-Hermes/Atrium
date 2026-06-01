import "dotenv/config";
import type { Address } from "viem";

export interface Config {
  registry: Address;
  rpcUrl: string;
  deployBlock: bigint;
  databasePath: string;
  port: number;
  logLevel: string;
  ipfsGateways: string[];
  pollIntervalMs: number;
  maxBlockRange: bigint;
  ipfsConcurrency: number;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function asAddress(value: string, name: string): Address {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`${name} is not a valid address: ${value}`);
  }
  return value as Address;
}

export function loadConfig(): Config {
  const gateways = (process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud/ipfs")
    .split(",")
    .map((g) => g.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  return {
    registry: asAddress(required("ATRIUM_REGISTRY"), "ATRIUM_REGISTRY"),
    rpcUrl: required("BASE_RPC_URL"),
    deployBlock: BigInt(process.env.REGISTRY_DEPLOY_BLOCK || "0"),
    databasePath: process.env.DATABASE_PATH || "./atrium-index.db",
    port: Number(process.env.PORT || "3001"),
    logLevel: process.env.LOG_LEVEL || "info",
    ipfsGateways: gateways,
    pollIntervalMs: Number(process.env.INDEX_POLL_INTERVAL_MS || "12000"),
    // Public Base RPCs (sepolia.base.org) cap eth_getLogs at a 2000-block range
    // and reject larger windows with -32602 "query exceeds max block range 2000",
    // which stalls a fresh backfill. Stay safely under the cap by default; raise
    // via MAX_BLOCK_RANGE only when pointed at an RPC that allows wider queries.
    maxBlockRange: BigInt(process.env.MAX_BLOCK_RANGE || "1900"),
    ipfsConcurrency: Number(process.env.IPFS_CONCURRENCY || "4"),
  };
}
