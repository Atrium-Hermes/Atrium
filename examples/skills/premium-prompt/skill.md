---
name: premium-prompt
version: 0.1.0
author_did: did:key:z6MkmKiqEnKWnXapCk5NwTiRjCvT9W3GLw8UfDS5kgvzXxsx
description: |
  A paywalled skill demo: the body (a high-value system prompt + decision tree) is
  encrypted on IPFS and only decryptable after you invoke (pay for) the skill.
tags:
  - prompt
  - premium
  - encrypted
categories:
  - prompts
language: en
runtime: prompt-only
price_per_call_usdc: '0.01'
parent_skills: []
created_at: '2026-05-31T00:00:00Z'
derivation_method: manual
---

# Premium Prompt (secret)

This is the protected body. In a real premium skill this would be the carefully
tuned system prompt, decision tree, or proprietary procedure the author sells.

## Secret procedure
1. Frame the task as <REDACTED-UNTIL-PAID>.
2. Apply the proprietary scoring heuristic.
3. Emit the structured result.

If you can read this in plaintext on IPFS, the body was NOT encrypted. When
published with `--encrypt`, IPFS only stores ciphertext and this text is released
solely to wallets that have invoked (paid for) the skill.
