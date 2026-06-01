# Atrium Architecture

> Design rationale behind the contract structure, identity model, payment routing, and composition primitives.

## Design goals

Ordered by priority:

1. **Non-repudiable provenance.** Every skill is cryptographically bound to its creator. There is no way to falsely claim authorship.
2. **Economic correctness.** The royalty cascade to parents must be exact (zero rounding error per invocation, zero stuck funds), or not happen at all.
3. **Composable without lock-in.** A published skill can be used by Hermes, OpenClaude, Claude, or any harness that reads Markdown frontmatter.
4. **Small surface area.** The smart contract is under 500 LOC and the CLI under 1500 LOC. Anything that does not need to be on-chain goes off-chain.
5. **Censorship-resistant.** Storage is on IPFS (can be mirrored) and settlement is on Base (a public rollup). The Atrium team cannot unilaterally take down a skill.

## Component breakdown

### 1. AtriumRegistry (smart contract)

Single contract, single source of truth on-chain. It contains three subsystems:

**A. Skill registry** — `skills[skillId] → Skill`. The skillId is deterministic, derived from `keccak256(cid, didHash, creator)`. Consequences:
- Same content + same creator → same id (idempotent)
- Different creator publishing same content → different id (no squatting)
- Content immutability: if the body is changed, the CID changes, the id changes → effectively a new skill

**B. Payment router** — `invokeSkill()` pulls USDC from the caller and splits it according to the rules:
```
total = pricePerCall
protocolCut = total * protocolFeeBps / 10000        // 2.5% default
distributable = total - protocolCut

for each parent in skill.parentSkills:
  parentCut = distributable * skill.parentBps[i] / 10000
  withdrawable[parent.creator] += parentCut

withdrawable[skill.creator] += (distributable - sum(parentCuts))
```

Three important properties:
- **Pull pattern** (withdrawable mapping) rather than push, so if a creator wallet reverts on receive (e.g. a broken contract), the invocation still succeeds
- **Conservation**: the sum of all withdrawable updates == total transferFrom. No wei is lost.
- **No reentrancy surface**: there are no external calls other than `usdc.transferFrom` at the start and `usdc.transfer` on withdraw

**C. Attestation log** — `attestations[skillId] → Attestation`. For the MVP: the latest attestation per skill, anyone can write. Production needs: an append-only log + stake-based attester whitelisting.

### 2. Identity (off-chain + on-chain bridge)

Two separate identities, by design:

**A. DID (Ed25519)**
- Used to sign the skill canonical hash
- Format: `did:key:z<base58(0xed01 || pubkey)>` — compatible with the W3C DID-key spec
- Stored at `~/.atrium/identity.json` (mode 600)
- **Never stored on-chain in full form** — only `didHash = keccak256(did)` goes into the contract

**B. EVM wallet (secp256k1)**
- Used for register/invoke/withdraw transactions
- Stored at `~/.atrium/.env` as `ATRIUM_PRIVATE_KEY`

Why separate them? Because their purposes differ:
- DID identity = "authorship of intellectual content" (persistent, long-lived, must survive wallet rotation)
- EVM wallet = "who pays gas + receives funds" (rotatable, can be different per device)

On `registerSkill`, the contract stores `(creator, didHash)`. To verify a signature off-chain, the consumer fetches the skill body from IPFS, extracts `author_did` from the frontmatter, hashes it, and compares against the on-chain didHash. A match means authentic.

When you rotate the EVM wallet: you can still publish new skills with the old DID (the signature remains valid). But you cannot withdraw earnings from old skills without the old wallet's private key. Future: add a `transferCreator()` function to migrate the creator address.

### 3. Storage (IPFS via Pinata)

For the MVP, Pinata is used as the pinning service. The skill content is a wrapped directory containing:
- `skill.md` (manifest + body)
- `benchmark.json` (optional)
- Supporting files (scripts, examples)

The returned CID is the directory CID, stored in the contract as `cid`. Consumers fetch via gateway: `https://gateway.pinata.cloud/ipfs/<cid>/skill.md`.

Migration path to gitlawb: just swap the `IpfsClient` implementation. The interface is already generic — `pinDirectory()` and `fetch()`. gitlawb is also content-addressed via IPFS, so the CID format is compatible.

### 4. CLI (operator-side ergonomics)

Single binary `atrium` with commands:
- `init` — generate identity + wallet
- `publish` — sign + IPFS pin + on-chain register
- `list / info` — browse registry
- `invoke / fetch` — pay + retrieve skill body
- `benchmark / attest` — verify + post benchmark proof
- `withdraw / balance` — financial ops

Internal library helpers in `cli/src/lib/`:
- `did.ts` — keygen, signing, canonical hash
- `ipfs.ts` — Pinata wrapper
- `chain.ts` — viem clients + ABI + allowance helper
- `skill.ts` — parser for Markdown + frontmatter

### 5. MCP Server (consumer-side integration)

Implements `@modelcontextprotocol/sdk` server. Exposes 6 tools:
1. `atrium_search` — discovery by tag/query
2. `atrium_get` — fetch metadata + body (read-only, no payment)
3. `atrium_quote` — price + attestation status
4. `atrium_invoke` — full pay-and-fetch pipeline
5. `atrium_balance` — wallet + withdrawable
6. `atrium_list_recent` — explore registry

Compatibility: designed to be drop-in with Claude Desktop, Hermes Agent, and OpenClaude. All tools follow the MCP convention (a single content array with a JSON-stringified payload).

## Payment routing (worked example)

Suppose:
- Skill **A** (foundational): creator Carol, price 1000 (0.001 USDC)
- Skill **B** (derived from A, royalty 20%): creator Alice, price 10000 (0.01 USDC)
- Skill **C** (derived from B, royalty 15%): creator Dave, price 50000 (0.05 USDC)

Bob calls `invokeSkill(C_id)` with 50000 USDC wei:

```
Protocol fee:   50000 * 250 / 10000        = 1250   → treasury
Distributable:  50000 - 1250                = 48750
Parent (B):     48750 * 1500 / 10000        = 7312   → Alice (B's creator)
Dave gets:      48750 - 7312                 = 41438  → Dave (C's creator)

Conservation check: 1250 + 7312 + 41438 = 50000 ✓
```

**Important note**: Carol (creator of skill A, the grandparent of skill C) gets **nothing** from an invocation of C. The royalty cascade is not transitive by design. If Alice wants Carol to keep getting a share when B is derived, Alice must declare A as a parent of B when publishing B (which she has done, so Carol gets 20% of every direct invocation of B).

Why not transitive?
1. **Predictable economics**: every skill knows exactly how much reaches its creator
2. **DoS resistance**: chain depth cannot be used to make an invocation expensive
3. **Gas bounded**: O(parents) not O(depth); max 5 parents = max 5 SSTORE per invocation

Trade-off: skill builders must explicitly declare ancestors. Tooling can help (e.g. the CLI auto-suggesting that grandparents be declared if the parent declares them).

## Trust & verification flow

The consumer's perspective when deciding whether to invoke:

```
1. atrium_search → returns skill_id
   ↓
2. atrium_quote(skill_id)
   - Returns: price, trust_level, attestation snapshot
   ↓
3. Decision:
   - If attestation exists + success_rate ≥ threshold → invoke
   - If unattested → trust other signals (creator reputation, invocation count)
   - If too expensive → skip
   ↓
4. atrium_invoke(skill_id, max_price)
   - Atomic: approve + pay + load body
   - Returns: skill body (Markdown)
   ↓
5. Verify body locally:
   - Parse frontmatter
   - Resolve author_did → public key
   - Verify ed25519 signature against canonical hash
   - If mismatch → discard (refund not possible — payment already settled)
```

Step 5 verification is **optional but recommended**. Without it, consumer trusts that IPFS gateway returned authentic content. With it, consumer has cryptographic proof.

## What's NOT in the contract (intentionally)

- **Tipping** — can be done off-chain via direct USDC transfer
- **Reviews/ratings** — better as off-chain EAS attestations indexed by skill_id
- **Versioning** — version bumps create new skillIds (CID changes); migration is consumer concern
- **Search index** — too expensive on-chain; off-chain indexer reads events
- **Reputation aggregation** — separate contract or service can read attestation events
- **Disputes** — for MVP, social layer. Later: stake-and-slash protocol

## Open questions

1. **Skill body availability**. Pinata could go down or stop pinning. Mitigation: pin to multiple providers (Pinata + Web3.Storage + self-host). Long-term: integrate with Filecoin storage deals.

2. **Spam attestations**. Currently anyone can attest. Mitigation: clients filter by attester reputation. Future: stake-based attester gate.

3. **Privacy of invocations**. Tx is public, anyone can see which skills you invoke. Mitigation v2: use account abstraction + paymaster to mix invocations across users.

4. **Skill body discovery vs payment**. Currently `fetch` returns body without paying (just reads IPFS gateway). This is a feature for skill preview, but means free-riding is possible. Mitigation: skill creators include teaser in IPFS, full executable elsewhere. Future: encrypted body decrypted by per-invocation key.

5. **Royalty enforcement on imports**. If someone imports a skill, modifies, and republishes without declaring parent — Atrium contract can't enforce. Detection is off-chain (similarity scoring). Enforcement is community/social.

## Why not just use NFTs?

Skills could be ERC-721/1155. But:
- Skills are **invoked**, not **owned** — invocation rate ≫ ownership transfers
- Royalty on transfer (EIP-2981) doesn't help — we need royalty on **use**
- Skills are non-rivalrous — many can invoke simultaneously
- NFT marketplaces are optimized for collectibles, not high-frequency low-value calls

Atrium's data model is more like a **service registry with embedded payment** — closer to npm + Stripe than OpenSea.

## Why Base specifically?

- **Azul upgrade (May 13, 2026)**: multiproof finality reduces withdrawal time 7d → 1d. Critical for creator cash flow.
- **5000 TPS sustained**: micropayment friendly. 17M gas tx cap → predictable.
- **USDC native**: Circle issues directly on Base, no bridge risk.
- **Account abstraction (Aug 2026)**: future smart wallets reduce friction for agents.
- **Ecosystem**: Base MCP and x402 already there for agent integration.

Could deploy to OP, Arbitrum, Polygon too. Single deployment per chain, sharing the off-chain indexer.
