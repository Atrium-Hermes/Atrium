import { NextResponse } from "next/server";

// Same-origin proxy to the indexer for CLIENT-side calls (e.g. the dashboard),
// so the app works behind port-forwarding where the browser can't reach
// localhost:3001. Server components hit the indexer directly (see lib/indexer.ts).
const INDEXER = process.env.INDEXER_URL || process.env.NEXT_PUBLIC_INDEXER_URL || "http://localhost:3001";

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const search = new URL(req.url).search;
  const target = `${INDEXER}/${path.join("/")}${search}`;
  try {
    const res = await fetch(target, { cache: "no-store" });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") || "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "indexer unreachable" }, { status: 502 });
  }
}
