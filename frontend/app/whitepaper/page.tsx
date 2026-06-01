import type { Metadata } from "next";
import { Download, FileText } from "lucide-react";
import { GITHUB_URL } from "@/lib/links";

export const metadata: Metadata = {
  title: "Whitepaper — Atrium",
  description:
    "The Atrium whitepaper: a skill provenance and royalty marketplace for AI agents — manifest format, the on-chain settlement contract and its conservation invariants, the royalty model, threat model, and architecture.",
};

const PDF = "/atrium-whitepaper.pdf";

const CHAPTERS = [
  ["01", "Introduction", "The skill-economy thesis and why the value stays trapped today."],
  ["02", "Prior work", "Hermes, OpenClaude, MCP, and existing registries — what they do and don't provide."],
  ["03", "Protocol", "Skill manifests, DID identity, content addressing, and canonical signing."],
  ["04", "Contract", "AtriumRegistry design, conservation invariants, and the pull-payment pattern."],
  ["05", "Economics", "Per-invocation pricing, the royalty cascade, and the tokenless thesis."],
  ["06", "Security", "Threat model, mitigations, and open issues."],
  ["07", "Deployment", "Base rationale, indexer + interface architecture, and governance."],
  ["08", "Comparison", "Atrium vs npm, PyPI, Hugging Face Hub, the GPT Store, and agentskills.io."],
  ["09", "Future work", "Encrypted bodies, ZK benchmark proofs, and cross-chain reputation."],
];

export default function WhitepaperPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <div className="eyebrow text-muted-foreground">Whitepaper</div>
      <h1 className="font-display mt-2 text-3xl font-semibold md:text-4xl">
        A Skill Provenance and Royalty Marketplace for AI Agents
      </h1>
      <p className="mt-4 max-w-3xl text-lg text-muted">
        AI agent runtimes increasingly generate reusable <em>skills</em>, but those skills are
        trapped inside the runtime that produced them — no portable record of authorship, no way to
        verify what a consumer is about to run, and no mechanism to compensate authors when their
        work is reused. This paper specifies the manifest format, the on-chain settlement contract
        and its conservation invariants, the royalty model, the threat model, and the off-chain
        architecture, and argues that a tokenless, per-invocation design is the right primitive for
        an emerging skill economy.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <a
          href={PDF}
          download
          className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground shadow-[0_8px_30px_-12px_rgba(47,56,38,0.5)] transition-colors hover:bg-accent-hover"
        >
          <Download className="h-4 w-4" />
          Download PDF
        </a>
        <a
          href={PDF}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-border-strong px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface"
        >
          <FileText className="h-4 w-4" />
          Open in new tab
        </a>
        <span className="font-mono text-xs text-muted-foreground">16 pages · PDF · v0.1</span>
      </div>

      {/* Inline reader (desktop). PDFs embed poorly on mobile, so the buttons above are the primary path. */}
      <object
        data={`${PDF}#view=FitH`}
        type="application/pdf"
        className="mt-8 hidden h-[82vh] w-full rounded-2xl border border-border bg-card md:block"
        aria-label="Atrium whitepaper PDF"
      >
        <p className="p-6 text-sm text-muted">
          Your browser can’t display the embedded PDF.{" "}
          <a href={PDF} download className="text-accent hover:underline">
            Download it instead
          </a>
          .
        </p>
      </object>

      <section className="mt-12">
        <div className="eyebrow text-muted-foreground">What’s inside</div>
        <div className="mt-4 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-2">
          {CHAPTERS.map(([n, title, desc]) => (
            <div key={n} className="bg-card p-5">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-sm font-semibold text-accent">{n}</span>
                <span className="font-medium">{title}</span>
              </div>
              <p className="mt-1.5 text-sm text-muted">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-10 text-sm text-muted-foreground">
        The whitepaper source (Markdown + diagrams) lives in the{" "}
        <a href={`${GITHUB_URL}/tree/main/whitepaper`} target="_blank" rel="noreferrer" className="text-accent hover:underline">
          repository
        </a>
        ; the PDF is built reproducibly in CI.
      </p>
    </div>
  );
}
