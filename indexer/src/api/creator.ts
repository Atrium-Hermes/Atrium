import type { Hono } from "hono";
import type { Address } from "viem";
import type { AppContext } from "./context.js";
import { toSummary, type SkillRow } from "./format.js";
import { formatUsdc } from "../lib/usdc.js";
import { REGISTRY_ABI } from "../lib/chain.js";

function sumBig(values: string[]): bigint {
  return values.reduce((acc, v) => acc + BigInt(v || "0"), 0n);
}

export function creatorRoutes(app: Hono, ctx: AppContext): void {
  app.get("/creators/:address/skills", (c) => {
    const address = c.req.param("address").toLowerCase();
    const rows = ctx.db
      .prep("SELECT * FROM skills WHERE creator = ? ORDER BY createdAt DESC")
      .all(address) as SkillRow[];

    const totalEarned = sumBig(rows.map((r) => r.totalEarned));
    return c.json({
      items: rows.map(toSummary),
      totals: {
        count: rows.length,
        totalInvocations: rows.reduce((a, r) => a + r.totalInvocations, 0),
        totalEarned: formatUsdc(totalEarned),
        totalEarnedRaw: totalEarned.toString(),
      },
    });
  });

  app.get("/creators/:address/earnings", async (c) => {
    const address = c.req.param("address").toLowerCase();
    const rows = ctx.db
      .prep("SELECT skillId, name, totalEarned, totalInvocations FROM skills WHERE creator = ?")
      .all(address) as Array<{ skillId: string; name: string | null; totalEarned: string; totalInvocations: number }>;

    const totalEarned = sumBig(rows.map((r) => r.totalEarned));
    const withdrawn = sumBig(
      (ctx.db.prep("SELECT amount FROM withdrawals WHERE user = ?").all(address) as Array<{ amount: string }>).map(
        (w) => w.amount
      )
    );

    // withdrawable is live contract state the cache cannot derive (it resets to 0
    // on withdraw); read it directly. Chain is the source of truth here.
    let withdrawable = "0";
    try {
      const w = (await ctx.client.readContract({
        address: ctx.registry,
        abi: REGISTRY_ABI,
        functionName: "withdrawable",
        args: [address as Address],
      })) as bigint;
      withdrawable = w.toString();
    } catch {
      // RPC hiccup — report cached-derived fields, flag withdrawable unknown.
      return c.json({
        totalEarned: formatUsdc(totalEarned),
        withdrawn: formatUsdc(withdrawn),
        withdrawable: null,
        byCreatedSkill: rows.map((r) => ({ ...r, totalEarned: formatUsdc(r.totalEarned) })),
      });
    }

    return c.json({
      totalEarned: formatUsdc(totalEarned),
      withdrawn: formatUsdc(withdrawn),
      withdrawable: formatUsdc(withdrawable),
      withdrawableRaw: withdrawable,
      byCreatedSkill: rows.map((r) => ({
        skillId: r.skillId,
        name: r.name,
        totalInvocations: r.totalInvocations,
        totalEarned: formatUsdc(r.totalEarned),
        totalEarnedRaw: r.totalEarned,
      })),
    });
  });
}
