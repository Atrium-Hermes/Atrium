#!/usr/bin/env node
/**
 * Atrium MCP Server
 *
 * Exposes the Atrium registry to MCP-compatible agents (Claude, Hermes, OpenClaude).
 * Tools:
 *   - atrium_search:    discover skills by tag/category/keyword
 *   - atrium_get:       fetch skill metadata + IPFS body
 *   - atrium_quote:     get price + attestation status (no payment)
 *   - atrium_invoke:    pay USDC + receive skill body (full pipeline)
 *   - atrium_history:   read past invocations for a skill
 *   - atrium_balance:   show wallet + withdrawable USDC
 *
 * Run with:  node mcp-server/dist/server.js
 * Or:        npx -y @atrium/mcp-server
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { config } from "dotenv";
import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  keccak256,
  toBytes,
  type Address,
  type Hex,
  type Chain,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";

// ─────────── Env ───────────
const envPath = join(homedir(), ".atrium", ".env");
if (existsSync(envPath)) config({ path: envPath });

const NETWORK = (process.env.ATRIUM_NETWORK ?? "base-sepolia") as "base-sepolia" | "base";
const RPC = NETWORK === "base" ? "https://mainnet.base.org" : "https://sepolia.base.org";
const USDC_ADDRESS =
  NETWORK === "base"
    ? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
    : "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

const REGISTRY = (NETWORK === "base"
  ? process.env.ATRIUM_REGISTRY_MAINNET
  : process.env.ATRIUM_REGISTRY_SEPOLIA) as Address | undefined;

if (!REGISTRY) {
  console.error("ATRIUM_REGISTRY_SEPOLIA or _MAINNET env var required");
  process.exit(1);
}

const IPFS_GATEWAY = process.env.PINATA_GATEWAY ?? "https://gateway.pinata.cloud/ipfs";

// ─────────── ABIs (subset of CLI version) ───────────
const REGISTRY_ABI = parseAbi([
  "function registerSkill(string cid, bytes32 didHash, uint256 pricePerCall, bytes32[] parentSkills, uint16[] parentBps) returns (bytes32)",
  "function invokeSkill(bytes32 skillId)",
  "function withdraw()",
  "function skills(bytes32) view returns (string cid, address creator, bytes32 didHash, uint256 pricePerCall, uint64 createdAt, uint64 lastInvoked, uint128 totalInvocations, uint128 totalEarned, bool active)",
  "function attestations(bytes32) view returns (bytes32 benchmarkHash, uint16 successRate, uint64 attestedAt, address attester, uint128 sampleCount)",
  "function withdrawable(address) view returns (uint256)",
  "function totalSkillCount() view returns (uint256)",
  "function listSkills(uint256 offset, uint256 limit) view returns (bytes32[])",
]);
const USDC_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
]);

// ─────────── Chain clients ───────────
const chain: Chain = NETWORK === "base" ? base : baseSepolia;
const publicClient: PublicClient = createPublicClient({ chain, transport: http(RPC) });

let walletClient: WalletClient | undefined;
let account: Address | undefined;
if (process.env.ATRIUM_PRIVATE_KEY) {
  const acc = privateKeyToAccount(process.env.ATRIUM_PRIVATE_KEY as Hex);
  walletClient = createWalletClient({ account: acc, chain, transport: http(RPC) });
  account = acc.address;
}

// ─────────── Helpers ───────────
function formatUsdc(amount: bigint): string {
  const whole = amount / 1_000_000n;
  const frac = amount % 1_000_000n;
  const fracStr = frac.toString().padStart(6, "0").replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}

async function fetchIpfs(cid: string, path?: string): Promise<string> {
  const url = path ? `${IPFS_GATEWAY}/${cid}/${path}` : `${IPFS_GATEWAY}/${cid}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`IPFS fetch failed: ${res.status}`);
  return res.text();
}

async function loadSkillMetadata(skillId: Hex): Promise<{
  cid: string;
  creator: Address;
  price: bigint;
  active: boolean;
  totalInvocations: bigint;
  totalEarned: bigint;
  createdAt: bigint;
}> {
  const result = (await publicClient.readContract({
    address: REGISTRY!,
    abi: REGISTRY_ABI,
    functionName: "skills",
    args: [skillId],
  })) as [string, Address, Hex, bigint, bigint, bigint, bigint, bigint, boolean];

  const [cid, creator, , price, createdAt, , totalInvocations, totalEarned, active] = result;
  return { cid, creator, price, active, totalInvocations, totalEarned, createdAt };
}

// ─────────── Tool definitions ───────────
const TOOLS: Tool[] = [
  {
    name: "atrium_search",
    description:
      "Search skills in the Atrium registry. Returns a list of skill IDs with basic metadata. Use atrium_get for full details.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text search (matched against name, description, tags)" },
        tag: { type: "string", description: "Filter by tag (e.g. 'pdf', 'ocr')" },
        limit: { type: "number", description: "Max results (default 20)", default: 20 },
      },
    },
  },
  {
    name: "atrium_get",
    description: "Fetch full metadata + IPFS body for a skill. Does NOT pay or invoke — read-only.",
    inputSchema: {
      type: "object",
      properties: {
        skill_id: { type: "string", description: "0x... 32-byte skill identifier" },
      },
      required: ["skill_id"],
    },
  },
  {
    name: "atrium_quote",
    description:
      "Get price + attestation status for a skill before paying. Returns USDC required + estimated trust level.",
    inputSchema: {
      type: "object",
      properties: {
        skill_id: { type: "string", description: "0x... skill identifier" },
      },
      required: ["skill_id"],
    },
  },
  {
    name: "atrium_invoke",
    description:
      "Pay USDC and invoke a skill. Returns the skill body to load into the agent runtime. Auto-handles USDC approval + payment + on-chain settlement.",
    inputSchema: {
      type: "object",
      properties: {
        skill_id: { type: "string", description: "0x... skill identifier" },
        max_price_usdc: {
          type: "string",
          description: "Max price willing to pay (refuses if skill is more expensive). E.g. '0.01'",
        },
      },
      required: ["skill_id"],
    },
  },
  {
    name: "atrium_balance",
    description: "Show this agent's wallet, USDC balance, and withdrawable earnings.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "atrium_list_recent",
    description: "List most recently registered skills on the registry.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "How many recent skills to return", default: 10 },
      },
    },
  },
];

// ─────────── Tool handlers ───────────

async function handleSearch(args: { query?: string; tag?: string; limit?: number }) {
  const limit = args.limit ?? 20;
  const ids = (await publicClient.readContract({
    address: REGISTRY!,
    abi: REGISTRY_ABI,
    functionName: "listSkills",
    args: [0n, BigInt(limit * 3)], // over-fetch then filter
  })) as Hex[];

  const results = [];
  for (const id of ids) {
    const meta = await loadSkillMetadata(id);
    if (!meta.active) continue;

    let body = "";
    try {
      body = await fetchIpfs(meta.cid, "skill.md");
    } catch {
      continue;
    }

    // Cheap search: substring match on body
    const queryHit =
      !args.query || body.toLowerCase().includes(args.query.toLowerCase());
    const tagHit =
      !args.tag ||
      body.toLowerCase().includes(`- ${args.tag.toLowerCase()}`) ||
      body.toLowerCase().includes(`"${args.tag.toLowerCase()}"`);

    if (queryHit && tagHit) {
      results.push({
        skill_id: id,
        cid: meta.cid,
        creator: meta.creator,
        price_usdc: formatUsdc(meta.price),
        total_invocations: meta.totalInvocations.toString(),
        body_preview: body.slice(0, 300),
      });
      if (results.length >= limit) break;
    }
  }

  return {
    content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
  };
}

async function handleGet(args: { skill_id: string }) {
  const meta = await loadSkillMetadata(args.skill_id as Hex);
  const body = await fetchIpfs(meta.cid, "skill.md");
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            skill_id: args.skill_id,
            on_chain: {
              cid: meta.cid,
              creator: meta.creator,
              price_usdc: formatUsdc(meta.price),
              active: meta.active,
              total_invocations: meta.totalInvocations.toString(),
              total_earned_usdc: formatUsdc(meta.totalEarned),
              created_at: new Date(Number(meta.createdAt) * 1000).toISOString(),
            },
            body,
          },
          null,
          2
        ),
      },
    ],
  };
}

async function handleQuote(args: { skill_id: string }) {
  const meta = await loadSkillMetadata(args.skill_id as Hex);
  const att = (await publicClient.readContract({
    address: REGISTRY!,
    abi: REGISTRY_ABI,
    functionName: "attestations",
    args: [args.skill_id as Hex],
  })) as [Hex, number, bigint, Address, bigint];

  const trustLevel =
    att[3] === "0x0000000000000000000000000000000000000000"
      ? "unattested"
      : att[1] >= 9500
        ? "high"
        : att[1] >= 8000
          ? "medium"
          : "low";

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            skill_id: args.skill_id,
            price_usdc: formatUsdc(meta.price),
            active: meta.active,
            trust_level: trustLevel,
            attestation: att[3] !== "0x0000000000000000000000000000000000000000"
              ? {
                  success_rate: `${(att[1] / 100).toFixed(2)}%`,
                  sample_count: att[4].toString(),
                  attester: att[3],
                  attested_at: new Date(Number(att[2]) * 1000).toISOString(),
                }
              : null,
            historical: {
              total_invocations: meta.totalInvocations.toString(),
              total_earned_usdc: formatUsdc(meta.totalEarned),
            },
          },
          null,
          2
        ),
      },
    ],
  };
}

async function handleInvoke(args: { skill_id: string; max_price_usdc?: string }) {
  if (!walletClient || !account) {
    throw new Error("Wallet not configured (ATRIUM_PRIVATE_KEY missing)");
  }

  const meta = await loadSkillMetadata(args.skill_id as Hex);
  if (!meta.active) throw new Error("Skill is inactive");

  if (args.max_price_usdc) {
    const max = BigInt(Math.floor(parseFloat(args.max_price_usdc) * 1_000_000));
    if (meta.price > max) {
      throw new Error(
        `Skill price ${formatUsdc(meta.price)} USDC exceeds max ${args.max_price_usdc} USDC`
      );
    }
  }

  // Balance check
  const balance = (await publicClient.readContract({
    address: USDC_ADDRESS as Address,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [account],
  })) as bigint;
  if (balance < meta.price) {
    throw new Error(`Insufficient USDC: have ${formatUsdc(balance)}, need ${formatUsdc(meta.price)}`);
  }

  // Approve if needed
  const allowance = (await publicClient.readContract({
    address: USDC_ADDRESS as Address,
    abi: USDC_ABI,
    functionName: "allowance",
    args: [account, REGISTRY!],
  })) as bigint;

  let approveTxHash: Hex | undefined;
  if (allowance < meta.price) {
    approveTxHash = await walletClient.writeContract({
      address: USDC_ADDRESS as Address,
      abi: USDC_ABI,
      functionName: "approve",
      args: [REGISTRY!, meta.price * 10n],
      chain,
      account,
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
  }

  // Invoke
  const txHash = await walletClient.writeContract({
    address: REGISTRY!,
    abi: REGISTRY_ABI,
    functionName: "invokeSkill",
    args: [args.skill_id as Hex],
    chain,
    account,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === "reverted") {
    throw new Error("Transaction reverted");
  }

  // Fetch body now that we've paid
  const body = await fetchIpfs(meta.cid, "skill.md");

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            status: "invoked",
            skill_id: args.skill_id,
            paid_usdc: formatUsdc(meta.price),
            tx_hash: txHash,
            approve_tx_hash: approveTxHash,
            block_number: receipt.blockNumber.toString(),
            skill_body: body,
            usage_hint: "Load skill_body into your agent runtime. The Markdown body contains the executable spec.",
          },
          null,
          2
        ),
      },
    ],
  };
}

async function handleBalance() {
  if (!account) {
    return { content: [{ type: "text", text: "No wallet configured (ATRIUM_PRIVATE_KEY missing)" }] };
  }

  const balance = (await publicClient.readContract({
    address: USDC_ADDRESS as Address,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [account],
  })) as bigint;

  const owed = (await publicClient.readContract({
    address: REGISTRY!,
    abi: REGISTRY_ABI,
    functionName: "withdrawable",
    args: [account],
  })) as bigint;

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            wallet: account,
            network: NETWORK,
            usdc_balance: formatUsdc(balance),
            withdrawable: formatUsdc(owed),
          },
          null,
          2
        ),
      },
    ],
  };
}

async function handleListRecent(args: { limit?: number }) {
  const total = (await publicClient.readContract({
    address: REGISTRY!,
    abi: REGISTRY_ABI,
    functionName: "totalSkillCount",
  })) as bigint;

  const limit = args.limit ?? 10;
  const offset = total > BigInt(limit) ? total - BigInt(limit) : 0n;

  const ids = (await publicClient.readContract({
    address: REGISTRY!,
    abi: REGISTRY_ABI,
    functionName: "listSkills",
    args: [offset, BigInt(limit)],
  })) as Hex[];

  const results = await Promise.all(
    ids.reverse().map(async (id) => {
      const meta = await loadSkillMetadata(id);
      return {
        skill_id: id,
        creator: meta.creator,
        price_usdc: formatUsdc(meta.price),
        active: meta.active,
        invocations: meta.totalInvocations.toString(),
        created_at: new Date(Number(meta.createdAt) * 1000).toISOString(),
      };
    })
  );

  return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
}

// ─────────── Server wiring ───────────
const server = new Server(
  { name: "atrium-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  try {
    switch (name) {
      case "atrium_search":
        return await handleSearch(args as { query?: string; tag?: string; limit?: number });
      case "atrium_get":
        return await handleGet(args as { skill_id: string });
      case "atrium_quote":
        return await handleQuote(args as { skill_id: string });
      case "atrium_invoke":
        return await handleInvoke(args as { skill_id: string; max_price_usdc?: string });
      case "atrium_balance":
        return await handleBalance();
      case "atrium_list_recent":
        return await handleListRecent(args as { limit?: number });
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`atrium-mcp v0.1.0 ready (network: ${NETWORK}, registry: ${REGISTRY})`);
