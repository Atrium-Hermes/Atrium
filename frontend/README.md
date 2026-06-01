# Atrium Frontend

Next.js 15 (App Router) marketplace UI for Atrium. Visual language follows a
**Matrix-OS-minimal** aesthetic: near-black background, a single Matrix-green
accent, generous whitespace, Inter for text + JetBrains Mono for hashes/addresses.

All page data is read from the **indexer** (Workstream 1) REST API — the frontend
never hits a chain RPC for reads.

## Status

**Phase 1 (this build): public browse, fully server-rendered.**
- `/` — landing: hero, live stats, feature row, most-invoked + recently-published skills
- `/search` — search + sort (recent / most used / top earning), tag filtering
- `/skill/[id]` — skill detail: markdown body (syntax-highlighted), price, stats,
  attestation, parent royalties, recent invocations, invoke button (placeholder)

**Phase 2 (next): wallet + write paths.**
- wagmi v2 + viem + RainbowKit providers
- Real connect-wallet + `invokeSkill` (USDC approve → pay → unlock) flow
- `/creator/[address]`, `/dashboard`, `/dashboard/publish`, `/dashboard/settings`

Placeholders (`Connect Wallet`, `Invoke`) are wired as no-ops in Phase 1 and the
`/creator/[address]` link is not built yet.

## Run

```bash
cd frontend
cp .env.example .env.local      # point NEXT_PUBLIC_INDEXER_URL at the indexer
npm install
npm run dev                     # http://localhost:3000
```

The indexer (Workstream 1) should be running at `NEXT_PUBLIC_INDEXER_URL`
(default `http://localhost:3001`). If it's down, pages still render with empty
states — every indexer call fails soft.

## Env

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_INDEXER_URL` | Indexer REST base (all reads) |
| `NEXT_PUBLIC_REGISTRY_ADDRESS` | Registry address (Phase 2 writes) |
| `NEXT_PUBLIC_USDC_ADDRESS` | USDC token (Phase 2) |
| `NEXT_PUBLIC_CHAIN_ID` | `84532` Base Sepolia (Phase 2) |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect id (Phase 2) |

## Stack

Next.js 15 · React 19 · TypeScript (strict) · Tailwind 4 · lucide-react ·
react-markdown + remark-gfm + rehype-highlight. UI primitives are hand-rolled in
a shadcn-style under `components/ui/`.
