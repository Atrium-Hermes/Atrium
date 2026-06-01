# Comparison

Atrium's primitives exist individually in prior systems; its contribution is their
composition. The table below compares Atrium to the registries and stores that
host reusable software or models today, across the dimensions that matter for a
skill economy.

| Dimension | npm / PyPI [@npm] | Hugging Face Hub [@huggingface] | GPT Store [@gptstore] | agentskills.io [@agentskills] | **Atrium** |
|---|---|---|---|---|---|
| Cryptographic provenance | No | Partial (commit signing) | No | No | **Yes (DID + signature)** |
| Content integrity | Hash in lockfile | Repo hash | Opaque | File-level | **CIDv1 = identity** |
| Per-use economics | None | None | Centralized share | None | **Per-invocation USDC** |
| Royalty / derivation splits | No | No | No | No | **Yes (declared cascade)** |
| Decentralization | Central registry | Central hub | Single vendor | Format only | **Contract + IPFS** |
| Runtime compatibility | Node / Python | ML frameworks | OpenAI only | Cross-runtime | **Cross-runtime (MCP)** |
| Governance of rules | Operator | Operator | Operator | Community spec | **Bounded, non-upgradeable** |
| Platform take rate | 0% (no payments) | 0% (no payments) | 15–30% | n/a | **2.5% (≤5% capped)** |

Two rows deserve emphasis. First, *economics with provenance*: npm and PyPI prove
neither authorship nor offer payment; the GPT Store offers payment but only within
a single vendor's walled garden. Atrium is the only entry that provides
cryptographic authorship *and* a built-in payment-and-royalty rail *across*
runtimes. Second, *take rate*: Atrium's 2.5% sits an order of magnitude below the
15–30% of app-store incumbents, made possible by pushing settlement onto a
low-cost L2 rather than operating centralized billing.

The comparison also clarifies what Atrium is *not* competing on. It does not host
or rank as richly as Hugging Face, nor match npm's decade of tooling. It competes
on a single axis those systems leave open: portable, verifiable, monetizable
authorship for the specific artifact class of agent skills.
