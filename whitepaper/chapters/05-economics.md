# Economics

Atrium's economic design follows from one choice — pricing per invocation — and
one constraint — that the mechanism must be implementable entirely on-chain with
bounded cost. This chapter motivates per-invocation pricing, works through the
royalty cascade, justifies the protocol fee, and explains the tokenless thesis.

## Why per-invocation pricing

A skill could be sold by subscription, as a one-time purchase, or per use. Atrium
chooses per use for four reasons:

1. **Aligned incentives.** A creator earns when value is delivered, not when a
   promise is made. A skill that is rarely useful earns rarely.
2. **Composability.** The royalty cascade requires a settlement event each time
   value flows; only per-invocation pricing produces one.
3. **Runtime fit.** Agents call skills one at a time. Per-invocation pricing
   matches the natural granularity of an MCP tool call [@mcp].
4. **On-chain feasibility.** Subscriptions require off-chain billing state and
   renewal logic; per-invocation settlement runs in a single transaction with no
   trusted billing operator.

The cost is sensitivity to gas: if the gas to invoke ever exceeds the skill price,
low-priced skills become uneconomic to call. Base's sub-cent gas makes
$0.001-scale prices viable; Chapter 6 notes the residual risk during gas spikes.

## The royalty cascade, worked

Consider a derivation chain $A \rightarrow B \rightarrow C$ (Figure 3). Carol
authors $A$; Alice derives $B$ from $A$ and declares $A$ as a parent at 20%; Dave
derives $C$ from $B$ and declares $B$ as a parent at 15%. Suppose Dave prices $C$
at $P$ and the protocol fee is 2.5%.

When a consumer invokes $C$:

- the treasury receives $0.025P$;
- the distributable amount is $0.975P$;
- Alice (as author of parent $B$) receives $0.15 \times 0.975P = 0.146P$;
- Dave receives the remainder, $0.829P$;
- **Carol receives nothing** — unless Dave *also* declares $A$ as a parent of $C$.

This non-transitivity is deliberate. Royalties are paid only to *declared, direct*
parents, never propagated up an inferred ancestry. The consequences are:

- **Predictability.** Each author can compute their exact per-invocation revenue
  from their own manifest, with no dependence on what their descendants do.
- **Bounded cost.** A payment is $O(\text{declared parents})$, never
  $O(\text{depth})$; derivation chains can be arbitrarily deep without raising
  the gas of any single invocation, removing a denial-of-service vector.
- **Honest accounting.** Compensating an ancestor requires explicitly declaring
  it, which prevents accidental royalty leakage. If Alice wants Carol to share in
  $C$'s revenue, the social and tooling answer is for Dave to declare both $B$ and
  $A$ as parents — Atrium's clients can surface this suggestion.

The 50% cap on combined parent royalties (invariant 3) guarantees a derived
skill's author always retains at least half of the distributable amount,
preserving the incentive to build derivatives at all.

## The protocol fee

Atrium takes a flat 2.5% (250 bps) of each invocation, hard-capped at 5% (500 bps)
by the contract. The fee funds indexing, gateways, and protocol maintenance. Its
level is best understood comparatively (Chapter 8): the GPT Store and app stores
take 15–30% [@gptstore], while npm takes nothing but offers no payment rail at all
[@npm]. A 2.5% take positions Atrium far below platform incumbents while remaining
sufficient to operate the public-good infrastructure. The 5% ceiling is a credible
commitment: because the contract is non-upgradeable, no future operator can raise
the fee past it.

## The tokenless thesis

Atrium has no native token, by design. Settlement is in USDC [@usdc], a regulated
stablecoin, for three reasons. **Creators want dollars,** not exposure to a
volatile asset whose price is unrelated to their work. **Regulatory clarity:**
denominating in an existing regulated instrument avoids the question of whether a
new token is a security. **No bootstrap problem:** adopting money that already
exists means day-one usability with no liquidity-mining subsidy.

More fundamentally, Atrium has no function that a token would serve better than
USDC. There is no governance question that requires a vote-weighted token, no
liquidity that needs incentivizing, and no staking that the current design
depends on. Tokens add legal complexity, distribution problems, and dilution risk.
A token can always be added later if a concrete need emerges — for example, the
stake-based attestation scheme sketched in Chapter 7 — whereas a token, once
issued, is very hard to remove. The default is therefore to ship without one.
