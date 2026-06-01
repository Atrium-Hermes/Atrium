import Link from "next/link";
import { CheckCircle2, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { EncryptedBody } from "@/components/encrypted-body";
import { InvokeButton } from "@/components/invoke-button";
import { FaucetButton } from "@/components/faucet-button";
import { getSkill } from "@/lib/indexer";
import { truncate, relativeTime, usdc } from "@/lib/format";

export const revalidate = 5;

export default async function SkillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getSkill(id);

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-24 text-center">
        <h1 className="text-xl font-semibold">Skill not found</h1>
        <p className="mt-2 text-sm text-muted">
          It may not be indexed yet, or the id is wrong.{" "}
          <Link href="/search" className="text-accent hover:underline">
            Browse all skills
          </Link>
        </p>
      </div>
    );
  }

  const { skill, attestation, parents, recentInvocations, ipfsBody } = data;

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              {skill.name || "Untitled skill"}
            </h1>
            {skill.active ? (
              <Badge className="border-accent/40 text-accent">active</Badge>
            ) : (
              <Badge className="border-danger/40 text-danger">inactive</Badge>
            )}
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{skill.skillId}</p>
        </div>
      </div>

      <p className="mt-4 max-w-2xl text-muted">{skill.description ?? "No description indexed."}</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {skill.tags.map((t) => (
          <Link key={t} href={`/search?tag=${encodeURIComponent(t)}`}>
            <Badge className="hover:border-accent/50 hover:text-accent">{t}</Badge>
          </Link>
        ))}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Body */}
        <div className="order-2 lg:order-1">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            <FileText className="h-4 w-4" /> Skill body
          </h2>
          {ipfsBody ? (
            <EncryptedBody skillId={skill.skillId} body={ipfsBody} />
          ) : (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Body not yet fetched from IPFS.
            </div>
          )}

          {recentInvocations.length > 0 && (
            <div className="mt-12">
              <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Recent invocations
              </h2>
              <div className="divide-y divide-border rounded-xl border border-border">
                {recentInvocations.map((inv) => (
                  <div key={inv.txHash + inv.invocationNumber} className="flex items-center justify-between px-4 py-3 text-sm">
                    <span className="font-mono text-muted">{truncate(inv.caller)}</span>
                    <span className="font-mono text-accent">{inv.amountUsdc} USDC</span>
                    <span className="text-muted-foreground">{relativeTime(inv.blockTimestamp)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Meta panel */}
        <aside className="order-1 space-y-4 lg:order-2">
          <Card>
            <CardBody className="space-y-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Price per call</div>
                <div className="mt-1 font-mono text-2xl text-accent">{usdc(skill.pricePerCall)}</div>
              </div>
              <InvokeButton
                skillId={skill.skillId}
                priceRaw={skill.pricePerCallRaw}
                price={skill.pricePerCall}
                active={skill.active}
              />
              <FaucetButton variant="secondary" />
              <p className="text-center text-[11px] text-muted-foreground">
                Need test USDC? Claim 1,000 mUSDC from the faucet first.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3 text-sm">
              <Row label="Invocations" value={String(skill.totalInvocations)} />
              <Row label="Total earned" value={usdc(skill.totalEarned)} accent />
              <Row label="Volume" value={usdc(skill.totalVolume)} />
              <Row label="Created" value={relativeTime(skill.createdAt)} />
              <Row label="Last invoked" value={skill.lastInvoked ? relativeTime(skill.lastInvoked) : "—"} />
              <div className="border-t border-border pt-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Creator</div>
                <Link
                  href={`/creator/${skill.creator}`}
                  className="mt-1 block font-mono text-sm text-foreground hover:text-accent"
                >
                  {truncate(skill.creator)}
                </Link>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">CID</div>
                <div className="mt-1 break-all font-mono text-xs text-muted">{skill.cid}</div>
              </div>
            </CardBody>
          </Card>

          {attestation && (
            <Card>
              <CardBody className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-accent">
                  <CheckCircle2 className="h-4 w-4" /> Benchmark attested
                </div>
                <Row label="Success rate" value={`${(attestation.successRate / 100).toFixed(1)}%`} />
                <Row label="Samples" value={String(attestation.sampleCount)} />
                <Row label="Attester" value={truncate(attestation.attester)} mono />
              </CardBody>
            </Card>
          )}

          {parents.length > 0 && (
            <Card>
              <CardBody className="space-y-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Derived from
                </div>
                {parents.map((p) => (
                  <Link
                    key={p.parentSkillId}
                    href={`/skill/${p.parentSkillId}`}
                    className="flex items-center justify-between text-sm hover:text-accent"
                  >
                    <span>{p.name ?? truncate(p.parentSkillId, 8, 6)}</span>
                    <span className="font-mono text-muted">{p.royaltyPct}%</span>
                  </Link>
                ))}
              </CardBody>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, accent, mono }: { label: string; value: string; accent?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${accent ? "text-accent" : "text-foreground"} ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </span>
    </div>
  );
}
