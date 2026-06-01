# Atrium Quickstart

Five minutes from zero to your first published and paid skill.

## Prerequisites

- Node.js ≥ 20
- Foundry (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- Base Sepolia ETH (for gas): https://www.alchemy.com/faucets/base-sepolia
- Base Sepolia USDC: https://faucet.circle.com
- A Pinata account for IPFS pinning (free tier is fine): https://pinata.cloud

## 1. Installation

```bash
git clone --recurse-submodules https://github.com/Atrium-Hermes/Atrium
cd Atrium

# Install CLI
cd cli && npm install && npm run build
sudo npm link  # makes `atrium` available globally
cd ..

# Install MCP server
cd mcp-server && npm install && npm run build
cd ..

# Forge deps — forge-std is a git submodule (skip if cloned with --recurse-submodules)
git submodule update --init --recursive
forge build
```

## 2. Deploy the registry to Base Sepolia

Skip this step if you plan to use the official deployment (TBA).

```bash
# Create deployer env
cat > .env << EOF
PRIVATE_KEY=0xYOUR_DEPLOYER_KEY
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASESCAN_API_KEY=your-basescan-api-key
EOF

source .env
forge script scripts/DeployAtrium.s.sol \
  --rpc-url base_sepolia \
  --broadcast \
  --verify
```

Copy the deployed registry address — you will need it next.

## 3. Set up your identity

```bash
atrium init
```

This generates:
- An Ed25519 DID keypair (stored in `~/.atrium/identity.json`, permissions 600)
- An EVM wallet private key (stored in `~/.atrium/.env`)

Edit `~/.atrium/.env` and add the registry address:

```env
ATRIUM_PRIVATE_KEY=0x...    # auto-generated
ATRIUM_NETWORK=base-sepolia
ATRIUM_REGISTRY_SEPOLIA=0x...   # paste from deploy step
PINATA_JWT=eyJhbGc...           # from pinata.cloud/keys
```

## 4. Fund your wallet

```bash
# Check your wallet address
atrium balance

# Hit faucets:
# - https://www.alchemy.com/faucets/base-sepolia (ETH for gas)
# - https://faucet.circle.com → choose Base Sepolia (USDC for testing invocations)

# Verify
atrium balance
```

You need at least:
- ~0.001 ETH for gas (enough for a few transactions)
- ~1 USDC for testing invocations

## 5. Publish a skill

Use the included example:

```bash
# Edit author_did in the manifest
ATRIUM_DID=$(cat ~/.atrium/identity.json | jq -r .did)
sed -i "s|did:key:z6MkREPLACE_WITH_YOUR_DID_AFTER_INIT|$ATRIUM_DID|" \
  examples/skills/pdf-table-extractor/skill.md

# Dry run first
atrium publish examples/skills/pdf-table-extractor --dry-run

# Actually publish
atrium publish examples/skills/pdf-table-extractor
```

You will see:
```
✓ Pinned to IPFS: bafkreih...
✓ Signed with Ed25519
✓ Registered on-chain in block 1234567

◆ Published
  Skill ID:    0xabc123...
  IPFS CID:    bafkreih...
  Tx:          0xdef456...
  Explorer:    https://sepolia.basescan.org/tx/0xdef456...
```

## 6. Invoke your own skill (test run)

```bash
# Copy the skill ID from publish output
SKILL_ID=0xabc123...

# Pay yourself (0.005 USDC test)
atrium invoke $SKILL_ID

# Check earnings
atrium balance
# Should show withdrawable balance > 0

# Claim
atrium withdraw
```

A 2.5% protocol fee goes to the treasury; you receive the remainder, minus any parent royalties (there are none in this example).

## 7. Run a benchmark + attestation

```bash
atrium benchmark $SKILL_ID --output bench-result.json

# Copy the merkle root + success rate from output, then:
atrium attest $SKILL_ID \
  --merkle-root 0x... \
  --success-rate 8500 \
  --sample-count 5
```

In the MVP, benchmark execution is simulated (random success rate around ~85%). In production, the skill will actually be run inside a sandboxed container.

## 8. Use it from a Claude/Hermes agent

Add this to your MCP configuration (usually `~/.config/claude/mcp.json`, or a platform-specific path):

```json
{
  "mcpServers": {
    "atrium": {
      "command": "node",
      "args": ["/absolute/path/to/atrium/mcp-server/dist/server.js"],
      "env": {
        "ATRIUM_PRIVATE_KEY": "0x...",
        "ATRIUM_REGISTRY_SEPOLIA": "0x...",
        "ATRIUM_NETWORK": "base-sepolia",
        "PINATA_JWT": "eyJ..."
      }
    }
  }
}
```

For Hermes Agent specifically:

```bash
# Hermes uses .hermes/mcp.json
cat >> ~/.hermes/mcp.json << 'EOF'
{
  "atrium": {
    "command": "node",
    "args": ["/path/to/atrium/mcp-server/dist/server.js"]
  }
}
EOF
```

Now, within an agent session, you can do this:

> "Find skills tagged 'pdf' on Atrium"
>
> [agent calls atrium_search]
>
> "Show me the cheapest one"
>
> [agent calls atrium_quote, picking the lowest price]
>
> "Invoke it, up to a maximum of 0.01 USDC"
>
> [agent calls atrium_invoke, pays, loads the body, executes]

## 9. Build your own skill

Start from the template:

```bash
mkdir -p my-skills/sentiment-analyzer
cd my-skills/sentiment-analyzer

cat > skill.md << 'EOF'
---
name: sentiment-analyzer
version: 0.1.0
author_did: YOUR_DID_HERE
description: Analyzes sentiment of social media posts with confidence scores.
tags: [nlp, sentiment, social]
categories: [nlp]
language: en
runtime: prompt-only
inputs:
  - name: text
    type: string
    required: true
outputs:
  - name: sentiment
    type: object
price_per_call_usdc: '0.001'
parent_skills: []
created_at: '2026-05-31T12:00:00Z'
derivation_method: manual
---

# Sentiment Analyzer

[your prompt + decision tree here]
EOF

cd ../..
atrium publish my-skills/sentiment-analyzer
```

## Common problems

**"PINATA_JWT not set"** — Get a free JWT at https://pinata.cloud/keys, scoping it to `pinFileToIPFS` and `pinJSONToIPFS`. Add it to `~/.atrium/.env`.

**"Insufficient USDC"** — Use the faucet at https://faucet.circle.com. Make sure you select Base Sepolia, not Ethereum.

**"Registry not configured"** — Set `ATRIUM_REGISTRY_SEPOLIA=0x...` in `~/.atrium/.env`.

**"Skill exists"** — Same creator + same CID = same skillId. Bump the version in the manifest to get a new CID.

**"ParentInactive"** — The parent skill has been deactivated by its creator. Use a different parent, or coordinate with the creator to reactivate it (there is currently no mechanism for this — in the MVP, deactivation is permanent).

## Next steps

- Read `docs/SKILL_SPEC.md` for the full manifest specification
- Read `docs/ARCHITECTURE.md` for the design rationale
- Check `examples/skills/` for more skill templates
- Join the dev channel: [link TBA]
