"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, type FormEvent } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

const SORTS = [
  { key: "recent", label: "Recent" },
  { key: "invocations", label: "Most used" },
  { key: "earned", label: "Top earning" },
] as const;

export function SearchBox() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const sort = params.get("sort") ?? "recent";

  // keep input in sync when navigating via sort chips / back button
  useEffect(() => {
    setQ(params.get("q") ?? "");
  }, [params]);

  function navigate(next: { q?: string; sort?: string }) {
    const sp = new URLSearchParams(params.toString());
    if (next.q !== undefined) next.q ? sp.set("q", next.q) : sp.delete("q");
    if (next.sort !== undefined) sp.set("sort", next.sort);
    router.push(`/search?${sp.toString()}`);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    navigate({ q });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search skills by name, description, or tag…"
          className="pl-11"
          aria-label="Search skills"
        />
      </form>

      <div className="flex flex-wrap gap-2">
        {SORTS.map((s) => (
          <button
            key={s.key}
            onClick={() => navigate({ sort: s.key })}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              sort === s.key
                ? "border-accent/60 bg-accent/10 text-accent"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
