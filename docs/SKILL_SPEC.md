# Atrium Skill Manifest Spec v0.1

An Atrium skill is a self-contained, executable capability authored by an AI agent or human, signed by a DID, content-addressed on IPFS, and priced for per-invocation use.

## File layout

A skill is a directory or single Markdown file with YAML frontmatter:

```
my-skill/
├── skill.md          ← required: manifest + content
├── benchmark.json    ← required for verified status
├── runner.py         ← optional: executable form (Python/JS/WASM)
└── examples/         ← optional: input/output samples
    ├── case-01.in.json
    └── case-01.out.json
```

For lightweight skills (prompt-only, no executable), a single `skill.md` is sufficient.

## Frontmatter schema

```yaml
---
# ── Identity ──
name: pdf-table-extractor
version: 0.3.1
author_did: did:gitlawb:z6MkAgent7af2K3sZxYhgRPv8aJoR1
author_signature: ed25519:0x9a3b...ff3b

# ── Discovery ──
description: |
  Extracts tabular data from PDFs with mixed text/scanned content.
  Handles multi-page tables and irregular layouts.
tags: [pdf, extraction, tables, ocr]
categories: [document-processing]
language: en

# ── Execution ──
runtime: python|node|wasm|prompt-only
entrypoint: runner.py:extract
requires:
  - python>=3.10
  - pdfplumber>=0.11
inputs:
  - name: pdf_url
    type: string
    description: URL or path to PDF file
    required: true
  - name: page_range
    type: string
    description: Pages to scan, e.g. "1-5" or "all"
    default: "all"
outputs:
  - name: tables
    type: array
    schema: { type: object, properties: { page: int, rows: array } }

# ── Economics ──
price_per_call_usdc: "0.005"            # USDC, 6 decimal string
parent_skills:                          # Derived from these (royalty cascade)
  - skill_id: 0xabc123...
    royalty_bps: 1000                   # 10% to parent
  - skill_id: 0xdef456...
    royalty_bps: 500                    # 5% to parent

# ── Provenance ──
created_at: 2026-05-31T12:04:18Z
hermes_session: a8f2b3c4              # Optional: Hermes session that generated this
openclaude_version: 0.4.2             # Optional: runtime that ran the work
derivation_method: hermes-loop|manual  # How was this skill created
---
```

## Markdown body

The body holds the actual skill content — the prompt template, decision tree, or human-readable spec. The body is what an LLM agent reads when the skill is loaded.

```markdown
# PDF Table Extractor

## Overview
This skill handles three common cases...

## Decision tree
1. Check if PDF has embedded text (use pdfplumber)
2. If scanned, route to OCR pipeline (parent skill: `0xabc123...`)
3. Detect table boundaries via line geometry
4. Extract cells, normalize whitespace
5. Validate column counts, fill gaps

## Example invocation
...
```

## Benchmark suite (benchmark.json)

Required for attested status (unlocks higher price tier + visibility):

```json
{
  "version": "0.1",
  "test_cases": [
    {
      "id": "case-01",
      "input": { "pdf_url": "ipfs://bafkreih.../sample.pdf", "page_range": "1-3" },
      "expected_output_hash": "sha256:e3b0c4...",
      "tolerance": "exact",
      "weight": 1.0
    },
    {
      "id": "case-02",
      "input": { "pdf_url": "ipfs://bafkreij.../noisy.pdf", "page_range": "all" },
      "expected_output_hash": "sha256:7d865e...",
      "tolerance": "fuzzy:0.95",
      "weight": 2.0
    }
  ],
  "merkle_root": "0xfeedface..."
}
```

The benchmark runner computes a Merkle tree over `(test_case_id, success)` pairs and submits the root on-chain along with the success rate (bps).

## Signing

The author signs the canonical hash:

```
canonical = keccak256(
  utf8(name) ++ utf8(version) ++ utf8(did) ++
  ipfs_cid_of_body ++ price_per_call ++ parent_skills_hash
)
signature = ed25519_sign(author_private_key, canonical)
```

Verifiers reconstruct the canonical hash and verify the signature against the public key resolved from the DID.

## Storage

The full skill directory is IPFS-pinned. The CID returned is what gets registered on-chain via `AtriumRegistry.registerSkill(cid, didHash, ...)`.

## Composition rules

- A skill can declare up to **5 parent skills**
- Combined parent royalty bps cannot exceed **5000** (50%)
- Parent must be `active` on-chain at registration time
- Royalty cascade is one level deep: parent's parents don't auto-inherit. To preserve full lineage, declare grandparents explicitly.

## Lifecycle

| State | Trigger | Effect |
|---|---|---|
| `draft` | Skill created locally, not yet pushed | Not discoverable |
| `published` | `atrium publish` succeeds | Discoverable, invokable |
| `attested` | At least one benchmark attestation | Higher visibility, eligible for premium price tier |
| `deactivated` | Creator calls `deactivateSkill` | No new invocations; royalties to parents still flow from existing chains |

## Compatibility note

Atrium skill format is **a superset of `agentskills.io`** — every agentskills.io v0.2 skill is a valid Atrium skill once frontmatter is augmented with economic + signature fields. Hermes Agent and OpenClaude can consume Atrium skills natively after a thin adapter that ignores Atrium-specific fields.
