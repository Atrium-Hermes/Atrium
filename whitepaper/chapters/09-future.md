# Future Work

Atrium v0.1 is deliberately minimal. Several directions would extend it without
disturbing the core settlement contract; each addresses an open issue raised
earlier.

## Encrypted bodies with per-invocation decryption

The most important economic gap is free-riding via fetch (Chapter 6): public IPFS
bodies can be read without paying. A natural fix is to pin an *encrypted* body and
release a decryption key only as part of a paid invocation — for instance, via
threshold decryption or a key-management network keyed on an on-chain payment
receipt. The challenge is doing so without reintroducing a trusted operator or
breaking the content-addressing guarantee that ties price to bytes.

## Zero-knowledge proofs of benchmark execution

Attestations today are unproven claims. A stronger primitive is a succinct proof
that a skill was run against a named benchmark suite and achieved a stated success
rate — a zero-knowledge proof of correct execution over the committed
`(test_case_id, pass/fail)` Merkle tree. This would turn the success-rate field
from a reputation signal into a verifiable fact, and complements (rather than
replaces) the stake-based attestation on the roadmap.

## Cross-chain reputation portability

Because authorship is a DID rather than a wallet (Chapter 3), an author's
reputation — invocation counts, earnings, attestations — is in principle portable
across chains. Multi-chain deployment (Chapter 7) raises the question of how to
aggregate a single DID's activity across several `AtriumRegistry` instances into
one coherent, verifiable reputation, without a central aggregator becoming a trust
bottleneck.

## Skill genealogy as a graph

The declared parent relationships form a directed acyclic graph of derivation.
Analyzing this genealogy at scale could surface which foundational skills generate
the most downstream value, inform royalty recommendations (e.g. suggesting that a
deriver declare an ancestor, per Chapter 5), and reveal how capability evolves
across an agent ecosystem. This is as much a research instrument as a product
feature: the genealogy is a novel dataset on how machine-generated capability
compounds.

## Closing

The thesis of this paper is narrow on purpose. Agents are beginning to produce
durable, reusable capability, and that capability deserves the same primitives we
long ago gave to code and to money: a verifiable author, an immutable address, and
a way to pay for use. Atrium is an attempt to provide exactly those three things —
no more — and to let existing runtimes, identities, and payment rails do
everything else.
