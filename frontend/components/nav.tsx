"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { ConnectWallet } from "@/components/connect-wallet";
import { XIcon } from "@/components/x-icon";
import { GITHUB_URL, X_URL } from "@/lib/links";

const LINKS = [
  { href: "/search", label: "Browse" },
  { href: "/#how", label: "How" },
  { href: "/docs", label: "Docs" },
  { href: "/whitepaper", label: "Whitepaper" },
  { href: "/dashboard", label: "Dashboard" },
];

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
        <div className="pointer-events-auto w-full max-w-3xl">
          <nav className="flex items-center justify-between gap-4 rounded-full border border-border-strong bg-card/85 py-2 pl-5 pr-2 shadow-[0_8px_30px_-12px_rgba(47,56,38,0.35)] backdrop-blur-xl">
            <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
              <DotMark />
              <span className="font-mono text-sm font-medium lowercase tracking-tight">atrium</span>
            </Link>

            <div className="hidden items-center gap-6 md:flex">
              {LINKS.map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  className="eyebrow text-muted transition-colors hover:text-foreground"
                >
                  {l.label}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-1">
              <a
                href={X_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="Atrium on X"
                className="hidden h-9 w-9 place-items-center rounded-full text-muted transition-colors hover:bg-surface hover:text-foreground sm:grid"
              >
                <XIcon className="h-4 w-4" />
              </a>
              <ConnectWallet />
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-label={open ? "Close menu" : "Open menu"}
                aria-expanded={open}
                aria-controls="mobile-menu"
                className="grid h-9 w-9 place-items-center rounded-full text-muted transition-colors hover:bg-surface hover:text-foreground md:hidden"
              >
                {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </nav>

          {/* Mobile dropdown menu */}
          {open && (
            <div
              id="mobile-menu"
              className="mt-2 overflow-hidden rounded-3xl border border-border-strong bg-card/95 p-2 shadow-[0_12px_40px_-16px_rgba(47,56,38,0.45)] backdrop-blur-xl md:hidden"
            >
              {LINKS.map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-2xl px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-surface"
                >
                  {l.label}
                </Link>
              ))}
              <div className="mt-1 flex items-center gap-2 border-t border-border px-4 pt-3 pb-1 text-muted-foreground">
                <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="text-sm hover:text-foreground" onClick={() => setOpen(false)}>
                  GitHub
                </a>
                <span aria-hidden>·</span>
                <a href={X_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm hover:text-foreground" onClick={() => setOpen(false)}>
                  <XIcon className="h-3.5 w-3.5" /> X
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* spacer so fixed nav doesn't overlap content */}
      <div className="h-20" aria-hidden />
    </>
  );
}

/** Small pixel logo mark — the 6-square Atrium glyph (3×3 diagonal pattern). */
function DotMark() {
  return (
    <span className="grid grid-cols-3 gap-[2px]">
      {[1, 0, 1, 1, 1, 0, 0, 1, 1].map((on, i) => (
        <span key={i} className={`h-1.5 w-1.5 rounded-[1px] ${on ? "bg-accent" : "bg-transparent"}`} />
      ))}
    </span>
  );
}
