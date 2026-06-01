import type { Hono } from "hono";
import type { AppContext } from "./context.js";
import { toDetail, toSummary, type SkillRow } from "./format.js";
import { formatUsdc } from "../lib/usdc.js";

export function skillRoutes(app: Hono, ctx: AppContext): void {
  app.get("/skills/:skillId", (c) => {
    const skillId = c.req.param("skillId");
    const row = ctx.db.prep("SELECT * FROM skills WHERE skillId = ?").get(skillId) as
      | SkillRow
      | undefined;
    if (!row) return c.json({ error: "skill not found" }, 404);

    const attestation = ctx.db.prep("SELECT * FROM attestations WHERE skillId = ?").get(skillId) ?? null;

    const parents = (
      ctx.db
        .prep(
          `SELECT p.parentSkillId, p.royaltyBps, s.name, s.creator
           FROM skill_parents p LEFT JOIN skills s ON s.skillId = p.parentSkillId
           WHERE p.skillId = ?`
        )
        .all(skillId) as Array<{ parentSkillId: string; royaltyBps: number; name: string | null; creator: string | null }>
    ).map((p) => ({ ...p, royaltyPct: p.royaltyBps / 100 }));

    const recentInvocations = (
      ctx.db
        .prep(
          "SELECT txHash, caller, amount, invocationNumber, blockNumber, blockTimestamp FROM invocations WHERE skillId = ? ORDER BY blockNumber DESC, logIndex DESC LIMIT 20"
        )
        .all(skillId) as Array<{ amount: string; [k: string]: unknown }>
    ).map((i) => ({ ...i, amountUsdc: formatUsdc(i.amount) }));

    return c.json({
      skill: toDetail(row),
      attestation,
      parents,
      recentInvocations,
      ipfsBody: row.body,
    });
  });

  app.get("/skills/:skillId/body", (c) => {
    const skillId = c.req.param("skillId");
    const row = ctx.db.prep("SELECT body, ipfsFetched FROM skills WHERE skillId = ?").get(skillId) as
      | { body: string | null; ipfsFetched: number }
      | undefined;
    if (!row) return c.json({ error: "skill not found" }, 404);
    if (!row.body) return c.json({ error: "body not yet indexed from IPFS" }, 404);
    return c.body(row.body, 200, { "Content-Type": "text/markdown; charset=utf-8" });
  });
}
