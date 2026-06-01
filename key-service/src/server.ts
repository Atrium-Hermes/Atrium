import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  createPublicClient,
  http,
  parseAbi,
  parseAbiItem,
  recoverMessageAddress,
  type Address,
  type Hex,
} from "viem";

// ─────────── config ───────────
const REGISTRY = required("ATRIUM_REGISTRY") as Address;
const RPC = required("BASE_RPC_URL");
const DEPLOY_BLOCK = BigInt(process.env.REGISTRY_DEPLOY_BLOCK || "0");
const PORT = Number(process.env.PORT || "3002");
const STORE_PATH = process.env.STORE_PATH || "./keys.json";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

const client = createPublicClient({ transport: http(RPC) });
const REGISTRY_ABI = parseAbi([
  "function skills(bytes32) view returns (string cid, address creator, bytes32 didHash, uint256 pricePerCall, uint64 createdAt, uint64 lastInvoked, uint128 totalInvocations, uint128 totalEarned, bool active)",
]);
const SKILL_INVOKED = parseAbiItem(
  "event SkillInvoked(bytes32 indexed skillId, address indexed caller, uint256 amount, uint128 invocationNumber)"
);

// ─────────── store (tiny JSON file) ───────────
interface Store {
  keys: Record<string, { keyHex: string; creator: string }>;
  grants: Record<string, number>; // `${skillId}:${addr}` -> times granted
}
function load(): Store {
  if (existsSync(STORE_PATH)) return JSON.parse(readFileSync(STORE_PATH, "utf8"));
  return { keys: {}, grants: {} };
}
function save(s: Store): void {
  writeFileSync(STORE_PATH, JSON.stringify(s, null, 2));
}
const store = load();

// ─────────── chain helpers ───────────
async function skillCreator(skillId: Hex): Promise<string> {
  const s = (await client.readContract({
    address: REGISTRY,
    abi: REGISTRY_ABI,
    functionName: "skills",
    args: [skillId],
  })) as readonly unknown[];
  return String(s[1]).toLowerCase(); // creator
}

// Count this caller's invocations of a skill. Public RPCs (sepolia.base.org) cap
// getLogs at 2000 blocks, so scan in windows. We only gate on >= 1, so stop at
// the first hit to keep the common (already-paid) path to a single RPC call.
async function invocationCount(skillId: Hex, caller: Address): Promise<number> {
  const latest = await client.getBlockNumber();
  const STEP = 2000n;
  let total = 0;
  for (let from = DEPLOY_BLOCK; from <= latest; from += STEP) {
    const to = from + STEP - 1n > latest ? latest : from + STEP - 1n;
    const logs = await client.getLogs({
      address: REGISTRY,
      event: SKILL_INVOKED,
      args: { skillId, caller },
      fromBlock: from,
      toBlock: to,
    });
    total += logs.length;
    if (total > 0) break;
  }
  return total;
}

const isHex32 = (s: string) => /^0x[0-9a-fA-F]{64}$/.test(s);
const isAddr = (s: string) => /^0x[0-9a-fA-F]{40}$/.test(s);

// ─────────── app ───────────
const app = new Hono();
app.use("*", cors());

app.get("/health", (c) => c.json({ ok: true, registry: REGISTRY }));

// Creator submits the content key for a skill (signed with the creator wallet).
app.put("/keys/:skillId", async (c) => {
  const skillId = c.req.param("skillId");
  if (!isHex32(skillId)) return c.json({ error: "bad skillId" }, 400);
  const { keyHex, signature } = await c.req.json().catch(() => ({}));
  if (typeof keyHex !== "string" || typeof signature !== "string")
    return c.json({ error: "keyHex + signature required" }, 400);

  let signer: string;
  try {
    signer = (await recoverMessageAddress({ message: `atrium-key:${skillId}`, signature: signature as Hex })).toLowerCase();
  } catch {
    return c.json({ error: "bad signature" }, 400);
  }
  const creator = await skillCreator(skillId as Hex);
  if (creator === "0x0000000000000000000000000000000000000000")
    return c.json({ error: "skill not found on-chain" }, 404);
  if (signer !== creator) return c.json({ error: "signer is not the skill creator" }, 403);

  store.keys[skillId] = { keyHex, creator };
  save(store);
  return c.json({ ok: true });
});

// Consumer redeems a key: must prove wallet control AND an on-chain invocation.
app.post("/grant/:skillId", async (c) => {
  const skillId = c.req.param("skillId");
  if (!isHex32(skillId)) return c.json({ error: "bad skillId" }, 400);
  const { address, signature } = await c.req.json().catch(() => ({}));
  if (typeof address !== "string" || !isAddr(address) || typeof signature !== "string")
    return c.json({ error: "address + signature required" }, 400);

  const entry = store.keys[skillId];
  if (!entry) return c.json({ error: "no key registered for this skill" }, 404);

  let signer: string;
  try {
    signer = (
      await recoverMessageAddress({ message: `atrium-grant:${skillId}:${address.toLowerCase()}`, signature: signature as Hex })
    ).toLowerCase();
  } catch {
    return c.json({ error: "bad signature" }, 400);
  }
  if (signer !== address.toLowerCase()) return c.json({ error: "signature/address mismatch" }, 403);

  const count = await invocationCount(skillId as Hex, address as Address);
  if (count < 1)
    return c.json({ error: "no on-chain invocation found — invoke (pay) the skill first" }, 402);

  const gk = `${skillId}:${address.toLowerCase()}`;
  store.grants[gk] = (store.grants[gk] ?? 0) + 1;
  save(store);
  return c.json({ keyHex: entry.keyHex, invocations: count });
});

serve({ fetch: app.fetch, port: PORT }, (info) =>
  console.log(`key-service listening on :${info.port} (registry ${REGISTRY})`)
);
