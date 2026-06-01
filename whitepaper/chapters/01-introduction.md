# Introduction

## The skill economy

A new unit of software is emerging. As AI agents move from one-shot prompting to
long-running, self-improving loops, they increasingly externalize what they learn
as *skills*: self-contained, executable capabilities expressed as Markdown with
structured metadata and, optionally, code. A skill captures a repeatable
procedure — extracting tables from PDFs, refactoring a TypeScript module,
optimizing a SQL query — in a form another agent can discover and run.

Agent runtimes already produce these artifacts organically. Hermes Agent's closed
learning loop, for example, distills successful tool-use episodes into reusable
skill files written to the local filesystem [@hermes]. The Model Context Protocol
has standardized how agents *call* external capabilities at runtime [@mcp], and
formats such as agentskills.io have begun to standardize how skills are *written*
[@agentskills]. The raw material of a skill marketplace exists.

What does not exist is the connective tissue. A skill generated inside one runtime
is trapped there. There is no portable, verifiable record of who authored it; no
guarantee that the bytes a consumer fetches are the bytes the author published;
and no mechanism to compensate an author when their skill is reused by someone
else's agent. The value a skill represents — sometimes the product of thousands of
tokens of agent reasoning — stays locked to the machine that produced it.

## What is missing

Three primitives are missing, and they are economic and cryptographic rather than
computational:

1. **Provenance.** A durable, verifiable claim of authorship that survives across
   runtimes and outlives any single wallet or device.
2. **Integrity.** A way for a consumer to confirm that the skill they are paying
   for is exactly the skill the author signed — no substitution, no tampering.
3. **Settlement.** A way to pay an author per use, and to split that payment with
   the authors of any skills a derived work builds upon.

These are precisely the primitives that package registries (npm, PyPI), model
hubs (Hugging Face), and app stores (the GPT Store) only partially provide, and
that none provide together with cryptographic authorship and a built-in royalty
mechanism (Chapter 8).

## Atrium

Atrium supplies these three primitives as a thin layer beneath existing runtimes.
It is explicitly **not** a new agent runtime, model marketplace, or identity
issuer. A skill published to Atrium is:

1. **Signed** with a decentralized identifier (DID), binding it to its author
   (Chapter 3);
2. **Content-addressed** on IPFS, so its identifier is a hash of its bytes
   (Chapter 3);
3. **Priced per invocation** in USDC, settled by a small non-upgradeable contract
   on Base (Chapters 4–5);
4. **Composable**, so a derived skill can declare its ancestors and route a share
   of each invocation back to them (Chapter 5);
5. **Attestable**, so anyone can post an on-chain claim that a skill passes a named
   benchmark at a given success rate (Chapter 4).

The mental model that motivates every design decision is a single analogy: *a
skill is to an AI agent what an npm package is to a Node.js program — but signed
by its author, addressed by its content, and paid per call.* The remainder of this
paper makes that analogy precise. Chapters 3–4 specify the protocol and contract;
Chapters 5–6 cover economics and security; Chapter 7 covers deployment and
governance; Chapters 8–9 compare Atrium to prior systems and outline open
problems.
