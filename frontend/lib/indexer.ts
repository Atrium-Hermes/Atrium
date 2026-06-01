// Typed client for the Atrium indexer REST API (Workstream 1).
// All page data flows through here. Calls fail soft (return null / empty) so the
// UI still renders if the indexer is unreachable.

// Server components hit the indexer directly; the browser goes through the
// same-origin /api/indexer proxy (works behind port-forwarding / remote hosts).
function base(): string {
  return typeof window === "undefined"
    ? process.env.NEXT_PUBLIC_INDEXER_URL || "http://localhost:3001"
    : "/api/indexer";
}

export interface SkillSummary {
  skillId: string;
  name: string | null;
  description: string | null;
  creator: string;
  cid: string;
  pricePerCall: string;
  pricePerCallRaw: string;
  totalInvocations: number;
  totalEarned: string;
  totalEarnedRaw: string;
  active: boolean;
  createdAt: number;
  tags: string[];
  categories: string[];
}

export interface SkillList {
  items: SkillSummary[];
  total: number;
  hasMore: boolean;
}

export interface Attestation {
  skillId: string;
  benchmarkHash: string;
  successRate: number;
  sampleCount: number;
  attester: string;
  attestedAt: number;
}

export interface SkillParent {
  parentSkillId: string;
  royaltyBps: number;
  royaltyPct: number;
  name: string | null;
  creator: string | null;
}

export interface Invocation {
  txHash: string;
  caller: string;
  amount: string;
  amountUsdc: string;
  invocationNumber: number;
  blockNumber: number;
  blockTimestamp: number;
}

export interface SkillDetail {
  skill: SkillSummary & {
    didHash: string;
    totalVolume: string;
    lastInvoked: number;
    blockNumber: number;
    bodyCached: boolean;
    manifest: unknown;
  };
  attestation: Attestation | null;
  parents: SkillParent[];
  recentInvocations: Invocation[];
  ipfsBody: string | null;
}

export interface Stats {
  totalSkills: number;
  activeSkills: number;
  totalInvocations: number;
  totalUsdcSettled: string;
  totalUsdcSettledRaw: string;
  top10ByEarnings: Array<{
    skillId: string;
    name: string | null;
    creator: string;
    totalInvocations: number;
    totalEarned: string;
  }>;
}

type SearchParams = {
  q?: string;
  tag?: string;
  category?: string;
  sort?: "recent" | "invocations" | "earned";
  limit?: number;
  offset?: number;
};

async function apiGet<T>(path: string, revalidate = 15): Promise<T | null> {
  try {
    const res = await fetch(`${base()}${path}`, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function getStats() {
  return apiGet<Stats>("/stats");
}

export async function searchSkills(p: SearchParams = {}): Promise<SkillList> {
  const qs = new URLSearchParams();
  if (p.q) qs.set("q", p.q);
  if (p.tag) qs.set("tag", p.tag);
  if (p.category) qs.set("category", p.category);
  if (p.sort) qs.set("sort", p.sort);
  qs.set("limit", String(p.limit ?? 24));
  qs.set("offset", String(p.offset ?? 0));
  return (await apiGet<SkillList>(`/skills?${qs.toString()}`)) ?? { items: [], total: 0, hasMore: false };
}

export function getSkill(skillId: string) {
  return apiGet<SkillDetail>(`/skills/${skillId}`, 5);
}

export interface CreatorSkills {
  items: SkillSummary[];
  totals: { count: number; totalInvocations: number; totalEarned: string; totalEarnedRaw: string };
}

export async function getCreatorSkills(address: string): Promise<CreatorSkills> {
  return (
    (await apiGet<CreatorSkills>(`/creators/${address}/skills`, 5)) ?? {
      items: [],
      totals: { count: 0, totalInvocations: 0, totalEarned: "0", totalEarnedRaw: "0" },
    }
  );
}

export interface CreatorEarnings {
  totalEarned: string;
  withdrawn: string;
  withdrawable: string | null;
  withdrawableRaw?: string;
  byCreatedSkill: Array<{
    skillId: string;
    name: string | null;
    totalInvocations: number;
    totalEarned: string;
    totalEarnedRaw?: string;
  }>;
}

export function getCreatorEarnings(address: string) {
  return apiGet<CreatorEarnings>(`/creators/${address}/earnings`, 5);
}
