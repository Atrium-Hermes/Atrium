import Link from "next/link";
import { XIcon } from "@/components/x-icon";
import { GITHUB_URL, X_URL } from "@/lib/links";

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-10 text-sm text-muted-foreground md:flex-row">
        <div className="flex items-center gap-2">
          <span className="grid h-5 w-5 place-items-center rounded bg-accent/15 text-accent font-mono text-xs">
            A
          </span>
          <span>Atrium — skill provenance & royalty marketplace</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/search" className="hover:text-foreground">Browse</Link>
          <Link href="/docs" className="hover:text-foreground">Docs</Link>
          <Link href="/whitepaper" className="hover:text-foreground">Whitepaper</Link>
          <a href={GITHUB_URL} className="hover:text-foreground" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a href={X_URL} className="inline-flex items-center gap-1 hover:text-foreground" target="_blank" rel="noreferrer" aria-label="Atrium on X">
            <XIcon className="h-3.5 w-3.5" />
          </a>
          <span className="font-mono text-xs">Base Sepolia</span>
        </div>
      </div>
    </footer>
  );
}
