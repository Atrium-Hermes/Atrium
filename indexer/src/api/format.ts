import { formatUsdc } from "../lib/usdc.js";

export interface SkillRow {
  skillId: string;
  cid: string;
  creator: string;
  didHash: string;
  pricePerCall: string;
  totalInvocations: number;
  totalVolume: string;
  totalEarned: string;
  active: number;
  createdAt: number;
  lastInvoked: number;
  blockNumber: number;
  name: string | null;
  description: string | null;
  tagsJson: string | null;
  categoriesJson: string | null;
  manifestJson: string | null;
  body: string | null;
  ipfsFetched: number;
}

const jsonList = (s: string | null): string[] => {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
};

export interface SkillSummary {
  skillId: string;
  name: string | null;
  description: string | null;
  creator: string;
  cid: string;
  pricePerCall: string; // human USDC
  pricePerCallRaw: string; // base units
  totalInvocations: number;
  totalEarned: string;
  totalEarnedRaw: string;
  active: boolean;
  createdAt: number;
  tags: string[];
  categories: string[];
}

export function toSummary(r: SkillRow): SkillSummary {
  return {
    skillId: r.skillId,
    name: r.name,
    description: r.description,
    creator: r.creator,
    cid: r.cid,
    pricePerCall: formatUsdc(r.pricePerCall),
    pricePerCallRaw: r.pricePerCall,
    totalInvocations: r.totalInvocations,
    totalEarned: formatUsdc(r.totalEarned),
    totalEarnedRaw: r.totalEarned,
    active: r.active === 1,
    createdAt: r.createdAt,
    tags: jsonList(r.tagsJson),
    categories: jsonList(r.categoriesJson),
  };
}

export function toDetail(r: SkillRow) {
  return {
    ...toSummary(r),
    didHash: r.didHash,
    totalVolume: formatUsdc(r.totalVolume),
    totalVolumeRaw: r.totalVolume,
    lastInvoked: r.lastInvoked,
    blockNumber: r.blockNumber,
    bodyCached: r.ipfsFetched === 1,
    manifest: r.manifestJson ? safeParse(r.manifestJson) : null,
  };
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export interface Pagination {
  limit: number;
  offset: number;
}

export function parsePagination(q: Record<string, string | undefined>): Pagination {
  const limit = Math.min(Math.max(Number(q.limit ?? "20") || 20, 1), 100);
  const offset = Math.max(Number(q.offset ?? "0") || 0, 0);
  return { limit, offset };
}
