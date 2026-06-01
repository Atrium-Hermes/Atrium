import type { Hono } from "hono";
import type { AppContext } from "./context.js";
import { parsePagination, toSummary, type SkillRow } from "./format.js";

const SORTS: Record<string, string> = {
  recent: "s.createdAt DESC",
  invocations: "s.totalInvocations DESC",
  earned: "CAST(s.totalEarned AS INTEGER) DESC",
};

// Tokenize free text into a safe FTS5 prefix query: each term quoted + prefixed,
// joined by implicit AND. Quoting neutralizes FTS operator characters.
function buildMatch(q: string): string {
  const terms = q
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `"${t.replace(/"/g, "")}"*`);
  return terms.join(" ");
}

export function searchRoutes(app: Hono, ctx: AppContext): void {
  app.get("/skills", (c) => {
    const q = c.req.query("q")?.trim();
    const tag = c.req.query("tag")?.trim().toLowerCase();
    const category = c.req.query("category")?.trim().toLowerCase();
    const sort = SORTS[c.req.query("sort") ?? "recent"] ?? SORTS.recent;
    const { limit, offset } = parsePagination({
      limit: c.req.query("limit"),
      offset: c.req.query("offset"),
    });

    const where: string[] = [];
    const params: unknown[] = [];
    // FTS5 requires the table name (not an alias) as the MATCH left operand.
    const join = q ? "JOIN skills_fts ON skills_fts.skillId = s.skillId" : "";

    // Browse shows only active skills by default; pass ?includeInactive=1 to include deactivated ones.
    if (c.req.query("includeInactive") !== "1") {
      where.push("s.active = 1");
    }

    if (q) {
      where.push("skills_fts MATCH ?");
      params.push(buildMatch(q));
    }
    if (tag) {
      where.push("s.tagsText LIKE ?");
      params.push(`%${tag}%`);
    }
    if (category) {
      where.push("s.categoriesText LIKE ?");
      params.push(`%${category}%`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const total = (
      ctx.db.prep(`SELECT COUNT(*) AS n FROM skills s ${join} ${whereSql}`).get(...params) as {
        n: number;
      }
    ).n;

    const rows = ctx.db
      .prep(`SELECT s.* FROM skills s ${join} ${whereSql} ORDER BY ${sort} LIMIT ? OFFSET ?`)
      .all(...params, limit, offset) as SkillRow[];

    return c.json({
      items: rows.map(toSummary),
      total,
      hasMore: offset + rows.length < total,
    });
  });
}
