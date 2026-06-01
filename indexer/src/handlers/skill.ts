import type { Db } from "../db/client.js";
import { addr, big, type EventMeta } from "./types.js";

interface SkillRegisteredArgs {
  skillId: string;
  creator: string;
  didHash: string;
  cid: string;
  pricePerCall: bigint;
  parentSkills: readonly string[];
  parentBps: readonly number[];
}

/**
 * SkillRegistered → upsert the skill row + its parent edges.
 * Returns the cid if this is a NEW skill (so the caller can schedule a lazy
 * IPFS fetch); returns null if the skill already existed (idempotent replay).
 */
export function handleSkillRegistered(db: Db, a: SkillRegisteredArgs, m: EventMeta): string | null {
  const info = db
    .prep(
      `INSERT INTO skills (skillId, cid, creator, didHash, pricePerCall, active, createdAt, blockNumber)
       VALUES (@skillId, @cid, @creator, @didHash, @price, 1, @createdAt, @block)
       ON CONFLICT(skillId) DO NOTHING`
    )
    .run({
      skillId: a.skillId,
      cid: a.cid,
      creator: addr(a.creator),
      didHash: a.didHash,
      price: big(a.pricePerCall),
      createdAt: m.blockTimestamp,
      block: Number(m.blockNumber),
    });

  if (info.changes === 0) return null; // already indexed

  const insertParent = db.prep(
    "INSERT OR IGNORE INTO skill_parents (skillId, parentSkillId, royaltyBps) VALUES (?, ?, ?)"
  );
  for (let i = 0; i < a.parentSkills.length; i++) {
    insertParent.run(a.skillId, a.parentSkills[i], a.parentBps[i]);
  }

  return a.cid;
}

interface SkillDeactivatedArgs {
  skillId: string;
}

export function handleSkillDeactivated(db: Db, a: SkillDeactivatedArgs): void {
  db.prep("UPDATE skills SET active = 0 WHERE skillId = ?").run(a.skillId);
}
