"""Parse + augment Hermes-generated skill.md frontmatter.

The sidecar does NOT fully validate against the Atrium manifest schema — the
`atrium` CLI does that at publish time. Here we only ensure the economic /
provenance fields exist, augmenting Hermes output where it's missing them.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

import yaml

_FRONTMATTER = re.compile(r"^---\s*\n(.*?)\n---\s*\n?(.*)$", re.S)


class ManifestError(Exception):
    pass


@dataclass
class ParsedSkill:
    meta: dict
    body: str


def parse(text: str) -> ParsedSkill:
    m = _FRONTMATTER.match(text)
    if not m:
        raise ManifestError("No YAML frontmatter found (expected a leading `---` block).")
    meta = yaml.safe_load(m.group(1)) or {}
    if not isinstance(meta, dict):
        raise ManifestError("Frontmatter is not a YAML mapping.")
    return ParsedSkill(meta=meta, body=m.group(2))


def skill_name(meta: dict, fallback: str) -> str:
    name = meta.get("name")
    return str(name) if name else fallback


def is_economically_complete(meta: dict) -> bool:
    """True if the manifest already carries a per-call price."""
    price = meta.get("price_per_call_usdc")
    return price is not None and str(price).strip() != ""


def augment(meta: dict, default_price: str, session: str | None = None) -> dict:
    """Fill missing economic/provenance fields without clobbering existing ones."""
    out = dict(meta)
    out.setdefault("price_per_call_usdc", str(default_price))
    out.setdefault("derivation_method", "hermes-loop")
    if session and not out.get("hermes_session"):
        out["hermes_session"] = session
    return out


def serialize(meta: dict, body: str) -> str:
    frontmatter = yaml.safe_dump(meta, sort_keys=False, default_flow_style=False).strip()
    sep = "" if body.startswith("\n") else "\n"
    return f"---\n{frontmatter}\n---\n{sep}{body}"
