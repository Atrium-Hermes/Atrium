"""`atrium-hermes` command-line entrypoint."""

from __future__ import annotations

import os
import signal
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import click
from rich.console import Console
from rich.table import Table

from . import config, publisher
from .config import load_config
from .watcher import add_ignored, make_observer

console = Console()


@click.group(help="Atrium auto-publish sidecar for Hermes Agent.")
@click.version_option(package_name="atrium-hermes")
def main() -> None:
    pass


# ─────────── daemon ───────────


@main.command(help="Start the watcher daemon.")
@click.option("--foreground", is_flag=True, help="Run in the foreground (don't detach).")
def daemon(foreground: bool) -> None:
    cfg = load_config()
    skills_dir = cfg.skills_dir
    if not skills_dir.exists():
        console.print(f"[yellow]Skills dir {skills_dir} does not exist — creating it.[/yellow]")
        skills_dir.mkdir(parents=True, exist_ok=True)

    if _running_pid():
        console.print(f"[red]Daemon already running (pid {_running_pid()}).[/red]")
        raise SystemExit(1)

    if not foreground:
        _daemonize()
    _write_pid()
    _run_watch(cfg)


def _run_watch(cfg) -> None:
    observer, _ = make_observer(cfg)
    observer.start()
    console.print(f"[green]atrium-hermes watching[/green] {cfg.skills_dir} "
                  f"(auto_publish={cfg.publishing.auto_publish})")

    stopping = {"flag": False}

    def _stop(*_):
        stopping["flag"] = True

    signal.signal(signal.SIGTERM, _stop)
    signal.signal(signal.SIGINT, _stop)
    try:
        while not stopping["flag"] and observer.is_alive():
            observer.join(timeout=1)
    finally:
        observer.stop()
        observer.join()
        _clear_pid()
        console.print("[dim]atrium-hermes stopped.[/dim]")


# ─────────── status ───────────


@main.command(help="Show daemon status + recent publishes.")
def status() -> None:
    pid = _running_pid()
    if pid:
        console.print(f"[green]● running[/green] (pid {pid})")
    else:
        console.print("[dim]○ not running[/dim]")

    recent = publisher.recent_published(10)
    if not recent:
        console.print("[dim]No skills published yet.[/dim]")
        return

    table = Table(title="Recent publishes", show_edge=False)
    table.add_column("when")
    table.add_column("name", style="cyan")
    table.add_column("skillId", style="green")
    for e in reversed(recent):
        when = datetime.fromtimestamp(e.get("ts", 0), tz=timezone.utc).strftime("%Y-%m-%d %H:%M")
        sid = (e.get("skill_id") or "")[:14] + "…"
        table.add_row(when, str(e.get("name", "?")), sid)
    console.print(table)


# ─────────── publish-pending ───────────


@main.command("publish-pending", help="Publish skills queued while the daemon was down.")
def publish_pending() -> None:
    cfg = load_config()
    _, processor = make_observer(cfg)
    skills = sorted(cfg.skills_dir.glob("*.md")) if cfg.skills_dir.exists() else []
    pending = [p for p in skills if not processor.is_ignored(p) and str(p) not in publisher.published_paths()]
    if not pending:
        console.print("[dim]Nothing pending.[/dim]")
        return
    console.print(f"[bold]{len(pending)}[/bold] pending skill(s).")
    for path in pending:
        processor.process(path)


# ─────────── config ───────────


@main.command("config", help="Show (or edit) the config file.")
@click.option("--edit", is_flag=True, help="Open the config in $EDITOR.")
def config_cmd(edit: bool) -> None:
    load_config()  # writes default on first run
    path = config.config_file()
    if edit:
        os.execvp(os.environ.get("EDITOR", "nano"), [os.environ.get("EDITOR", "nano"), str(path)])
    console.print(f"[dim]{path}[/dim]\n")
    console.print(path.read_text())


# ─────────── ignore ───────────


@main.command(help="Never prompt to publish this skill again.")
@click.argument("skill_path", type=click.Path())
def ignore(skill_path: str) -> None:
    resolved = str(Path(skill_path).expanduser().resolve())
    add_ignored(resolved)
    console.print(f"[yellow]Ignoring[/yellow] {resolved}")


# ─────────── doctor ───────────


@main.command(help="Diagnose the install (atrium CLI, paths, config).")
def doctor() -> None:
    cfg = load_config()
    ok = True

    def check(label: str, passed: bool, hint: str = "") -> None:
        nonlocal ok
        ok = ok and passed
        mark = "[green]✓[/green]" if passed else "[red]✗[/red]"
        console.print(f"{mark} {label}" + (f"  [dim]{hint}[/dim]" if hint and not passed else ""))

    check("`atrium` CLI on PATH", publisher.atrium_available(), "install + `npm link` the CLI; see INSTALL.md")
    check(f"skills dir exists ({cfg.skills_dir})", cfg.skills_dir.exists(), "will be created on daemon start")
    check(f"config readable ({config.config_file()})", config.config_file().exists())
    console.print(f"\nnetwork: [green]{cfg.publishing.network}[/green] · "
                  f"default price: [yellow]{cfg.publishing.default_price_usdc} USDC[/yellow] · "
                  f"auto_publish: {cfg.publishing.auto_publish}")
    raise SystemExit(0 if ok else 1)


# ─────────── pid helpers (unix; no Windows in v1) ───────────


def _write_pid() -> None:
    config.ensure_dir()
    config.pid_file().write_text(str(os.getpid()))


def _clear_pid() -> None:
    try:
        config.pid_file().unlink()
    except FileNotFoundError:
        pass


def _running_pid() -> int | None:
    path = config.pid_file()
    if not path.exists():
        return None
    try:
        pid = int(path.read_text().strip())
    except ValueError:
        return None
    try:
        os.kill(pid, 0)  # signal 0 = liveness probe
        return pid
    except OSError:
        _clear_pid()
        return None


def _daemonize() -> None:
    """Classic double-fork so the watcher outlives the launching shell."""
    config.ensure_dir()
    if os.fork() > 0:
        sys.exit(0)
    os.setsid()
    if os.fork() > 0:
        sys.exit(0)
    sys.stdout.flush()
    sys.stderr.flush()
    log = open(config.log_file(), "a")
    os.dup2(log.fileno(), sys.stdout.fileno())
    os.dup2(log.fileno(), sys.stderr.fileno())


if __name__ == "__main__":
    main()
