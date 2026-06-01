#!/usr/bin/env bash
# Atrium installer — builds the `atrium` agent CLI + MCP server and exposes them globally.
#
# Two ways to run:
#   1. Remote (recommended):  curl -fsSL https://atriumhermes.tech/install.sh | bash
#      → clones the repo into ~/.atrium/src, then builds.
#   2. In-repo:               ./scripts/install.sh
#      → builds the checkout you're already in.
#
# Idempotent: safe to re-run. Honours $ATRIUM_HOME (default ~/.atrium) and
# $ATRIUM_REPO (default https://github.com/Atrium-Hermes/Atrium.git).

set -euo pipefail

# ── Helpers ─────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info()  { echo -e "${CYAN}▸${NC} $*"; }
ok()    { echo -e "${GREEN}✓${NC} $*"; }
warn()  { echo -e "${YELLOW}⚠${NC} $*"; }
err()   { echo -e "${RED}✗${NC} $*" >&2; }
title() { echo -e "\n${BOLD}$*${NC}"; }

ATRIUM_HOME="${ATRIUM_HOME:-$HOME/.atrium}"
ATRIUM_REPO="${ATRIUM_REPO:-https://github.com/Atrium-Hermes/Atrium.git}"
ATRIUM_BRANCH="${ATRIUM_BRANCH:-main}"

title "Atrium installer"

# ── Resolve repo root (clone if piped via curl) ─────────
# When run from a checkout, BASH_SOURCE points at scripts/install.sh and the
# parent has cli/. When piped through `bash`, there is no such file → clone.
REPO_ROOT=""
if [ -n "${BASH_SOURCE:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
  CANDIDATE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  [ -f "$CANDIDATE/cli/package.json" ] && REPO_ROOT="$CANDIDATE"
fi

if [ -z "$REPO_ROOT" ]; then
  command -v git &>/dev/null || { err "git is required to bootstrap. Install git and retry."; exit 1; }
  SRC="$ATRIUM_HOME/src"
  if [ -d "$SRC/.git" ]; then
    info "Updating existing checkout at $SRC"
    git -C "$SRC" fetch --quiet origin "$ATRIUM_BRANCH"
    git -C "$SRC" checkout --quiet "$ATRIUM_BRANCH"
    git -C "$SRC" pull --quiet --ff-only origin "$ATRIUM_BRANCH" || warn "Could not fast-forward; using local state"
  else
    info "Cloning $ATRIUM_REPO → $SRC"
    mkdir -p "$ATRIUM_HOME"
    git clone --quiet --branch "$ATRIUM_BRANCH" --depth 1 "$ATRIUM_REPO" "$SRC"
  fi
  REPO_ROOT="$SRC"
fi
cd "$REPO_ROOT"
ok "Source: $REPO_ROOT"

# ── Pre-flight checks ───────────────────────────────────
info "Checking prerequisites..."
command -v node &>/dev/null || { err "Node.js ≥ 20 required. Install from https://nodejs.org"; exit 1; }
NODE_MAJOR=$(node -v | sed -E 's/^v([0-9]+).*/\1/')
[ "$NODE_MAJOR" -ge 20 ] || { err "Node.js ≥ 20 required (have $(node -v))"; exit 1; }
ok "Node.js $(node -v)"
command -v npm &>/dev/null || { err "npm not found"; exit 1; }
ok "npm $(npm -v)"

HAS_FORGE=true
if ! command -v forge &>/dev/null; then
  HAS_FORGE=false
  warn "Foundry not installed — contract build/test/deploy unavailable (consumers/publishers don't need it)"
else
  ok "Foundry $(forge --version | head -n1)"
fi

# ── Build CLI ───────────────────────────────────────────
title "Building CLI"
cd "$REPO_ROOT/cli"
info "npm install..."; npm install --silent
info "Compiling..."; npm run build
# tsc rootDir is the repo root (so shared/ is compiled alongside), so the entry
# emits to dist/cli/src/index.js — matches the "bin" in cli/package.json.
chmod +x dist/cli/src/index.js
ok "CLI built"

# ── Link binaries ───────────────────────────────────────
title "Linking binaries"
NPM_PREFIX=$(npm config get prefix 2>/dev/null || echo "$HOME/.npm-global")
BIN_DIR="$NPM_PREFIX/bin"
if [ ! -d "$BIN_DIR" ] || [ ! -w "$BIN_DIR" ]; then
  BIN_DIR="$HOME/.local/bin"; mkdir -p "$BIN_DIR"
  warn "Using $BIN_DIR (npm global prefix not writable)"
fi
ln -sf "$REPO_ROOT/cli/dist/cli/src/index.js" "$BIN_DIR/atrium"
ok "Linked $BIN_DIR/atrium"

echo ":$PATH:" | grep -q ":$BIN_DIR:" || {
  warn "$BIN_DIR is not on your PATH. Add to your shell rc:"
  echo -e "    ${BOLD}export PATH=\"$BIN_DIR:\$PATH\"${NC}"
}

# ── Build MCP server ────────────────────────────────────
title "Building MCP server"
cd "$REPO_ROOT/mcp-server"
info "npm install..."; npm install --silent
info "Compiling..."; npm run build
chmod +x dist/server.js
ln -sf "$REPO_ROOT/mcp-server/dist/server.js" "$BIN_DIR/atrium-mcp"
ok "Linked $BIN_DIR/atrium-mcp"

# ── Verify ──────────────────────────────────────────────
title "Verifying"
if command -v atrium &>/dev/null; then
  ok "atrium ready: $(which atrium)"
  atrium --version || true
else
  ok "atrium installed at $BIN_DIR/atrium (open a new shell to pick it up)"
fi

# ── Next steps ──────────────────────────────────────────
title "Next: configure your agent"
cat <<EOF
  ${BOLD}atrium init${NC}     Generate your DID + wallet and write ~/.atrium/.env

  Then fund the wallet and you're live:
    ETH (gas):   https://www.alchemy.com/faucets/base-sepolia
    USDC (pay):  on testnet, claim from the in-app faucet
    Pinata JWT:  https://pinata.cloud -> Keys  (set PINATA_JWT in ~/.atrium/.env)

  Discover and invoke a skill:
    ${CYAN}atrium list${NC}
    ${CYAN}atrium invoke <skillId>${NC}

  Publish what your agent learns (and get paid per call):
    ${CYAN}atrium publish ./my-skill${NC}

  Onboarding skill for agents:  examples/skills/atrium-agent/skill.md
  Full guide:                   docs/QUICKSTART.md
EOF
ok "Atrium installed."
