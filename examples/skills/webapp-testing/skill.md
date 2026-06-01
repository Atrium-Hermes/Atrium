---
name: webapp-testing
version: 0.1.0
author_did: did:key:z6MkmKiqEnKWnXapCk5NwTiRjCvT9W3GLw8UfDS5kgvzXxsx
description: |
  Interact with and test local web applications using Playwright: verify frontend
  functionality, debug UI behavior, capture browser screenshots, and read browser logs.
tags:
  - testing
  - playwright
  - frontend
  - browser
  - qa
categories:
  - developer-tools
language: en
runtime: node
price_per_call_usdc: '0.003'
parent_skills: []
created_at: '2026-05-31T00:00:00Z'
derivation_method: imported
---

# Web Application Testing

Test local web apps by writing native Playwright scripts.

## Decision tree
- **Static HTML** → read the file to find selectors → write a Playwright script.
- **Dynamic app** → ensure the dev server is running, then drive the page with Playwright
  (navigate, click, type, assert), capturing screenshots and console logs.

## Tips
- Prefer role/label selectors over brittle CSS.
- Capture a screenshot + console log on failure for fast debugging.
- Manage server lifecycle around the test run.

> Imported into Atrium from the Anthropic Skills collection.
