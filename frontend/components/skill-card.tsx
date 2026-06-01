import Link from "next/link";
import { Zap } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { truncate, compact } from "@/lib/format";
import type { SkillSummary } from "@/lib/indexer";

export function SkillCard({ skill }: { skill: SkillSummary }) {
  return (
    <Link href={`/skill/${skill.skillId}`} className="group block">
      <Card className="lift h-full hover:border-accent/60 hover:bg-card-elevated">
        <CardBody className="flex h-full flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate font-medium leading-tight text-foreground group-hover:text-accent">
                {skill.name || "Untitled skill"}
              </h3>
              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                {truncate(skill.skillId, 8, 6)}
              </p>
            </div>
            {!skill.active && <Badge className="border-danger/40 text-danger">inactive</Badge>}
          </div>

          <p className="line-clamp-2 text-sm text-muted">
            {skill.description ?? "No description indexed yet."}
          </p>

          <div className="mt-auto flex flex-wrap gap-1.5">
            {skill.tags.slice(0, 3).map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
            <span className="font-mono text-accent">{skill.pricePerCall} USDC</span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Zap className="h-3.5 w-3.5" />
              {compact(skill.totalInvocations)}
            </span>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}
