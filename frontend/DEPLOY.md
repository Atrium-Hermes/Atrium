# Deploying the Atrium frontend to Vercel

The frontend is a Next.js 15 app living in the `frontend/` subdirectory of this
monorepo. It is **not** part of the root npm workspaces (it pins its own React
19), so Vercel must be told the app lives in `frontend/`.

All page data is read from the **indexer** REST API (Workstream 1). Indexer
calls fail soft — if the indexer is unreachable the marketing pages, `/docs`,
and `/whitepaper` still render fully; only the skill listings/stats come up
empty. See "Indexer (data source)" below.

---

## Option A — Vercel dashboard (recommended, persistent GitHub deploys)

1. https://vercel.com/new → **Import** `Atrium-Hermes/Hermes-Atrium`.
2. **Root Directory:** set to `frontend`. (Vercel then auto-detects Next.js,
   `npm install`, `next build`.)
3. **Environment Variables** — add the ones below.
4. **Deploy.** Every push to `main` redeploys automatically.

## Option B — Vercel CLI

```bash
npm i -g vercel
cd frontend
vercel login           # interactive — run it yourself in the terminal with `!`
vercel link            # create/link the project
vercel --prod          # build + deploy
```

To deploy non-interactively (e.g. from CI or this environment), export a token
first: `export VERCEL_TOKEN=...` then `vercel --prod --token "$VERCEL_TOKEN"`.

---

## Environment variables

| Key | Value | Notes |
|-----|-------|-------|
| `NEXT_PUBLIC_REGISTRY_ADDRESS` | `0x9Dd6FE335ff190CAEC05A5E5CEDeaE1fc0cd0B85` | AtriumRegistry on Base Sepolia |
| `NEXT_PUBLIC_USDC_ADDRESS` | `0xA713c88927523279B874640003Ed697e509732a7` | MockUSDC (testnet, open faucet) |
| `NEXT_PUBLIC_CHAIN_ID` | `84532` | Base Sepolia |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | _your id_ | Get one at https://cloud.walletconnect.com — needed for wallet connect; injected wallets (MetaMask) work without it |
| `NEXT_PUBLIC_INDEXER_URL` | _public indexer URL_ | Browser uses the same-origin `/api/indexer` proxy; this is read server-side by that proxy. Leave as a placeholder until the indexer is hosted (data renders empty, fail-soft) |
| `INDEXER_URL` | _public indexer URL_ | Optional server-only override for the proxy; takes precedence over `NEXT_PUBLIC_INDEXER_URL` and is not exposed to the browser |
| `NEXT_PUBLIC_KEY_SERVICE_URL` | _public key-service URL_ | Only for encrypted-skill unlock; optional, fail-soft if absent |

Do **not** set `NEXT_PUBLIC_INDEXER_URL` to a `localhost` URL in production — it
won't resolve from Vercel. Leave it unset/placeholder until a public indexer
exists.

---

## Indexer (data source) — a separate host

The indexer is a long-running daemon with a SQLite file, so it **cannot** run on
Vercel (serverless, ephemeral filesystem). Host it where a process can stay up
with a small persistent disk:

- Railway / Render / Fly.io (Docker or Node) — easiest
- A small VPS (systemd service)

It needs the env from `indexer/.env.example` (registry address, `BASE_RPC_URL`,
`REGISTRY_DEPLOY_BLOCK`, a persistent `DATABASE_PATH`). Once it has a public URL,
set `INDEXER_URL` (and `NEXT_PUBLIC_INDEXER_URL`) on Vercel and redeploy — the
skill listings, search, and stats then populate.

---

## Custom domain

In the Vercel project: **Settings → Domains** → add your domain and follow the
DNS instructions. The app is fully responsive and dark/light-safe.
