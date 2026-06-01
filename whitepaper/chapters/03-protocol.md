# Protocol

Atrium's off-chain protocol defines what a skill *is*, how authorship is proven,
and how a skill's bytes are named. The on-chain contract (Chapter 4) only ever
sees three derived values: a content identifier, a hash of the author's DID, and a
price. Everything else lives off-chain, which keeps the contract small and the
system censorship-resistant (Figure 1).

![Atrium architecture: an author signs and pins a skill and registers it on Base; an indexer mirrors events and caches bodies; consumers discover and invoke via MCP or the web.](architecture.pdf){width=95%}

## The skill manifest

A skill is a Markdown file (or a directory containing `skill.md` plus optional
assets such as `benchmark.json`). YAML frontmatter carries the manifest; the
Markdown body is the prompt, decision procedure, or code specification the agent
reads. The manifest is a superset of the agentskills.io format, grouped into five
concerns:

| Group | Fields | Purpose |
|---|---|---|
| Identity | `name`, `version`, `author_did`, `author_signature` | Who, what, which release |
| Discovery | `description`, `tags`, `categories`, `language` | Search and classification |
| Execution | `runtime`, `entrypoint`, `requires`, `inputs`, `outputs` | How to run it |
| Economics | `price_per_call_usdc`, `parent_skills[]` | Price and royalty splits |
| Provenance | `created_at`, `derivation_method`, `hermes_session`, `openclaude_version` | How it was produced |

Prices are written as decimal USDC strings (e.g. `"0.005"`) to avoid floating-point
loss and are converted to base units — USDC has **six** decimals — at the
boundary. Each entry in `parent_skills` is a `(skill_id, royalty_bps)` pair, where
basis points are hundredths of a percent.

## Identity: did:key over Ed25519

Authors are identified by a W3C decentralized identifier [@didcore], specifically
the `did:key` method over an Ed25519 keypair [@didkey; @ed25519]. The DID is
derived by prefixing the 32-byte public key with the Ed25519 multicodec
(`0xed01`) and base58-encoding the result: `did:key:z<base58(0xed01 ‖ pubkey)>`.

Identity is deliberately separated from the on-chain wallet. Authorship is
durable; wallets rotate. A creator may migrate from one EVM wallet to another —
after losing a device or moving to account abstraction — without losing the
identity their reputation accrues to. The same DID could later be linked to a
non-EVM chain, giving authorship cross-chain portability.

## Content addressing

The skill bundle is pinned to IPFS [@ipfs], yielding a CIDv1 content identifier.
Because the CID is a hash of the bytes, *identity equals integrity*: if the body
changes, the CID changes, so a consumer can verify that what they fetched is what
they are paying for. Pinning is replicated, so removing a skill requires
coordinated action rather than a single operator's decision. The reference
implementation uses Pinata as the primary pinning service for latency and
reliability; the indexer (Chapter 7) rotates across public gateways
(`ipfs.io`, `dweb.link`, `w3s.link`) when fetching bodies for its cache.

## Canonical hashing and signatures

To sign a skill, the author computes a canonical hash over the fields that define
it economically and semantically: the UTF-8 concatenation of `name`, `version`,
the DID, the body CID, the price in base units (as a decimal string), and the
parent list serialized as `id:bps` pairs joined by commas. The SHA-256 digest of
that concatenation is signed with the author's Ed25519 key, and the signature is
stored in the manifest as `author_signature = "ed25519:0x<sig>"`. Any party can
verify the signature against the DID's embedded public key without touching the
chain.

## Deriving the on-chain identifier

Two values bridge to the contract. The **DID hash** is the SHA-256 digest of the
DID string, stored on-chain as a `bytes32` because the full DID is too long to
store economically. The **skill identifier** is then deterministic:

$$\text{skillId} = \text{keccak256}\big(\text{abi.encodePacked}(\text{cid},\ \text{didHash},\ \text{creator})\big)$$

Because the inputs are fixed before submission, the author (and any client) can
predict the `skillId` off-chain. The same content, from the same author, at the
same wallet, always yields the same identifier — and re-registering it is rejected
by the contract (Chapter 4).
