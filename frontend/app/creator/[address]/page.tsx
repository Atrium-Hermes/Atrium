import { SkillCard } from "@/components/skill-card";
import { StatTile } from "@/components/stat-tile";
import { getCreatorSkills, getCreatorEarnings } from "@/lib/indexer";
import { truncate, usdc, compact } from "@/lib/format";

export const revalidate = 10;

export default async function CreatorPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const [skills, earnings] = await Promise.all([
    getCreatorSkills(address),
    getCreatorEarnings(address),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <div className="eyebrow text-muted-foreground">Creator</div>
      <h1 className="font-display mt-2 break-all text-2xl font-semibold md:text-3xl">
        {truncate(address, 10, 8)}
      </h1>
      <p className="mt-1 font-mono text-xs text-muted-foreground">{address}</p>

      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Skills" value={compact(skills.totals.count)} />
        <StatTile label="Invocations" value={compact(skills.totals.totalInvocations)} />
        <StatTile label="Total earned" value={usdc(skills.totals.totalEarned)} accent />
        <StatTile label="Withdrawn" value={usdc(earnings?.withdrawn ?? "0")} />
      </div>

      <h2 className="font-display mt-12 mb-5 text-xl font-semibold">Published skills</h2>
      {skills.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong p-12 text-center text-sm text-muted-foreground">
          This creator hasn’t published any indexed skills yet.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {skills.items.map((s) => (
            <SkillCard key={s.skillId} skill={s} />
          ))}
        </div>
      )}
    </div>
  );
}
