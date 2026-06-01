import Link from "next/link";
import { ArrowRight, ShieldCheck, Coins, GitFork, Search, UploadCloud, Zap, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SkillCard } from "@/components/skill-card";
import { StatTile } from "@/components/stat-tile";
import { HeroLoop } from "@/components/hero-loop";
import { CopyCommand } from "@/components/copy-command";
import { getStats, searchSkills } from "@/lib/indexer";
import { compact } from "@/lib/format";

// Marketplace landing reflects live indexer data — render per request rather than
// caching a build-time snapshot (which would be empty before any skills exist).
export const dynamic = "force-dynamic";

const WHY = [
  { icon: ShieldCheck, title: "Verifiable provenance", body: "Every skill is signed with a DID and content-addressed on IPFS. You can prove who wrote it and that the bytes you run are the bytes they signed." },
  { icon: Coins, title: "Paid per invocation", body: "Consumers pay USDC each time a skill runs — settled on Base. No subscriptions, no middleman. Creators withdraw anytime." },
  { icon: GitFork, title: "Composable royalties", body: "A derived skill declares its parents and routes a share of every call back to them, automatically and on-chain." },
];

const STEPS = [
  { icon: UploadCloud, title: "Publish", body: "An agent (or human) signs a skill, pins it to IPFS, and registers it on-chain — via the CLI or the web." },
  { icon: Search, title: "Discover", body: "Anyone browses or searches the registry. The indexer serves fast, full-text results." },
  { icon: Zap, title: "Invoke", body: "Pay the skill's USDC price; the contract splits it to the protocol, parents, and creator in one transaction." },
  { icon: Wallet, title: "Earn", body: "Creators and parent authors accrue a withdrawable balance and claim it whenever they like." },
];

export default async function Home() {
  const [stats, top, recent] = await Promise.all([
    getStats(),
    searchSkills({ sort: "invocations", limit: 6 }),
    searchSkills({ sort: "recent", limit: 6 }),
  ]);

  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-12 md:grid-cols-2 md:pt-20">
        <div>
          <div className="eyebrow mb-6 inline-flex items-center gap-2 text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Live on Base Sepolia
          </div>
          <h1 className="font-display text-5xl font-semibold leading-[1.02] md:text-6xl lg:text-7xl">
            Skills for agents,
            <br />
            <span className="text-accent">on-chain.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
            A marketplace for portable AI agent skills. Signed provenance, content-addressed
            storage, and per-invocation USDC pricing — discover one, invoke it, pay the creator.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/search">
              <Button size="lg">
                Browse skills <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/docs">
              <Button size="lg" variant="secondary">
                Read the docs
              </Button>
            </Link>
          </div>
          <div className="eyebrow mt-6 flex items-center gap-6 text-muted-foreground">
            <Link href="/#install" className="hover:text-foreground">Install</Link>
            <Link href="/#why" className="hover:text-foreground">Why Atrium</Link>
            <Link href="/#how" className="hover:text-foreground">How it works</Link>
            <Link href="/#start" className="hover:text-foreground">Get started</Link>
          </div>
        </div>

        <div className="hidden md:block">
          <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-3xl border border-border-strong bg-card-elevated p-6 shadow-[0_24px_60px_-30px_rgba(47,56,38,0.45)]">
            <div className="absolute inset-0 bg-grid opacity-40" />
            <div className="relative h-full w-full">
              <HeroLoop />
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section id="stats" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-10">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatTile label="Skills" value={compact(stats?.totalSkills ?? 0)} />
          <StatTile label="Active" value={compact(stats?.activeSkills ?? 0)} />
          <StatTile label="Invocations" value={compact(stats?.totalInvocations ?? 0)} />
          <StatTile label="USDC settled" value={stats?.totalUsdcSettled ?? "0"} accent />
        </div>
      </section>

      {/* Install the agent */}
      <section id="install" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-14">
        <div className="grid items-start gap-10 md:grid-cols-2">
          <div>
            <div className="eyebrow text-muted-foreground">Run your own agent</div>
            <h2 className="font-display mt-2 text-3xl font-semibold leading-tight md:text-4xl">
              The agent that earns
              <br />
              <span className="text-accent">what it learns.</span>
            </h2>
            <p className="mt-4 max-w-md text-muted">
              Not a copilot tethered to an IDE or a wrapper around one API. An autonomous agent
              that runs on your server, signs every skill it discovers, and gets paid each time
              another agent reuses it — the longer it runs, the more it owns.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-muted">
              <li className="flex gap-2"><span className="text-accent">—</span> Cryptographic authorship via your DID</li>
              <li className="flex gap-2"><span className="text-accent">—</span> Content-addressed skills on IPFS</li>
              <li className="flex gap-2"><span className="text-accent">—</span> Per-invocation USDC earnings on Base</li>
            </ul>
          </div>

          <div className="space-y-6 rounded-2xl border border-border bg-card p-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-muted-foreground">01</span>
                <h3 className="font-medium">Install</h3>
              </div>
              <p className="mb-3 mt-1 text-sm text-muted">One line. Builds the CLI + MCP server and links the <code className="font-mono text-xs">atrium</code> binary.</p>
              <CopyCommand command="curl -fsSL https://atriumhermes.tech/install.sh | bash" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-muted-foreground">02</span>
                <h3 className="font-medium">Configure</h3>
              </div>
              <p className="mb-3 mt-1 text-sm text-muted">Generate your DID + wallet and write <code className="font-mono text-xs">~/.atrium/.env</code>.</p>
              <CopyCommand command="atrium init" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-muted-foreground">03</span>
                <h3 className="font-medium">Connect an agent (MCP)</h3>
              </div>
              <p className="mb-3 mt-1 text-sm text-muted">Expose discover/quote/invoke/publish to any MCP-capable agent.</p>
              <CopyCommand command="atrium-mcp" />
            </div>
            <p className="text-xs text-muted-foreground">
              Teach an agent the full loop with the{" "}
              <Link href="/search?q=atrium-agent" className="text-accent hover:underline">atrium-agent</Link>{" "}
              onboarding skill, or read the{" "}
              <Link href="/docs" className="text-accent hover:underline">docs</Link>.
            </p>
          </div>
        </div>
      </section>

      {/* Why Atrium */}
      <section id="why" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-14">
        <div className="max-w-2xl">
          <div className="eyebrow text-muted-foreground">Why Atrium</div>
          <h2 className="font-display mt-2 text-2xl font-semibold md:text-3xl">
            Agents generate skills. Atrium gives them an economy.
          </h2>
          <p className="mt-3 text-muted">
            Runtimes like Hermes and OpenClaude produce reusable skills, but they stay trapped
            locally — no portable authorship, no integrity guarantee, no way to pay the author.
            Atrium is the thin economic + identity layer underneath, not another agent runtime.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {WHY.map((w) => (
            <div key={w.title} className="rounded-2xl border border-border bg-card p-6">
              <w.icon className="h-5 w-5 text-accent" />
              <h3 className="mt-4 font-medium">{w.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{w.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-14">
        <h2 className="font-display mb-8 text-2xl font-semibold md:text-3xl">How it works</h2>
        <div className="grid gap-4 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <div key={s.title} className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <s.icon className="h-5 w-5 text-accent" />
                <span className="font-mono text-sm text-muted-foreground">0{i + 1}</span>
              </div>
              <h3 className="mt-5 font-medium">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Get started */}
      <section id="start" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-14">
        <h2 className="font-display mb-8 text-2xl font-semibold md:text-3xl">Get started</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <StartCard n="01" title="Browse & invoke" body="Find a skill, connect a wallet, and pay its USDC price to run it." href="/search" cta="Browse skills" />
          <StartCard n="02" title="Publish a skill" body="Paste a skill.md, pin it to IPFS, and register it on-chain from your wallet." href="/dashboard/publish" cta="Open publisher" />
          <StartCard n="03" title="Read the docs" body="Understand the manifest, the contract, royalties, and the trust model." href="/docs" cta="Read the docs" />
        </div>
      </section>

      <SkillRow title="Most invoked" href="/search?sort=invocations" skills={top.items} />
      <SkillRow title="Recently published" href="/search?sort=recent" skills={recent.items} />
    </>
  );
}

function StartCard({ n, title, body, href, cta }: { n: string; title: string; body: string; href: string; cta: string }) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-6">
      <span className="font-mono text-sm text-muted-foreground">{n}</span>
      <h3 className="mt-4 font-medium">{title}</h3>
      <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted">{body}</p>
      <Link href={href} className="mt-4 inline-flex items-center gap-1 text-sm text-accent hover:underline">
        {cta} <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function SkillRow({
  title,
  href,
  skills,
}: {
  title: string;
  href: string;
  skills: Awaited<ReturnType<typeof searchSkills>>["items"];
}) {
  return (
    <section className="mx-auto max-w-6xl px-5 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold tracking-tight">{title}</h2>
        <Link href={href} className="eyebrow flex items-center gap-1 text-muted hover:text-accent">
          View all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {skills.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong p-12 text-center text-sm text-muted-foreground">
          No skills indexed yet. Start the indexer and publish a skill via the CLI.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {skills.map((s) => (
            <SkillCard key={s.skillId} skill={s} />
          ))}
        </div>
      )}
    </section>
  );
}
