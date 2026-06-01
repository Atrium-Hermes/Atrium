import type { Db } from "../db/client.js";
import { addr, big, type EventMeta } from "./types.js";

// ─────────── Money-path invariant ───────────
// AtriumRegistry.invokeSkill splits each payment exactly:
//   protocolCut   = price * protocolFeeBps / 10000        (floor)
//   distributable = price - protocolCut
//   parentCut_i   = distributable * parentBps_i / 10000    (emitted as RoyaltyPaid)
//   toCreator     = distributable - Σ parentCut_i
// We mirror that here so skills.totalEarned matches on-chain Skill.totalEarned:
//   - a child skill's totalEarned grows by `toCreator` per invocation
//   - a parent skill's totalEarned grows by each royalty it receives
// Σ(credits) == price, preserving conservation of funds.
// RoyaltyPaid logs are emitted BEFORE SkillInvoked within the same tx (lower
// logIndex), so by the time we handle SkillInvoked the royalty rows already
// exist in this transaction and `toCreator` can be derived exactly.

function addBig(db: Db, skillId: string, column: "totalEarned" | "totalVolume", delta: bigint): void {
  const row = db.prep(`SELECT ${column} AS v FROM skills WHERE skillId = ?`).get(skillId) as
    | { v: string }
    | undefined;
  if (!row) return; // skill row not yet seen (out-of-order parent); skip safely
  const next = BigInt(row.v) + delta;
  db.prep(`UPDATE skills SET ${column} = ? WHERE skillId = ?`).run(next.toString(), skillId);
}

interface RoyaltyPaidArgs {
  parentSkillId: string;
  childSkillId: string;
  parentCreator: string;
  amount: bigint;
}

export function handleRoyaltyPaid(db: Db, a: RoyaltyPaidArgs, m: EventMeta): void {
  const info = db
    .prep(
      `INSERT OR IGNORE INTO royalty_payments
         (txHash, logIndex, parentSkillId, childSkillId, parentCreator, amount, blockNumber)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(m.txHash, m.logIndex, a.parentSkillId, a.childSkillId, addr(a.parentCreator), big(a.amount), Number(m.blockNumber));

  // Credit the parent skill's earnings only once (changes>0 means newly inserted).
  if (info.changes > 0) addBig(db, a.parentSkillId, "totalEarned", a.amount);
}

interface SkillInvokedArgs {
  skillId: string;
  caller: string;
  amount: bigint;
  invocationNumber: bigint;
}

export function handleSkillInvoked(db: Db, a: SkillInvokedArgs, m: EventMeta, feeBps: number): void {
  const info = db
    .prep(
      `INSERT OR IGNORE INTO invocations
         (txHash, logIndex, skillId, caller, amount, invocationNumber, blockNumber, blockTimestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      m.txHash,
      m.logIndex,
      a.skillId,
      addr(a.caller),
      big(a.amount),
      Number(a.invocationNumber),
      Number(m.blockNumber),
      m.blockTimestamp
    );

  if (info.changes === 0) return; // replay — counters already applied

  const protocolCut = (a.amount * BigInt(feeBps)) / 10000n;
  const distributable = a.amount - protocolCut;

  // Royalties this invocation paid out to parents (recorded just before this log).
  const royaltyRow = db
    .prep("SELECT COALESCE(SUM(CAST(amount AS INTEGER)), 0) AS total FROM royalty_payments WHERE txHash = ? AND childSkillId = ?")
    .get(m.txHash, a.skillId) as { total: number };
  const parentCuts = BigInt(royaltyRow.total);
  const toCreator = distributable - parentCuts;

  addBig(db, a.skillId, "totalEarned", toCreator);
  addBig(db, a.skillId, "totalVolume", a.amount);
  db.prep("UPDATE skills SET totalInvocations = ?, lastInvoked = ? WHERE skillId = ?").run(
    Number(a.invocationNumber),
    m.blockTimestamp,
    a.skillId
  );
}

interface WithdrawArgs {
  user: string;
  amount: bigint;
}

export function handleWithdraw(db: Db, a: WithdrawArgs, m: EventMeta): void {
  db.prep(
    "INSERT OR IGNORE INTO withdrawals (txHash, logIndex, user, amount, blockNumber) VALUES (?, ?, ?, ?, ?)"
  ).run(m.txHash, m.logIndex, addr(a.user), big(a.amount), Number(m.blockNumber));
}
