import yaml from "js-yaml";

export interface ParentRef {
  skill_id: string;
  royalty_bps: number;
}

export interface Manifest {
  name: string;
  version: string;
  author_did: string;
  description: string;
  tags?: string[];
  categories?: string[];
  runtime?: string;
  price_per_call_usdc: string;
  parent_skills?: ParentRef[];
}

export interface ParseResult {
  manifest: Manifest | null;
  body: string;
  errors: string[];
}

const FRONTMATTER = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;

/** Split YAML frontmatter from the markdown body and validate required fields. */
export function parseManifest(raw: string): ParseResult {
  const m = raw.match(FRONTMATTER);
  if (!m) {
    return { manifest: null, body: "", errors: ["No YAML frontmatter found (expected a `---` block at the top)."] };
  }

  let data: Record<string, unknown>;
  try {
    data = (yaml.load(m[1]) as Record<string, unknown>) ?? {};
  } catch (e) {
    return { manifest: null, body: m[2], errors: [`YAML parse error: ${e instanceof Error ? e.message : "invalid"}`] };
  }

  const errors = validate(data);
  if (errors.length) return { manifest: null, body: m[2], errors };

  return { manifest: data as unknown as Manifest, body: m[2], errors: [] };
}

function validate(d: Record<string, unknown>): string[] {
  const e: string[] = [];
  const str = (k: string) => typeof d[k] === "string" && (d[k] as string).length > 0;

  if (!str("name") || (d.name as string).length < 3) e.push("`name` is required (min 3 chars).");
  if (!/^\d+\.\d+\.\d+$/.test(String(d.version ?? ""))) e.push("`version` must be semver (e.g. 0.1.0).");
  if (!/^did:(gitlawb|key):/.test(String(d.author_did ?? ""))) e.push("`author_did` must be a did:key or did:gitlawb.");
  if (!str("description") || (d.description as string).length < 10) e.push("`description` is required (min 10 chars).");
  if (!/^\d+(\.\d{1,6})?$/.test(String(d.price_per_call_usdc ?? "")))
    e.push("`price_per_call_usdc` must be a number with ≤6 decimals (e.g. 0.005).");

  const parents = d.parent_skills;
  if (parents !== undefined) {
    if (!Array.isArray(parents)) {
      e.push("`parent_skills` must be a list.");
    } else {
      let totalBps = 0;
      for (const p of parents as ParentRef[]) {
        if (!/^0x[a-fA-F0-9]{64}$/.test(String(p?.skill_id))) e.push("Each parent needs a 0x… 32-byte `skill_id`.");
        if (typeof p?.royalty_bps !== "number" || p.royalty_bps < 0) e.push("Each parent needs a numeric `royalty_bps`.");
        else totalBps += p.royalty_bps;
      }
      if (totalBps > 5000) e.push("Combined parent `royalty_bps` exceeds 5000 (50%).");
    }
  }
  return e;
}
