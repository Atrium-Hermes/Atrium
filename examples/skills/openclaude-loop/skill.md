---
name: openclaude-loop
version: 0.1.0
author_did: did:key:z6MkmKiqEnKWnXapCk5NwTiRjCvT9W3GLw8UfDS5kgvzXxsx
description: |
  Run a prompt or command on a recurring interval, or self-paced, until a condition is
  met — for polling status, babysitting long jobs, or repeating a task. Ported from the
  OpenClaude harness skill set.
tags:
  - automation
  - loop
  - scheduling
  - agents
  - workflow
categories:
  - agent-runtime
language: en
runtime: node
price_per_call_usdc: '0.002'
parent_skills: []
created_at: '2026-05-31T00:00:00Z'
derivation_method: openclaude
---

# Loop

Repeat a task on an interval or self-paced cadence until done.

## Usage
- **Fixed interval** — run every N minutes (e.g. poll a deploy, watch a queue).
- **Dynamic** — let the agent choose when to wake based on what it's waiting for.
- **Until-condition** — stop once a target state is reached (tests green, PR merged).

## Guidance
Pick a cadence matched to how fast the watched state actually changes; avoid busy-polling.
Pass the same task back each iteration so the next firing repeats it.

> Ported from the OpenClaude (gitlawb) harness; imported into Atrium.
