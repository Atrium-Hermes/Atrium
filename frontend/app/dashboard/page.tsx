"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConnectWallet } from "@/components/connect-wallet";
import { WithdrawCard } from "@/components/withdraw-card";
import { DeactivateButton } from "@/components/deactivate-button";
import { getCreatorSkills } from "@/lib/indexer";
import { usdc, truncate } from "@/lib/format";

export default function DashboardPage() {
  const { address, isConnected } = useAccount();

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["creator-skills", address],
    queryFn: () => getCreatorSkills(address!),
    enabled: !!address,
  });

  if (!isConnected || !address) {
    return (
      <div className="mx-auto max-w-md px-5 py-28 text-center">
        <h1 className="font-display text-2xl font-semibold">Creator dashboard</h1>
        <p className="mt-2 text-sm text-muted">Connect your wallet to view your skills and earnings.</p>
        <div className="mt-6 flex justify-center">
          <ConnectWallet />
        </div>
      </div>
    );
  }

  const skills = data?.items ?? [];

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Dashboard</h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{address}</p>
        </div>
        <Link href="/dashboard/publish">
          <Button>
            <Plus className="h-4 w-4" /> Publish skill
          </Button>
        </Link>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <WithdrawCard address={address} />
        <Card>
          <CardBody className="flex h-full flex-col justify-center gap-1">
            <div className="eyebrow text-muted-foreground">Lifetime earned</div>
            <div className="font-mono text-2xl text-accent">
              {usdc(data?.totals.totalEarned ?? "0")}
            </div>
            <div className="mt-1 text-sm text-muted">
              {data?.totals.count ?? 0} skill{(data?.totals.count ?? 0) === 1 ? "" : "s"} ·{" "}
              {data?.totals.totalInvocations ?? 0} invocations
            </div>
          </CardBody>
        </Card>
      </div>

      <h2 className="font-display mb-4 mt-12 text-xl font-semibold">Your skills</h2>
      {isLoading ? (
        <div className="rounded-2xl border border-border p-10 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : skills.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong p-12 text-center text-sm text-muted-foreground">
          No skills yet.{" "}
          <Link href="/dashboard/publish" className="text-accent hover:underline">
            Publish your first skill
          </Link>
          .
        </div>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Skill</th>
                <th className="px-5 py-3 font-medium">Price</th>
                <th className="px-5 py-3 font-medium">Invocations</th>
                <th className="px-5 py-3 font-medium">Earned</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {skills.map((s) => (
                <tr key={s.skillId} className="hover:bg-card-elevated">
                  <td className="px-5 py-3">
                    <Link href={`/skill/${s.skillId}`} className="font-medium hover:text-accent">
                      {s.name ?? truncate(s.skillId, 8, 6)}
                    </Link>
                  </td>
                  <td className="px-5 py-3 font-mono text-accent">{s.pricePerCall}</td>
                  <td className="px-5 py-3">{s.totalInvocations}</td>
                  <td className="px-5 py-3 font-mono">{s.totalEarned}</td>
                  <td className="px-5 py-3">
                    {s.active ? (
                      <Badge className="border-accent/40 text-accent">active</Badge>
                    ) : (
                      <Badge className="border-danger/40 text-danger">inactive</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {s.active && <DeactivateButton skillId={s.skillId} onDone={refetch} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
