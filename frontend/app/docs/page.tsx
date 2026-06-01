import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { GITHUB_URL } from "@/lib/links";

export const metadata: Metadata = {
  title: "Docs — Atrium",
  description: "How Atrium works: skill manifests, identity, the registry contract, royalties, publishing, invoking, the indexer API, and the trust model.",
};

const TOC = [
  ["overview", "Overview"],
  ["manifest", "Skill manifest"],
  ["identity", "Identity & content addressing"],
  ["contract", "The registry contract"],
  ["royalties", "Royalties & fees"],
  ["publish", "Publishing a skill"],
  ["invoke", "Invoking a skill"],
  ["indexer", "Indexer API"],
  ["encrypted", "Encrypted bodies"],
  ["security", "Security & trust"],
  ["run", "Run it locally"],
  ["faq", "FAQ"],
];

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
        {/* TOC */}
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <div className="eyebrow text-muted-foreground">On this page</div>
            <nav className="mt-3 space-y-1.5 text-sm">
              {TOC.map(([id, label]) => (
                <a key={id} href={`#${id}`} className="block text-muted transition-colors hover:text-accent">
                  {label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* Body */}
        <div className="min-w-0">
          <div className="eyebrow text-muted-foreground">Documentation</div>
          <h1 className="font-display mt-2 text-3xl font-semibold md:text-4xl">How Atrium works</h1>
          <p className="mt-4 text-lg text-muted">
            Atrium is the economic and identity layer beneath existing agent runtimes — not a new
            runtime. A skill is to an AI agent what an npm package is to a Node program, but signed
            by its author, addressed by its content, and paid per call.
          </p>

          <Section id="overview" title="Overview">
            <p>
              Agent runtimes such as Hermes and OpenClaude generate reusable <em>skills</em> —
              self-contained capabilities written as Markdown with structured metadata. On their own
              those skills are trapped locally: no portable authorship, no integrity guarantee, no
              way to pay the author. Atrium supplies three missing primitives — provenance,
              integrity, and settlement — as a thin layer that composes with any runtime via MCP.
            </p>
            <p className="mt-3">The stack:</p>
            <Ul items={[
              "A non-upgradeable Solidity contract on Base (the registry + settlement).",
              "A CLI that signs, pins to IPFS, and registers skills.",
              "An MCP server so agents can discover and invoke skills as tools.",
              "A read-only indexer (SQLite + REST) and this web app.",
            ]} />
          </Section>

          <Section id="manifest" title="Skill manifest">
            <p>
              A skill is a Markdown file with YAML frontmatter; the body below is the prompt or
              procedure the agent reads. The frontmatter is a superset of the agentskills.io format:
            </p>
            <Code>{`---
name: pdf-toolkit
version: 0.1.0
author_did: did:key:z6Mk…
description: Read, merge, split, OCR and fill PDF files.
tags: [pdf, extraction, ocr]
categories: [document-processing]
runtime: prompt-only
price_per_call_usdc: '0.004'
parent_skills: []          # or [{ skill_id: 0x…, royalty_bps: 1500 }]
created_at: '2026-05-31T00:00:00Z'
derivation_method: imported   # hermes-loop | manual | openclaude | imported
---

# PDF Toolkit
…the skill body the agent reads…`}</Code>
            <p className="mt-3">
              Prices are decimal USDC strings (USDC has <Mono>6</Mono> decimals). Each parent is a{" "}
              <Mono>(skill_id, royalty_bps)</Mono> pair; combined parent royalties cannot exceed 50%.
            </p>
          </Section>

          <Section id="identity" title="Identity & content addressing">
            <p>
              Authors are identified by a W3C <Mono>did:key</Mono> over an Ed25519 keypair — durable
              across wallet rotations. The skill body is pinned to IPFS, so its CID is a hash of its
              bytes: <strong>identity equals integrity</strong>. The author signs a canonical hash of
              the manifest; anyone can verify the signature against the DID without touching the chain.
            </p>
            <p className="mt-3">The on-chain skill id is deterministic and predictable before you register:</p>
            <Code>{`skillId = keccak256(abi.encodePacked(cid, didHash, creator))
didHash = SHA-256(did)`}</Code>
          </Section>

          <Section id="contract" title="The registry contract">
            <p>
              A ~300-line non-upgradeable contract records skills and routes payments. On{" "}
              <Mono>invokeSkill</Mono> it pulls the USDC price once, takes the protocol fee, pays
              declared parent royalties, and credits the remainder to the creator — all to an internal
              ledger that recipients later <Mono>withdraw</Mono> (the pull-payment pattern):
            </p>
            <Code>{`protocolCut   = price * protocolFeeBps / 10000   // 250 bps = 2.5%
distributable = price - protocolCut
for each declared parent i:
    parentCut = distributable * parentBps[i] / 10000
    withdrawable[parent.creator] += parentCut       // credit, don't send
withdrawable[skill.creator] += remainder            // sum of credits == price`}</Code>
            <p className="mt-3">
              No funds are sent during invocation; recipients pull their balance. The sum of credits
              equals the price exactly (<em>conservation of funds</em>), and re-entry yields no
              double-spend.
            </p>
          </Section>

          <Section id="royalties" title="Royalties & fees">
            <p>
              A derived skill declares its <em>direct</em> parents with basis-point shares. Royalties
              are paid only to declared, direct parents — never propagated up an inferred ancestry.
              That keeps each author&apos;s revenue predictable and the per-call cost gas-bounded
              (<Mono>O(parents)</Mono>, not <Mono>O(depth)</Mono>).
            </p>
            <p className="mt-3">
              <strong>Worked example.</strong> A→B→C; Dave prices C at <Mono>P</Mono>, declaring B as a
              parent at 15%. On invoke(C) with a 2.5% fee: treasury gets <Mono>0.025P</Mono>; Alice
              (author of B) gets <Mono>0.146P</Mono>; Dave gets the remaining <Mono>0.829P</Mono>. Carol
              (author of A) earns nothing unless Dave <em>also</em> declares A. The protocol fee is
              2.5%, hard-capped at 5%; settlement is USDC, and there is no protocol token.
            </p>
          </Section>

          <Section id="publish" title="Publishing a skill">
            <p>Via the CLI (signs with your DID, pins to IPFS, registers on-chain):</p>
            <Code>{`atrium init                      # generate DID + wallet (~/.atrium)
# fund the wallet with Base Sepolia ETH + USDC; set PINATA_JWT
atrium publish ./my-skill        # → skillId, IPFS CID, tx hash`}</Code>
            <p className="mt-3">
              Or from the web: the{" "}
              <Link href="/dashboard/publish" className="text-accent hover:underline">publisher</Link>{" "}
              parses your <Mono>skill.md</Mono>, pins it to IPFS with your Pinata JWT, and calls{" "}
              <Mono>registerSkill</Mono> from your browser wallet.
            </p>
          </Section>

          <Section id="invoke" title="Invoking a skill">
            <p>
              A consumer approves the USDC price and calls <Mono>invokeSkill(skillId)</Mono>; the
              contract splits the payment in one transaction. From an agent, the MCP server exposes
              discovery + invocation as tools, so any MCP-capable runtime can search Atrium and run a
              skill the same way it calls any other tool. In the web app, the{" "}
              <strong>Invoke</strong> button on a skill page runs approve → pay → unlock.
            </p>
          </Section>

          <Section id="indexer" title="Indexer API">
            <p>The web app reads everything from a read-only REST indexer (never a chain RPC per page load):</p>
            <table className="mt-4 w-full border-collapse text-sm">
              <tbody>
                {[
                  ["GET /skills?q=&tag=&sort=", "search / browse (active only; ?includeInactive=1 to include)"],
                  ["GET /skills/:id", "skill detail + attestation + parents + recent invocations + body"],
                  ["GET /skills/:id/body", "cached skill markdown"],
                  ["GET /creators/:addr/skills", "a creator's skills + totals"],
                  ["GET /creators/:addr/earnings", "lifetime earned, withdrawn, withdrawable"],
                  ["GET /stats", "totals + top earners"],
                  ["GET /recent?type=", "recent skills / invocations / attestations"],
                ].map(([ep, desc]) => (
                  <tr key={ep} className="border-b border-border">
                    <td className="py-2 pr-4 align-top font-mono text-xs text-foreground">{ep}</td>
                    <td className="py-2 text-muted">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section id="encrypted" title="Encrypted bodies (paywall)">
            <p>
              A skill can be published with <Mono>--encrypt</Mono>: the body is sealed with
              AES-256-GCM and <strong>only the ciphertext is pinned to IPFS</strong>. The content key
              is held by a <em>key-service</em> that releases it to a wallet only after verifying
              that wallet has an on-chain <Mono>SkillInvoked</Mono> (i.e. paid). The consumer then
              decrypts in their own browser. This removes the free-riding-via-public-fetch gap.
            </p>
            <p className="mt-3">
              Honest trust note: the MVP key-service is <em>trust-minimized, not trustless</em> — the
              operator could leak a key. The trustless upgrade is threshold decryption (a committee /
              network like Lit) keyed on the same on-chain payment receipt; the envelope and the
              pay-to-decrypt flow stay identical.
            </p>
          </Section>

          <Section id="security" title="Security & trust">
            <p>
              Content addressing prevents body substitution; the Ed25519 signature proves authorship;
              the pull-payment pattern prevents griefing and re-entrancy gain; the owner can only
              adjust the fee (within the cap) and the treasury — nothing touches user funds. Open
              issues: IPFS availability, free-riding via public fetch, and sybil attestations.
            </p>
            <p className="mt-3">
              Provenance tells you <em>who</em> wrote a skill and <em>that it is unchanged</em> — not
              that it is safe to run. Sandboxing and capability control belong to the runtime, not the
              marketplace.
            </p>
          </Section>

          <Section id="run" title="Run it locally">
            <Code>{`# 1. deploy the contract to Base Sepolia
forge script scripts/DeployAtrium.s.sol --rpc-url base_sepolia --broadcast

# 2. indexer (REST API on :3001)
cd indexer && cp .env.example .env   # set ATRIUM_REGISTRY + deploy block
npm run dev

# 3. web app (:3000)
cd frontend && cp .env.example .env.local
npm run dev`}</Code>
          </Section>

          <Section id="faq" title="FAQ">
            <Faq q="Is there a token?" a="No. Settlement is USDC on Base. There is no governance token, no staking requirement, and no liquidity mining — the protocol is tokenless by design." />
            <Faq q="What does it cost to use?" a="Consumers pay each skill's per-call USDC price. The protocol takes a 2.5% fee (hard-capped at 5%). Gas on Base is sub-cent." />
            <Faq q="Which chains?" a="Base (Sepolia today, mainnet next). DIDs make authorship portable across future chains." />
            <Faq q="Can a skill be removed?" a="A creator can deactivate a skill (one-way), which stops new invocations. The IPFS bytes persist; deactivation is delisting, not deletion." />
          </Section>

          <div className="mt-12 flex flex-wrap gap-4 border-t border-border pt-6">
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
              Source on GitHub <ArrowRight className="h-3.5 w-3.5" />
            </a>
            <Link href="/search" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
              Browse skills <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link href="/dashboard/publish" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
              Publish a skill <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-12 scroll-mt-24">
      <h2 className="font-display text-xl font-semibold md:text-2xl">{title}</h2>
      <div className="mt-3 leading-relaxed text-muted">{children}</div>
    </section>
  );
}

function Ul({ items }: { items: string[] }) {
  return (
    <ul className="mt-2 list-disc space-y-1.5 pl-5">
      {items.map((it) => (
        <li key={it}>{it}</li>
      ))}
    </ul>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-xl border border-border bg-card-elevated p-4 font-mono text-[0.8rem] leading-relaxed text-foreground">
      {children}
    </pre>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">{children}</code>;
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div className="mt-4 rounded-xl border border-border bg-card p-4">
      <div className="font-medium text-foreground">{q}</div>
      <p className="mt-1 text-sm text-muted">{a}</p>
    </div>
  );
}
