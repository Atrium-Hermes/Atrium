# Prior Work

Atrium sits at the intersection of agent runtimes, identity systems, agent
payment rails, and software registries. This chapter surveys each and locates the
gap Atrium fills.

## Agent runtimes that generate skills

**Hermes Agent** [@hermes] is an open-source, self-improving agent runtime built
around a closed learning loop and a layered memory system. When the loop succeeds
at a task, it can distill the episode into a skill file on disk. Hermes is the
canonical *producer* of skills for Atrium: the auto-publish plugin described in
Chapter 7 watches Hermes' skill directory and offers to publish new skills.
Atrium treats runtimes like Hermes as partners, not competitors — it captures the
value their loops create without replacing the loops.

**OpenClaude** [@openclaude] is an open agent harness with first-class
decentralized identity, developed in the gitlawb ecosystem. Atrium reuses the same
DID identity primitives, which makes skills authored under either system mutually
verifiable. gitlawb's decentralized storage is a candidate backend for a future
Atrium storage tier.

## Calling versus publishing skills

The **Model Context Protocol (MCP)** [@mcp] standardizes how an agent *invokes*
external tools and data sources at runtime. Atrium ships an MCP server so that any
MCP-capable agent can discover and invoke Atrium skills as ordinary tools; MCP is
the runtime-facing edge of the system. Where MCP standardizes the *call*,
**agentskills.io** [@agentskills] standardizes the *artifact* — a portable skill
file format. Atrium's manifest is a superset of that format: it adds the identity,
economic, and provenance fields a marketplace requires while remaining readable by
plain agentskills.io consumers.

## Agent payment rails

**x402** [@x402] revives the dormant HTTP 402 status code as a payment protocol,
carrying stablecoin payments in an `X-PAYMENT` header so that an API can charge
per request. **Base MCP** and Coinbase's smart-wallet stack give agents
programmatic custody on Base. Atrium is complementary: it is an *application* of
these rails specialized to skills, defining what is being paid for (a
content-addressed, signed capability) and how the payment is split (the royalty
cascade), rather than inventing a new transport.

## Software and model registries

Existing registries each solve part of the problem:

- **npm / PyPI** [@npm] provide discovery and versioning for code packages but no
  cryptographic authorship binding and no payment primitive — publishing is free
  and anonymous-by-default.
- **Hugging Face Hub** [@huggingface] hosts models and datasets with rich metadata
  and social features, but has no native per-use economic primitive and no
  on-chain provenance.
- **The GPT Store** [@gptstore] offers discovery and a centralized revenue-share
  program, but is a closed, single-vendor platform: listings, payments, and
  takedowns are all controlled by one operator.

None combine portable cryptographic provenance, content integrity, and built-in
per-invocation royalties across runtimes. Chapter 8 returns to this comparison in
tabular form. Atrium's contribution is not any single primitive — DIDs, IPFS, and
ERC-20 settlement all predate it — but their composition into a minimal,
tokenless protocol purpose-built for the skill economy.
