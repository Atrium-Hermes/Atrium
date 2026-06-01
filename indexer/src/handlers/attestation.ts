import type { Db } from "../db/client.js";
import { addr, type EventMeta } from "./types.js";

interface BenchmarkAttestedArgs {
  skillId: string;
  attester: string;
  benchmarkHash: string;
  successRate: number;
  sampleCount: bigint;
}

/**
 * BenchmarkAttested → store the latest attestation per skill.
 * The contract keeps only the most recent attestation, so we upsert.
 */
export function handleBenchmarkAttested(db: Db, a: BenchmarkAttestedArgs, m: EventMeta): void {
  db.prep(
    `INSERT INTO attestations (skillId, benchmarkHash, successRate, sampleCount, attester, attestedAt, txHash)
     VALUES (@skillId, @hash, @rate, @count, @attester, @at, @tx)
     ON CONFLICT(skillId) DO UPDATE SET
       benchmarkHash = excluded.benchmarkHash,
       successRate   = excluded.successRate,
       sampleCount   = excluded.sampleCount,
       attester      = excluded.attester,
       attestedAt    = excluded.attestedAt,
       txHash        = excluded.txHash`
  ).run({
    skillId: a.skillId,
    hash: a.benchmarkHash,
    rate: a.successRate,
    count: Number(a.sampleCount),
    attester: addr(a.attester),
    at: m.blockTimestamp,
    tx: m.txHash,
  });
}
