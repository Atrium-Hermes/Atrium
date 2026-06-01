import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Statement } from "better-sqlite3";

// schema.sql sits next to this module (copied into dist/db on build).
const SCHEMA_PATH = fileURLToPath(new URL("./schema.sql", import.meta.url));

/**
 * Thin synchronous wrapper around better-sqlite3.
 * - `prep` memoizes prepared statements per SQL string.
 * - `tx` wraps a function in a single transaction (writes + cursor update commit atomically).
 */
export class Db {
  readonly raw: Database.Database;
  private cache = new Map<string, Statement>();

  constructor(path: string) {
    this.raw = new Database(path);
    this.migrate();
  }

  private migrate(): void {
    this.raw.exec(readFileSync(SCHEMA_PATH, "utf-8"));
  }

  prep(sql: string): Statement {
    let stmt = this.cache.get(sql);
    if (!stmt) {
      stmt = this.raw.prepare(sql);
      this.cache.set(sql, stmt);
    }
    return stmt;
  }

  tx<T>(fn: () => T): T {
    return this.raw.transaction(fn)();
  }

  // ─────────── Cursor ───────────

  getCursor(name: string): bigint | null {
    const row = this.prep("SELECT lastBlock FROM events_cursor WHERE name = ?").get(name) as
      | { lastBlock: number }
      | undefined;
    return row ? BigInt(row.lastBlock) : null;
  }

  setCursor(name: string, block: bigint): void {
    this.prep(
      "INSERT INTO events_cursor (name, lastBlock) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET lastBlock = excluded.lastBlock"
    ).run(name, Number(block));
  }

  // ─────────── Meta key/value ───────────

  getMeta(key: string): string | null {
    const row = this.prep("SELECT value FROM meta WHERE key = ?").get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? null;
  }

  setMeta(key: string, value: string): void {
    this.prep(
      "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).run(key, value);
  }

  close(): void {
    this.raw.close();
  }
}
