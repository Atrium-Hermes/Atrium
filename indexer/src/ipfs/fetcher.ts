import PQueue from "p-queue";
import matter from "gray-matter";
import type { Db } from "../db/client.js";
import type { Logger } from "../lib/logger.js";

const FETCH_TIMEOUT_MS = 12_000;

interface ManifestFields {
  name?: string;
  description?: string;
  tags?: unknown;
  categories?: unknown;
}

function asTextList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") return [v];
  return [];
}

/**
 * Lazily fetches skill bodies from IPFS gateways and caches them in SQLite
 * (so the API never blocks on a gateway round-trip and FTS can index the text).
 * Fetches are bounded by a p-queue to respect gateway rate limits. Failures are
 * left as ipfsFetched=0 and retried on the next startup / backfill sweep.
 */
export class IpfsFetcher {
  private queue: PQueue;

  constructor(
    private db: Db,
    private gateways: string[],
    concurrency: number,
    private log: Logger
  ) {
    this.queue = new PQueue({ concurrency });
  }

  /** Schedule a fetch for a freshly-registered skill (fire-and-forget). */
  schedule(skillId: string, cid: string): void {
    void this.queue.add(() => this.fetchAndCache(skillId, cid));
  }

  /** Re-enqueue every skill whose body was never cached (run on startup). */
  backfillUnfetched(): number {
    const rows = this.db
      .prep("SELECT skillId, cid FROM skills WHERE ipfsFetched = 0")
      .all() as Array<{ skillId: string; cid: string }>;
    for (const r of rows) this.schedule(r.skillId, r.cid);
    return rows.length;
  }

  async onIdle(): Promise<void> {
    await this.queue.onIdle();
  }

  private async fetchAndCache(skillId: string, cid: string): Promise<void> {
    const raw = await this.fetchBody(cid);
    if (raw === null) {
      this.log.warn({ skillId, cid }, "ipfs fetch failed on all gateways");
      return;
    }

    let data: ManifestFields = {};
    let body = raw;
    try {
      const parsed = matter(raw);
      data = parsed.data as ManifestFields;
      body = parsed.content;
    } catch (err) {
      this.log.warn({ skillId, err }, "frontmatter parse failed; caching raw body");
    }

    const tags = asTextList(data.tags);
    const categories = asTextList(data.categories);

    this.db.tx(() => {
      this.db
        .prep(
          `UPDATE skills SET name=@name, description=@desc, tagsJson=@tagsJson,
             categoriesJson=@catJson, tagsText=@tagsText, categoriesText=@catText,
             manifestJson=@manifest, body=@body, ipfsFetched=1
           WHERE skillId=@skillId`
        )
        .run({
          name: typeof data.name === "string" ? data.name : null,
          desc: typeof data.description === "string" ? data.description : null,
          tagsJson: JSON.stringify(tags),
          catJson: JSON.stringify(categories),
          tagsText: tags.join(" ").toLowerCase(),
          catText: categories.join(" ").toLowerCase(),
          manifest: JSON.stringify(data),
          body,
          skillId,
        });

      // Refresh the FTS row.
      this.db.prep("DELETE FROM skills_fts WHERE skillId = ?").run(skillId);
      this.db
        .prep("INSERT INTO skills_fts (skillId, name, description, tags, body) VALUES (?, ?, ?, ?, ?)")
        .run(skillId, data.name ?? "", data.description ?? "", tags.join(" "), body);
    });

    this.log.info({ skillId, cid }, "cached skill body");
  }

  private async fetchBody(cid: string): Promise<string | null> {
    // skills are pinned wrapped in a directory, so skill.md lives at <cid>/skill.md;
    // fall back to the bare CID for single-file pins.
    const paths = [`${cid}/skill.md`, cid];
    for (const gateway of this.gateways) {
      for (const p of paths) {
        const text = await this.tryFetch(`${gateway}/${p}`);
        if (text !== null) return text;
      }
    }
    return null;
  }

  private async tryFetch(url: string): Promise<string | null> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) return null;
      const ct = res.headers.get("content-type") ?? "";
      const text = await res.text();
      // A bare directory CID makes gateways return an HTML "Index of /ipfs/…"
      // listing page. That is NOT a skill body — never cache it. (The skill was
      // pinned with a non-standard filename; see the CLI pinDirectory fix.)
      if (ct.includes("text/html") || isHtmlListing(text)) return null;
      return text;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

function isHtmlListing(text: string): boolean {
  const head = text.slice(0, 200).toLowerCase();
  return head.includes("<!doctype html") || head.includes("<html") || head.includes("index of /ipfs/");
}
