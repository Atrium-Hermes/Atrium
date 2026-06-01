#!/usr/bin/env bash
#
# Build the Atrium whitepaper: render Mermaid diagrams, concatenate chapters,
# and run pandoc (LaTeX backend) to produce atrium-whitepaper.pdf.
#
# Requires: pandoc, a LaTeX engine (xelatex|pdflatex|tectonic), and the Mermaid
# CLI (mmdc, from @mermaid-js/mermaid-cli) for diagram rendering.
set -euo pipefail

cd "$(dirname "$0")"
BUILD_DIR="build"
OUT="atrium-whitepaper.pdf"
PDF_ENGINE="${PDF_ENGINE:-xelatex}"

need() { command -v "$1" >/dev/null 2>&1; }

# ── tool checks ──────────────────────────────────────────────────────────────
if ! need pandoc; then
  echo "✗ pandoc not found. Install: https://pandoc.org/installing.html" >&2
  exit 1
fi
if ! need "$PDF_ENGINE"; then
  for alt in xelatex pdflatex tectonic; do
    if need "$alt"; then PDF_ENGINE="$alt"; break; fi
  done
fi
if ! need "$PDF_ENGINE"; then
  echo "✗ No LaTeX engine found (xelatex|pdflatex|tectonic). Install TeX Live or tectonic." >&2
  exit 1
fi
echo "→ pandoc $(pandoc --version | head -1 | awk '{print $2}'), engine: $PDF_ENGINE"

mkdir -p "$BUILD_DIR"

# ── 1. render Mermaid diagrams to PDF (skipped if mmdc is unavailable) ─────────
if need mmdc; then
  for mmd in diagrams/*.mmd; do
    [ -e "$mmd" ] || continue
    name="$(basename "${mmd%.mmd}")"
    echo "→ rendering diagram: $name"
    # In CI/containers Chromium needs --no-sandbox; pass a puppeteer config when
    # PUPPETEER_CONFIG is set (e.g. {"args":["--no-sandbox"]}). No-op locally.
    mmdc -i "$mmd" -o "$BUILD_DIR/$name.pdf" -b transparent ${PUPPETEER_CONFIG:+-p "$PUPPETEER_CONFIG"} >/dev/null
  done
else
  echo "⚠ mmdc (mermaid-cli) not found — diagrams will be missing." >&2
  echo "  Install: npm i -g @mermaid-js/mermaid-cli" >&2
fi

# ── 2. concatenate chapters in order ───────────────────────────────────────────
echo "→ assembling chapters"
cat chapters/*.md > "$BUILD_DIR/combined.md"

# ── 3. render PDF ──────────────────────────────────────────────────────────────
echo "→ running pandoc → $OUT"
pandoc \
  metadata.yaml \
  "$BUILD_DIR/combined.md" \
  --citeproc \
  --pdf-engine="$PDF_ENGINE" \
  --resource-path=".:$BUILD_DIR:diagrams" \
  -V colorlinks=true \
  -o "$OUT"

echo "✓ wrote $OUT"
