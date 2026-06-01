"use client";

import Link from "next/link";
import { useState } from "react";
import { useAccount, useConfig, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { Loader2, Check, AlertTriangle, ArrowRight, Upload } from "lucide-react";
import type { Hex } from "viem";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ConnectWallet } from "@/components/connect-wallet";
import { parseManifest, type ParseResult } from "@/lib/manifest";
import { getPinataJwt, pinSkill } from "@/lib/pinata";
import {
  REGISTRY_ABI,
  REGISTRY_ADDRESS,
  didHash,
  parseUsdc,
  computeSkillId,
} from "@/lib/contract";

type Phase = "edit" | "review" | "publishing" | "done";

export default function PublishPage() {
  const { address, isConnected } = useAccount();
  const config = useConfig();
  const { writeContractAsync } = useWriteContract();

  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [phase, setPhase] = useState<Phase>("edit");
  const [step, setStep] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [skillId, setSkillId] = useState<Hex | null>(null);

  function onValidate() {
    const r = parseManifest(raw);
    setResult(r);
    if (r.manifest) setPhase("review");
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setRaw(await file.text());
  }

  async function onPublish() {
    if (!result?.manifest || !address) return;
    const jwt = getPinataJwt();
    if (!jwt) {
      setError("No Pinata JWT set. Add one in Settings first.");
      return;
    }
    const m = result.manifest;
    setError(null);
    setPhase("publishing");
    try {
      setStep("Pinning skill.md to IPFS…");
      const cid = await pinSkill(jwt, raw);

      setStep("Confirm registration in your wallet…");
      const parents = (m.parent_skills ?? []).map((p) => p.skill_id as Hex);
      const bps = (m.parent_skills ?? []).map((p) => p.royalty_bps);
      const hash = await writeContractAsync({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "registerSkill",
        args: [cid, didHash(m.author_did), parseUsdc(m.price_per_call_usdc), parents, bps],
      });

      setStep("Waiting for confirmation…");
      await waitForTransactionReceipt(config, { hash });
      setSkillId(computeSkillId(cid, m.author_did, address));
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message.slice(0, 200) : "Publish failed");
      setPhase("review");
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="font-display text-3xl font-semibold">Publish a skill</h1>
      <p className="mt-1 text-sm text-muted">
        Paste a <code>skill.md</code> (YAML frontmatter + body). It&apos;s pinned to IPFS and
        registered on-chain from your connected wallet.
      </p>

      <Stepper phase={phase} />

      {phase === "edit" && (
        <Card className="mt-6">
          <CardBody className="space-y-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted hover:text-foreground">
              <Upload className="h-4 w-4" />
              <span>Upload skill.md</span>
              <input type="file" accept=".md,.markdown,text/markdown" onChange={onFile} className="hidden" />
            </label>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={"---\nname: my-skill\nversion: 0.1.0\nauthor_did: did:key:z…\ndescription: …\nprice_per_call_usdc: '0.005'\n---\n\n# My skill\n…"}
              className="h-72 w-full rounded-xl border border-border bg-surface p-4 font-mono text-xs text-foreground focus-visible:border-accent/60 focus-visible:outline-none"
            />
            {result?.errors.length ? (
              <ul className="space-y-1 rounded-lg border border-danger/30 bg-danger/5 p-3 text-xs text-danger">
                {result.errors.map((er, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    {er}
                  </li>
                ))}
              </ul>
            ) : null}
            <Button onClick={onValidate} disabled={!raw.trim()}>
              Validate <ArrowRight className="h-4 w-4" />
            </Button>
          </CardBody>
        </Card>
      )}

      {(phase === "review" || phase === "publishing") && result?.manifest && (
        <Card className="mt-6">
          <CardBody className="space-y-4">
            <Field label="Name" value={result.manifest.name} />
            <Field label="Version" value={result.manifest.version} />
            <Field label="Price per call" value={`${result.manifest.price_per_call_usdc} USDC`} accent />
            <Field label="Author DID" value={result.manifest.author_did} mono />
            <Field
              label="Parents"
              value={
                result.manifest.parent_skills?.length
                  ? `${result.manifest.parent_skills.length} (royalty ${result.manifest.parent_skills.reduce((a, p) => a + p.royalty_bps, 0) / 100}%)`
                  : "none"
              }
            />

            {!isConnected ? (
              <div className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm text-muted">
                Connect a wallet to publish <ConnectWallet />
              </div>
            ) : phase === "publishing" ? (
              <div className="flex items-center gap-2 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> {step}
              </div>
            ) : (
              <div className="flex gap-3">
                <Button onClick={onPublish}>Publish on-chain</Button>
                <Button variant="secondary" onClick={() => setPhase("edit")}>
                  Back to edit
                </Button>
              </div>
            )}
            {error && <p className="text-xs text-danger">{error}</p>}
          </CardBody>
        </Card>
      )}

      {phase === "done" && skillId && (
        <Card className="mt-6 border-accent/40">
          <CardBody className="space-y-3 text-center">
            <Check className="mx-auto h-8 w-8 text-accent" />
            <div className="font-display text-xl font-semibold">Published!</div>
            <p className="break-all font-mono text-xs text-muted">{skillId}</p>
            <Link href={`/skill/${skillId}`}>
              <Button>View skill</Button>
            </Link>
            <p className="text-xs text-muted-foreground">
              The indexer will pick it up within ~12s and fetch the body from IPFS.
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function Stepper({ phase }: { phase: Phase }) {
  const steps = ["Edit", "Review", "Publish"];
  const active = phase === "edit" ? 0 : phase === "review" ? 1 : 2;
  return (
    <div className="mt-6 flex items-center gap-2 text-xs">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <span
            className={`grid h-6 w-6 place-items-center rounded-full font-mono ${
              i <= active ? "bg-accent text-accent-foreground" : "border border-border text-muted-foreground"
            }`}
          >
            {i + 1}
          </span>
          <span className={i <= active ? "text-foreground" : "text-muted-foreground"}>{s}</span>
          {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-border" />}
        </div>
      ))}
    </div>
  );
}

function Field({ label, value, accent, mono }: { label: string; value: string; accent?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm ${accent ? "text-accent" : ""} ${mono ? "break-all font-mono text-xs" : ""}`}>
        {value}
      </span>
    </div>
  );
}
