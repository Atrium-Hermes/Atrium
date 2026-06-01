import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import matter from "gray-matter";
import { SkillManifest, type SkillManifest as SkillManifestType, BenchmarkSuite, type BenchmarkSuite as BenchmarkSuiteType } from "../../../shared/schema.js";

export interface ParsedSkill {
  manifest: SkillManifestType;
  body: string;          // Markdown content
  benchmark?: BenchmarkSuiteType;
  files: Array<{ path: string; content: Buffer }>;
}

/**
 * Read a skill from a directory or single file.
 * Directory: expects skill.md + optional benchmark.json + other files.
 * File: a single .md with frontmatter (no benchmark).
 */
export function parseSkill(path: string): ParsedSkill {
  const stats = statSync(path);

  if (stats.isFile()) {
    return parseSingleFile(path);
  } else if (stats.isDirectory()) {
    return parseDirectory(path);
  }
  throw new Error(`Invalid skill path: ${path}`);
}

function parseSingleFile(filePath: string): ParsedSkill {
  const raw = readFileSync(filePath, "utf-8");
  const parsed = matter(raw);
  const manifest = SkillManifest.parse(parsed.data);

  return {
    manifest,
    body: parsed.content,
    files: [{ path: "skill.md", content: Buffer.from(raw, "utf-8") }],
  };
}

function parseDirectory(dirPath: string): ParsedSkill {
  const skillMdPath = join(dirPath, "skill.md");
  const raw = readFileSync(skillMdPath, "utf-8");
  const parsed = matter(raw);
  const manifest = SkillManifest.parse(parsed.data);

  let benchmark: BenchmarkSuiteType | undefined;
  const benchPath = join(dirPath, "benchmark.json");
  try {
    const benchRaw = readFileSync(benchPath, "utf-8");
    benchmark = BenchmarkSuite.parse(JSON.parse(benchRaw));
  } catch {
    // No benchmark — optional
  }

  // Collect all files for IPFS upload
  const files: Array<{ path: string; content: Buffer }> = [];
  collectFiles(dirPath, dirPath, files);

  return { manifest, body: parsed.content, benchmark, files };
}

function collectFiles(
  baseDir: string,
  currentDir: string,
  acc: Array<{ path: string; content: Buffer }>
): void {
  for (const entry of readdirSync(currentDir)) {
    if (entry.startsWith(".")) continue;
    const full = join(currentDir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      collectFiles(baseDir, full, acc);
    } else {
      const relative = full.slice(baseDir.length + 1);
      acc.push({ path: relative, content: readFileSync(full) });
    }
  }
}

/**
 * Serialize manifest + body back to markdown with frontmatter.
 */
export function serializeSkill(manifest: SkillManifestType, body: string): string {
  return matter.stringify(body, manifest);
}

/**
 * Pretty-print skill metadata for terminal display.
 */
export function formatSkill(s: SkillManifestType): string {
  const lines = [
    `\x1b[1m${s.name}\x1b[0m \x1b[90mv${s.version}\x1b[0m`,
    `\x1b[90m${s.description.slice(0, 80)}${s.description.length > 80 ? "..." : ""}\x1b[0m`,
    `tags: ${s.tags.join(", ")}`,
    `price: ${s.price_per_call_usdc} USDC/call · runtime: ${s.runtime}`,
    `author: ${s.author_did}`,
  ];
  if (s.parent_skills.length > 0) {
    lines.push(
      `derived from ${s.parent_skills.length} parent(s) (royalty: ${s.parent_skills.reduce((sum, p) => sum + p.royalty_bps, 0) / 100}%)`
    );
  }
  return lines.join("\n");
}
