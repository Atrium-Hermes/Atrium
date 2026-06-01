# The AtriumRegistry Contract

The settlement layer is a single, non-upgradeable Solidity contract of roughly 300
lines, built and tested with Foundry [@foundry]. It does three things: it records
skills, it routes payments, and it stores benchmark attestations. It holds USDC
only transiently and never custodies an author's earnings beyond an internal
ledger.

## State and lifecycle

Each skill is stored as a `Skill` struct keyed by its `skillId`: the IPFS `cid`,
the `creator` address (the withdrawal destination), the `didHash`, the
`pricePerCall` (USDC base units), the parent arrays (`parentSkills` and
`parentBps`), bookkeeping counters (`createdAt`, `lastInvoked`,
`totalInvocations`, `totalEarned`), and an `active` flag. Two auxiliary indexes —
an append-only `allSkills` array and a `skillsByCreator` mapping — support
pagination and creator lookups; an off-chain indexer mirrors both (Chapter 7).
Earnings accrue in a single `withdrawable[address]` ledger shared by creators,
parents, and the protocol treasury.

The lifecycle has five entry points:

1. `registerSkill(cid, didHash, price, parentSkills, parentBps)` — validates and
   records a skill, emitting `SkillRegistered`.
2. `invokeSkill(skillId)` — pays to run a skill, splitting the payment.
3. `attestBenchmark(skillId, hash, successRate, sampleCount)` — records a capability
   claim.
4. `deactivateSkill(skillId)` — delists a skill (creator only).
5. `withdraw()` — claims accumulated USDC.

## Payment routing

`invokeSkill` is the heart of the contract (Figure 2). The caller must have
approved the price in USDC. The contract pulls the payment, takes the protocol fee
first, distributes declared parent royalties from the remainder, and credits the
residual to the creator:

```solidity
uint256 protocolCut   = (price * protocolFeeBps) / 10000;   // 250 bps = 2.5%
uint256 distributable = price - protocolCut;
uint256 toCreator     = distributable;
for (uint i; i < skill.parentSkills.length; ++i) {
    uint256 parentCut = (distributable * skill.parentBps[i]) / 10000;
    withdrawable[parent.creator] += parentCut;   // credit, do not send
    toCreator -= parentCut;
}
withdrawable[skill.creator] += toCreator;
```

![Payment flow for a single invocation: pull once, credit many, send on withdraw.](payment-flow.pdf){width=92%}

No funds are *sent* during `invokeSkill`. Recipients are only *credited*; they
later pull their balance with `withdraw`. This pull-payment pattern means a
malicious or contract-based recipient cannot block an invocation by reverting on
receipt, and it confines value transfer to two well-defined points.

## Invariants

The contract is designed around invariants that must hold across every change.

| # | Invariant | Enforcement |
|---|---|---|
| 1 | **Conservation of funds** — credits from one invocation sum to exactly the price | Integer arithmetic; residual assigned to creator |
| 2 | **Pull payments** — external calls only on `transferFrom` (in) and `transfer` (withdraw) | No sends during state mutation |
| 3 | **Royalty cap** — Σ `parentBps` ≤ 5000 (50%) | Checked in `registerSkill` |
| 4 | **Deterministic id** — `skillId = keccak256(cid, didHash, creator)` | Pure derivation; re-register reverts |
| 5 | **Active-parent** — cannot derive from an inactive parent | Checked in `registerSkill` |
| 6 | **One-way deactivation** — a skill cannot be reactivated | No reactivation path exists |
| 7 | **Fee ceiling** — protocol fee ≤ 500 bps (5%) | Hard-coded constant bound |
| 8 | **No reentrancy gain** — re-entry cannot double-spend the ledger | Pull pattern + checks-effects |

Invariant 1 is the load-bearing one: for a payment $P$ with fee rate $f$ and
parent rates $b_i$, the credits are $Pf$ to the treasury (after flooring),
$\lfloor (P - \lfloor Pf \rfloor)\,b_i \rfloor$ to each parent, and the remainder
to the creator. Because the creator receives the *remainder* rather than an
independently floored share, integer truncation can never create or destroy a
base unit: the sum is identically $P$.

## Gas profile

The contract's cost is dominated by storage. `registerSkill` performs several
cold `SSTORE`s (the struct fields plus the two indexes), so its cost scales with
the parent count and the CID length; it is the most expensive operation but is
paid once per skill. `invokeSkill` is $O(\text{parents})$: one ERC-20
`transferFrom`, one fee credit, one credit per declared parent, and the counter
updates — independent of derivation *depth* (Chapter 5). `withdraw` is a single
`transfer` plus a zeroing write. These figures are order-of-magnitude
descriptions of the reference implementation rather than audited measurements; on
Base, where gas is consistently sub-cent, even the registration cost is
negligible relative to a skill's lifetime invocation revenue.

## Upgrade path

The contract is intentionally **non-upgradeable**. There is no proxy, no admin
key over user funds, and no function that can rewrite a registered skill — the
absence of an update path is what makes invariants 3–6 unconditional. The owner's
powers are confined and bounded: adjusting the protocol fee within the 5% ceiling
and changing the treasury address. Evolving the protocol means deploying a new
contract and letting the indexer and clients track both, not mutating deployed
state. This trades operational convenience for a credible guarantee that the rules
a creator published under cannot change beneath them.
