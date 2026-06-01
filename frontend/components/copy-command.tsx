"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

// A terminal-style command line with a copy button. `prompt` is the (un-copied)
// shell sigil shown before the command; only `command` is copied to clipboard.
export function CopyCommand({ command, prompt = "$" }: { command: string; prompt?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked (insecure context) — no-op */
    }
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border-strong bg-card-elevated px-4 py-3">
      <span className="select-none font-mono text-sm leading-6 text-accent">{prompt}</span>
      <code className="min-w-0 flex-1 break-all font-mono text-sm leading-6 text-foreground sm:overflow-x-auto sm:whitespace-nowrap sm:break-normal">
        {command}
      </code>
      <button
        onClick={copy}
        aria-label="Copy command"
        className="shrink-0 rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:border-accent/50 hover:text-accent"
      >
        {copied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}
