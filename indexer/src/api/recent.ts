import type { Hono } from "hono";
import type { AppContext } from "./context.js";
import { formatUsdc } from "../lib/usdc.js";

export function recentRoutes(app: Hono, ctx: AppContext): void {
  app.get("/recent", (c) => {
    const type = c.req.query("type") ?? "skills";
    const limit = Math.min(Math.max(Number(c.req.query("limit") ?? "20") || 20, 1), 100);

    if (type === "invocations") {
      const items = (
        ctx.db
          .prep(
            "SELECT txHash, skillId, caller, amount, invocationNumber, blockNumber, blockTimestamp FROM invocations ORDER BY blockNumber DESC, logIndex DESC LIMIT ?"
          )
          .all(limit) as Array<{ amount: string; [k: string]: unknown }>
      ).map((i) => ({ ...i, amountUsdc: formatUsdc(i.amount) }));
      return c.json({ items });
    }

    if (type === "attestations") {
      const items = ctx.db
        .prep("SELECT * FROM attestations ORDER BY attestedAt DESC LIMIT ?")
        .all(limit);
      return c.json({ items });
    }

    // default: recently registered skills
    const items = ctx.db
      .prep(
        "SELECT skillId, name, description, creator, cid, pricePerCall, createdAt, active FROM skills ORDER BY createdAt DESC, blockNumber DESC LIMIT ?"
      )
      .all(limit) as Array<{ pricePerCall: string; [k: string]: unknown }>;
    return c.json({ items: items.map((s) => ({ ...s, pricePerCallUsdc: formatUsdc(s.pricePerCall) })) });
  });
}
