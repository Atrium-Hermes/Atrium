"""Publish a skill by shelling out to the `atrium` CLI.

Single source of truth for signing + chain logic stays in the TS CLI; this
module only invokes it and parses the result (see cli/src/commands/publish.ts
for the output format).
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path

from . import config

_ANSI = re.compile(r"\x1b\[[0-9;]*m")
_SKILL_ID = re.compile(r"Skill ID:\s*(0x[0-9a-fA-F]{64})")
_CID = re.compile(r"IPFS CID:\s*(\S+)")
_TX = re.compile(r"Tx:\s*(0x[0-9a-fA-F]+)")


@dataclass
class PublishResult:
    ok: bool
    skill_id: str | None = None
    tx: str | None = None
    cid: str | None = None
    error: str | None = None
    raw: str = ""


def atrium_available() -> bool:
    return shutil.which("atrium") is not None


def publish(skill_path: Path, network: str, timeout: int = 300) -> PublishResult:
    if not atrium_available():
        return PublishResult(ok=False, error="`atrium` CLI not found on PATH. See INSTALL.md.")
    try:
        proc = subprocess.run(
            ["atrium", "publish", str(skill_path), "--network", network],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        return PublishResult(ok=False, error=f"`atrium publish` timed out after {timeout}s")

    out = _ANSI.sub("", f"{proc.stdout or ''}\n{proc.stderr or ''}")
    if proc.returncode != 0:
        return PublishResult(ok=False, error=_last_nonempty(out), raw=out)

    sid = _SKILL_ID.search(out)
    if not sid:
        return PublishResult(ok=False, error="Could not parse skillId from atrium output.", raw=out)
    tx = _TX.search(out)
    cid = _CID.search(out)
    return PublishResult(
        ok=True,
        skill_id=sid.group(1),
        tx=tx.group(1) if tx else None,
        cid=cid.group(1) if cid else None,
        raw=out,
    )


def _last_nonempty(text: str) -> str:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    return lines[-1] if lines else "`atrium publish` failed with no output."


def record_published(entry: dict) -> None:
    config.ensure_dir()
    entry = {**entry, "ts": entry.get("ts", int(time.time()))}
    with config.published_log().open("a") as f:
        f.write(json.dumps(entry) + "\n")


def published_paths() -> set[str]:
    log = config.published_log()
    if not log.exists():
        return set()
    paths: set[str] = set()
    for line in log.read_text().splitlines():
        if not line.strip():
            continue
        try:
            p = json.loads(line).get("path")
            if p:
                paths.add(p)
        except json.JSONDecodeError:
            continue
    return paths


def recent_published(limit: int = 10) -> list[dict]:
    log = config.published_log()
    if not log.exists():
        return []
    out: list[dict] = []
    for line in log.read_text().splitlines():
        if line.strip():
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return out[-limit:]
