"""Filesystem watcher + per-skill processing pipeline."""

from __future__ import annotations

import fnmatch
import threading
import time
from pathlib import Path

from rich.console import Console
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

from . import config, manifest, prompt, publisher
from .config import Config

console = Console()


def load_ignored() -> set[str]:
    path = config.ignore_file()
    if not path.exists():
        return set()
    return {ln.strip() for ln in path.read_text().splitlines() if ln.strip()}


def add_ignored(skill_path: str) -> None:
    config.ensure_dir()
    if skill_path in load_ignored():
        return
    with config.ignore_file().open("a") as f:
        f.write(skill_path + "\n")


class SkillProcessor:
    """Debounces filesystem events and runs the augment → confirm → publish flow."""

    def __init__(self, cfg: Config):
        self.cfg = cfg
        self._timers: dict[str, threading.Timer] = {}
        self._lock = threading.Lock()

    # ── ignore rules ──
    def matches_ignore_pattern(self, path: Path) -> bool:
        return any(fnmatch.fnmatch(path.name, pat) for pat in self.cfg.ignore.patterns)

    def is_ignored(self, path: Path) -> bool:
        return str(path) in load_ignored() or self.matches_ignore_pattern(path)

    # ── debounce ──
    def schedule(self, path: Path) -> None:
        """(Re)start the debounce timer for a path; Hermes may still be writing it."""
        with self._lock:
            existing = self._timers.get(str(path))
            if existing:
                existing.cancel()
            timer = threading.Timer(self.cfg.watch.debounce_seconds, self.process, args=[path])
            timer.daemon = True
            self._timers[str(path)] = timer
            timer.start()

    def process(self, path: Path) -> None:
        """Crash-safe wrapper around the pipeline."""
        try:
            self.process_skill(path)
        except manifest.ManifestError as e:
            console.print(f"[yellow]Skipping {path.name}: {e}[/yellow]")
        except Exception as e:  # noqa: BLE001 — daemon must not die on one bad skill
            console.print(f"[red]Error processing {path.name}: {e}[/red]")

    # ── pipeline ──
    def process_skill(self, path: Path) -> None:
        if not path.exists() or self.is_ignored(path):
            return
        if str(path) in publisher.published_paths():
            return

        # Re-read at process time (TOCTOU: Hermes may have rewritten it since detection).
        parsed = manifest.parse(path.read_text())
        name = manifest.skill_name(parsed.meta, path.stem)

        if not manifest.is_economically_complete(parsed.meta):
            augmented = manifest.augment(parsed.meta, self.cfg.publishing.default_price_usdc)
            path.write_text(manifest.serialize(augmented, parsed.body))
            parsed = manifest.parse(path.read_text())
            console.print(f"[dim]Augmented {name} with default price/provenance fields.[/dim]")

        price = str(parsed.meta.get("price_per_call_usdc", self.cfg.publishing.default_price_usdc))

        choice = "y" if self.cfg.publishing.auto_publish else prompt.confirm_publish(
            name, price, self.cfg.publishing.network
        )

        if choice == "s":
            add_ignored(str(path))
            console.print(f"[yellow]Won't ask about {name} again.[/yellow]")
            return
        if choice == "e":
            prompt.open_editor(path)
            parsed = manifest.parse(path.read_text())  # re-read after edit
            price = str(parsed.meta.get("price_per_call_usdc", price))
            choice = prompt.confirm_publish(name, price, self.cfg.publishing.network)
        if choice != "y":
            console.print(f"[dim]Not publishing {name}.[/dim]")
            return

        self._publish(path, name, price)

    def _publish(self, path: Path, name: str, price: str) -> None:
        console.print(f"[dim]Publishing {name} via atrium CLI…[/dim]")
        res = publisher.publish(path, self.cfg.publishing.network)
        if res.ok:
            publisher.record_published(
                {
                    "path": str(path),
                    "name": name,
                    "skill_id": res.skill_id,
                    "tx": res.tx,
                    "cid": res.cid,
                    "price": price,
                    "network": self.cfg.publishing.network,
                }
            )
            console.print(f"[green]✓ Published {name}[/green]  [cyan]{res.skill_id}[/cyan]")
        else:
            console.print(f"[red]✗ Failed to publish {name}:[/red] {res.error}")


class _Handler(FileSystemEventHandler):
    def __init__(self, processor: SkillProcessor):
        self.processor = processor

    def _maybe(self, src_path: str, is_dir: bool) -> None:
        if not is_dir and src_path.endswith(".md"):
            self.processor.schedule(Path(src_path))

    def on_created(self, event) -> None:
        self._maybe(str(event.src_path), event.is_directory)

    def on_modified(self, event) -> None:
        self._maybe(str(event.src_path), event.is_directory)


def make_observer(cfg: Config) -> tuple[Observer, SkillProcessor]:
    processor = SkillProcessor(cfg)
    observer = Observer()
    observer.schedule(_Handler(processor), str(cfg.skills_dir), recursive=False)
    return observer, processor
