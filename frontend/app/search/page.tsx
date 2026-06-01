import { Suspense } from "react";
import { SearchBox } from "@/components/search-box";
import { SkillCard } from "@/components/skill-card";
import { searchSkills } from "@/lib/indexer";

export const revalidate = 10;

type SP = { q?: string; tag?: string; sort?: string };

export default async function SearchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const sort = (["recent", "invocations", "earned"].includes(sp.sort ?? "") ? sp.sort : "recent") as
    | "recent"
    | "invocations"
    | "earned";

  const { items, total } = await searchSkills({ q: sp.q, tag: sp.tag, sort, limit: 48 });

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Browse skills</h1>
      <p className="mt-1 text-sm text-muted">
        {total} skill{total === 1 ? "" : "s"} indexed
        {sp.q ? ` · matching “${sp.q}”` : ""}
        {sp.tag ? ` · tag “${sp.tag}”` : ""}
      </p>

      <div className="mt-6">
        <Suspense fallback={<div className="h-28" />}>
          <SearchBox />
        </Suspense>
      </div>

      <div className="mt-8">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            No matching skills found.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((s) => (
              <SkillCard key={s.skillId} skill={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
