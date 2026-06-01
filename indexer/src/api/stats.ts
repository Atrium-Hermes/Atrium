import type { Hono } from "hono";
import type { AppContext } from "./context.js";
import { formatUsdc } from "../lib/usdc.js";

export function statsRoutes(app: Hono, ctx: AppContext): void {
  app.get("/stats", (c) => {
    const counts = ctx.db
      .prep(
        `SELECT COUNT(*) AS totalSkills,
                COALESCE(SUM(active), 0) AS activeSkills,
                COALESCE(SUM(totalInvocations), 0) AS totalInvocations
         FROM skills`
      )
      .get() as { totalSkills: number; activeSkills: number; totalInvocations: number };

    const settled = (
      ctx.db.prep("SELECT COALESCE(SUM(CAST(amount AS INTEGER)), 0) AS v FROM invocations").get() as {
        v: number;
      }
    ).v;

    const top10 = (
      ctx.db
        .prep(
          `SELECT skillId, name, creator, totalEarned, totalInvocations
           FROM skills ORDER BY CAST(totalEarned AS INTEGER) DESC LIMIT 10`
        )
        .all() as Array<{ skillId: string; name: string | null; creator: string; totalEarned: string; totalInvocations: number }>
    ).map((r) => ({
      skillId: r.skillId,
      name: r.name,
      creator: r.creator,
      totalInvocations: r.totalInvocations,
      totalEarned: formatUsdc(r.totalEarned),
      totalEarnedRaw: r.totalEarned,
    }));

    return c.json({
      totalSkills: counts.totalSkills,
      activeSkills: counts.activeSkills,
      totalInvocations: counts.totalInvocations,
      totalUsdcSettled: formatUsdc(BigInt(settled)),
      totalUsdcSettledRaw: String(settled),
      top10ByEarnings: top10,
    });
  });
}
