# Deployment, Infrastructure, and Governance

## Why Base

Atrium settles on Base [@base], Coinbase's Ethereum L2, for reasons that are
specific rather than generic:

- **Native USDC.** Circle issues USDC directly on Base [@usdc], so settlement
  needs no bridge and carries no bridge risk.
- **Finality and withdrawals.** The Azul network upgrade introduces multiproof
  finality [@baseazul], compressing the standard rollup withdrawal window from
  roughly seven days toward one — material for creator cash flow.
- **Throughput and cost.** High sustained throughput and consistently sub-cent gas
  are what make $0.001-scale per-invocation pricing economically coherent
  (Chapter 5).
- **Ecosystem.** Agent-facing infrastructure — Base MCP, x402 [@x402], smart
  wallets — is concentrated on Base, so Atrium's consumers and the rails they use
  already live there.

Alternatives were considered and rejected for this stage: Ethereum mainnet's gas
makes micro-payments impossible, and Solana's USDC liquidity fragmentation and
less mature smart-wallet account-abstraction story outweighed its throughput
advantage for a Solidity-based, money-handling contract.

## Off-chain infrastructure

Three off-chain components surround the contract (Figure 1):

- **Indexer.** A single-process daemon subscribes to `AtriumRegistry` events,
  writes them to SQLite (with a full-text index over cached skill bodies), and
  serves a read-only REST API. It exists so that interfaces never query a chain
  RPC per page load. It is strictly read-only — it holds no keys and cannot move
  funds — and the chain remains the source of truth; the indexer caches and
  reconciles.
- **Web interface.** A server-rendered application reads exclusively from the
  indexer for fast, inexpensive loads, and writes (invoke, withdraw, publish,
  deactivate) through the user's browser wallet.
- **Hermes auto-publish plugin.** A sidecar that watches a Hermes runtime's skill
  directory and offers to publish new skills, delegating all signing and chain
  logic to the reference CLI rather than reimplementing it — keeping a single
  source of truth for the security-critical paths.

## Governance

At launch the contract owner is a founder-controlled multisig, but the
*surface* of that control is deliberately tiny: the owner may set the protocol fee
within the hard 5% ceiling and change the treasury address, and may do nothing
else (Chapter 4). User funds, registrations, and the rule set are outside any
admin's reach by construction.

The transition plan is to move these two parameters under community control as
usage grows — first a published policy and timelock on fee changes, then broader
participation. Crucially, because the protocol is tokenless (Chapter 5),
governance is about a small, bounded parameter set rather than the distribution of
a financial instrument, which keeps the transition a matter of process rather than
tokenomics.

## Roadmap

The near-term roadmap has two anchors. In **Q3 2026**, multi-chain settlement:
deploy the same contract to additional USDC-native chains and let DIDs carry
reputation across them. In **Q4 2026**, **stake-based attestation**: replace the
permissionless attestation of the MVP with a scheme in which attesters bond
collateral and can be slashed for false claims, turning attestations from claims
into economically backed signals (Chapters 6, 9). Both are additive; neither
requires changing the core settlement contract.
