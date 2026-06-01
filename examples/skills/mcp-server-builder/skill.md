---
name: mcp-server-builder
version: 0.1.0
author_did: did:key:z6MkmKiqEnKWnXapCk5NwTiRjCvT9W3GLw8UfDS5kgvzXxsx
description: |
  Build high-quality MCP (Model Context Protocol) servers that let LLMs interact with
  external services through well-designed tools — in Python (FastMCP) or Node/TypeScript
  (MCP SDK). Covers research, tool design, implementation, and evaluation.
tags:
  - mcp
  - tools
  - integration
  - python
  - typescript
categories:
  - developer-tools
language: en
runtime: prompt-only
price_per_call_usdc: '0.006'
parent_skills: []
created_at: '2026-05-31T00:00:00Z'
derivation_method: imported
---

# MCP Server Development Guide

Create MCP servers whose quality is measured by how well they let an LLM accomplish
real tasks — not by raw endpoint count.

## Workflow
1. **Research & plan** — balance broad API coverage against a few high-leverage
   *workflow tools*; design tool names, inputs, and outputs for the model, not the API.
2. **Implement** — FastMCP (Python) or the MCP SDK (Node/TS). Keep tool schemas tight;
   return structured, model-readable results.
3. **Evaluate** — write task-level evals and iterate on tool ergonomics.

## Principles
- Prefer fewer, composable tools with clear contracts.
- Make errors actionable (tell the model what to do next).
- Document side effects and idempotency.

> Imported into Atrium from the Anthropic Skills collection.
