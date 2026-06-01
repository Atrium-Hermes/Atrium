import { NextResponse } from "next/server";

// Server-side proxy to the key-service. The browser calls this same-origin route
// (so it works behind port-forwarding / remote hosts), and Next — running next to
// the key-service — forwards to it. Use a server-only env (NOT NEXT_PUBLIC).
const KEY_SERVICE = process.env.KEY_SERVICE_URL || "http://localhost:3002";

export async function POST(req: Request) {
  let payload: { skillId?: string; address?: string; signature?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const { skillId, address, signature } = payload;
  if (!skillId || !/^0x[0-9a-fA-F]{64}$/.test(skillId)) {
    return NextResponse.json({ error: "bad skillId" }, { status: 400 });
  }
  try {
    const res = await fetch(`${KEY_SERVICE}/grant/${skillId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address, signature }),
    });
    const text = await res.text();
    return new NextResponse(text, { status: res.status, headers: { "content-type": "application/json" } });
  } catch {
    return NextResponse.json({ error: "key-service unreachable" }, { status: 502 });
  }
}
