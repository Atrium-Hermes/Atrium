# Atrium Indexer

A single-process daemon that mirrors `AtriumRegistry` events from Base into a
local SQLite database and serves a read-only REST API. It exists so the frontend
(and any external consumer) never has to query a chain RPC per page load.

The indexer is **read-only**: it never holds keys and cannot move funds. The
smart contract is the source of truth; this service caches and serves.

---

## Architecture

```
                ┌──────────────┐      poll getLogs       ┌─────────────┐
   Base RPC ───▶│  indexer.ts  │────────────────────────▶│   SQLite    │
                │ (event loop) │   one tx per window      │  (WAL mode) │
                └──────┬───────┘                          └──────┬──────┘
                       │ schedule(cid)                           │ reads
                ┌──────▼───────┐   lazy fetch + cache      ┌──────▼──────┐
   IPFS GW ────▶│ ipfs/fetcher │──────────────────────────▶│  Hono API   │──▶ frontend
                │  (p-queue)   │   body → FTS5             │  :3001      │
                └──────────────┘                           └─────────────┘
```

- **`indexer.ts`** — backfill + 12s polling loop. Each window's event writes and
  the cursor update commit in a single SQLite transaction, so a crash resumes
  cleanly from the last committed block with no double counting.
- **`ipfs/fetcher.ts`** — on `SkillRegistered`, lazily fetches `skill.md` from a
  gateway (with fallbacks), parses frontmatter, and caches the body into both the
  `skills` row and the `skills_fts` full-text index.
- **`db/`** — `schema.sql` (DDL) + a thin `better-sqlite3` wrapper with a prepared
  statement cache and a transaction helper.
- **`handlers/`** — one module per event family (skill / invocation / attestation).
- **`api/`** — Hono route modules, one per resource.

Monetary values are stored as base-unit integers in `TEXT` columns (USDC has **6
decimals**) to avoid JS float precision loss; numeric ordering uses
`CAST(col AS INTEGER)`.

---

## Configuration

Copy `.env.example` to `.env` and fill in:

| Var | Required | Default | Notes |
|---|---|---|---|
| `ATRIUM_REGISTRY` | ✅ | — | Registry contract address |
| `BASE_RPC_URL` | ✅ | — | Base Sepolia or mainnet RPC |
| `REGISTRY_DEPLOY_BLOCK` | | `0` | Start block; `0` = slow full scan |
| `DATABASE_PATH` | | `./atrium-index.db` | |
| `PORT` | | `3001` | |
| `LOG_LEVEL` | | `info` | `trace`…`error` |
| `PINATA_GATEWAY` | | `gateway.pinata.cloud/ipfs,ipfs.io/ipfs,dweb.link/ipfs` | comma-separated, tried in order |
| `INDEX_POLL_INTERVAL_MS` | | `12000` | |
| `MAX_BLOCK_RANGE` | | `5000` | blocks per `getLogs` window |
| `IPFS_CONCURRENCY` | | `4` | concurrent gateway fetches |

---

## Run

```bash
# from repo root
npm install

# dev (watch mode, runs indexer loop + API in one process)
cd indexer && npm run dev

# production build + start
cd indexer && npm run build && npm start
```

Set `REGISTRY_DEPLOY_BLOCK` to the registry's deploy block for a fast first sync —
leaving it at `0` forces a full-chain scan.

---

## API

All responses are JSON except `/skills/:id/body` (markdown). Pagination via
`limit` (max 100) + `offset`. CORS is open.

| Endpoint | Description |
|---|---|
| `GET /health` | `{ ok, lastBlock, lastIndexedAt }` |
| `GET /skills?q=&tag=&category=&limit=&offset=&sort=recent\|invocations\|earned` | search / list → `{ items, total, hasMore }` |
| `GET /skills/:skillId` | `{ skill, attestation, parents, recentInvocations, ipfsBody }` |
| `GET /skills/:skillId/body` | cached skill markdown (`text/markdown`) |
| `GET /creators/:address/skills` | `{ items, totals }` |
| `GET /creators/:address/earnings` | `{ totalEarned, withdrawn, withdrawable, byCreatedSkill }` |
| `GET /recent?type=skills\|invocations\|attestations&limit=` | `{ items }` |
| `GET /stats` | `{ totalSkills, activeSkills, totalInvocations, totalUsdcSettled, top10ByEarnings }` |

`withdrawable` in the earnings endpoint is read live from the contract (it resets
to 0 on withdraw and cannot be derived from events); it is `null` on RPC failure.

---

## Troubleshooting

- **`Missing required env var: ATRIUM_REGISTRY`** — create `.env` from `.env.example`.
- **First sync is slow / RPC `getLogs` errors** — set `REGISTRY_DEPLOY_BLOCK` and/or
  lower `MAX_BLOCK_RANGE` (some providers cap the block span per request). The loop
  retries with exponential backoff.
- **Skill `name`/`description` are `null`** — the body hasn't been fetched from IPFS
  yet (or the gateway is down). The fetcher retries unfetched skills on every
  startup; add more gateways to `PINATA_GATEWAY`.
- **`better-sqlite3` build fails on install** — it's a native module; ensure a C++
  toolchain (e.g. `build-essential` / Xcode CLT) and Node ≥ 20 are present.
- **Counts look stale** — the chain is authoritative. If the DB ever disagrees,
  delete `atrium-index.db` and re-sync from `REGISTRY_DEPLOY_BLOCK`.

---

## Non-goals (MVP)

No Postgres/Redis, no auth, no external queue, no separate worker process — a
single SQLite-backed daemon is sufficient at this scale.
