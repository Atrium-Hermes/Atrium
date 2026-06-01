"""Configuration + on-disk state paths for the sidecar.

Paths are resolved at call time (not import time) and honour the
ATRIUM_HERMES_HOME env var, which keeps tests off the real home dir.
"""

from __future__ import annotations

import os
from pathlib import Path

from pydantic import BaseModel, Field

try:  # py3.11+
    import tomllib
except ModuleNotFoundError:  # py3.10
    import tomli as tomllib  # type: ignore


def config_dir() -> Path:
    return Path(os.environ.get("ATRIUM_HERMES_HOME") or os.path.expanduser("~/.atrium-hermes"))


def config_file() -> Path:
    return config_dir() / "config.toml"


def published_log() -> Path:
    return config_dir() / "published.jsonl"


def ignore_file() -> Path:
    return config_dir() / "ignored.txt"


def pid_file() -> Path:
    return config_dir() / "daemon.pid"


def log_file() -> Path:
    return config_dir() / "daemon.log"


def ensure_dir() -> None:
    config_dir().mkdir(parents=True, exist_ok=True)


DEFAULT_CONFIG_TOML = """\
[watch]
hermes_skills_dir = "~/.hermes/skills"
debounce_seconds = 5

[publishing]
default_price_usdc = "0.001"
auto_publish = false
network = "base-sepolia"

[ignore]
patterns = ["*.draft.md", "test-*"]
"""


class WatchCfg(BaseModel):
    hermes_skills_dir: str = "~/.hermes/skills"
    debounce_seconds: float = 5.0


class PublishingCfg(BaseModel):
    default_price_usdc: str = "0.001"
    auto_publish: bool = False
    network: str = "base-sepolia"


class IgnoreCfg(BaseModel):
    patterns: list[str] = Field(default_factory=lambda: ["*.draft.md", "test-*"])


class Config(BaseModel):
    watch: WatchCfg = Field(default_factory=WatchCfg)
    publishing: PublishingCfg = Field(default_factory=PublishingCfg)
    ignore: IgnoreCfg = Field(default_factory=IgnoreCfg)

    @property
    def skills_dir(self) -> Path:
        return Path(os.path.expanduser(self.watch.hermes_skills_dir))


def load_config() -> Config:
    """Load config, writing the default file on first run."""
    ensure_dir()
    path = config_file()
    if not path.exists():
        path.write_text(DEFAULT_CONFIG_TOML)
    data = tomllib.loads(path.read_text())
    return Config.model_validate(data)
