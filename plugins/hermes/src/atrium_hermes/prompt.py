"""TTY interaction (rich)."""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

from rich.console import Console
from rich.prompt import Prompt

console = Console()

# choice -> meaning: y=publish, n=skip once, e=edit then re-ask, s=skip forever
CHOICES = ["y", "n", "e", "s"]


def confirm_publish(name: str, price: str, network: str) -> str:
    console.print(f"\n[bold]Hermes generated[/bold] [cyan]{name}[/cyan]")
    console.print(
        f"Publish to Atrium for [yellow]{price} USDC[/yellow]/call on [green]{network}[/green]?"
    )
    return Prompt.ask(
        "  [y]es / [N]o / [e]dit / [s]kip-forever",
        choices=CHOICES,
        default="n",
        show_choices=False,
    )


def open_editor(path: Path) -> None:
    editor = os.environ.get("EDITOR", "nano")
    subprocess.run([editor, str(path)])
