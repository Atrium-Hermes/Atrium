# Security and Trust Model

Atrium's trust model is shaped by what is on-chain (settlement and provenance
hashes), what is off-chain (skill bodies and signatures), and what is explicitly
out of scope (the safety of executing a skill). This chapter states the threat
model, the mitigations, and the open issues honestly.

## Actors and assets

The protected assets are funds in transit through `invokeSkill`/`withdraw`, the
integrity of the authorship binding, and the availability of skill bodies. The
relevant actors are a malicious creator, a malicious consumer, a network-level
adversary (MEV or censorship), and the protocol operator itself.

## Threats and mitigations

**Malicious creator.** A creator might try to substitute a skill's body after
sale, claim someone else's authorship, or grief consumers. Body substitution is
prevented by content addressing: the `skillId` and the price commitment are bound
to a specific CID, so changing the body changes the identifier (Chapter 3). False
authorship is prevented by the Ed25519 signature over the canonical hash, verifiable
against the DID. A creator cannot retroactively raise a price or rewrite terms,
because the contract has no update path (Chapter 4).

**Malicious consumer.** A consumer might attempt to pay less than the price, or to
re-enter the contract during settlement. The price is read from contract storage,
not supplied by the caller, so underpayment is impossible. The pull-payment pattern
plus checks-effects ordering means re-entry yields no double-spend: balances are
credited to an internal ledger and only sent during `withdraw`, which zeroes the
balance before transferring (invariants 2 and 8).

**Network adversary (MEV, censorship).** Invocations are independent value
transfers with no ordering-dependent profit, so they present little
maximal-extractable-value surface. Base is an L2 with a sequencer; a censoring
sequencer could delay transactions, but cannot forge authorship or redirect funds,
and the underlying settlement inherits Ethereum's guarantees.

**Malicious operator.** The protocol owner can change the fee (within the 5% cap)
and the treasury address — and nothing else. The owner cannot move user funds,
deactivate others' skills, alter registrations, or upgrade the contract. This is
the strongest mitigation the design offers: most operator-abuse vectors simply do
not exist because the corresponding functions were never written.

## Reorgs and finality

Reorganizations on Base are rare but possible. The indexer (Chapter 7) commits
each block's events and its cursor in a single transaction and resumes from the
last committed block on restart, so it never double-counts; for the MVP it treats
shallow confirmations as sufficient and documents the residual risk rather than
over-engineering deep-reorg handling. Base's Azul upgrade and its multiproof
finality (Chapter 7) shorten the window in which a reorg is even conceivable.

## Open issues

Three problems are unsolved in v0.1 and are stated plainly:

1. **Content availability.** Deactivating a skill on-chain prevents new
   invocations but cannot remove its bytes from IPFS; conversely, if every pinner
   drops a CID, the body becomes unreachable even though the on-chain record
   persists. Mitigations are replication and gateway rotation, not guarantees.
2. **Free-riding via fetch.** Because bodies are public on IPFS, a consumer can
   read a skill without paying. Atrium charges for *invocation as settlement*, not
   for read access; encrypted bodies with per-invocation decryption keys are a
   research direction (Chapter 9). Today the incentive to pay is honesty,
   attestation-backed trust, and integration convenience.
3. **Sybil attestation.** In the MVP anyone may post a benchmark attestation, so
   attestations are claims, not proofs. Consumers should weight them by attester
   reputation. Stake-based or zero-knowledge-verified attestation (Chapters 7, 9)
   is the intended hardening.

A final, important boundary: Atrium makes no claim about the *safety of running* a
skill. A skill body is code or instructions an agent executes; provenance tells
you *who* wrote it and integrity tells you *that it is unchanged*, but neither
tells you it is *safe*. Sandboxing and capability control belong to the runtime,
not to the marketplace.
