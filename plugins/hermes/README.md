# atrium-hermes

A thin **sidecar** that watches the skills Hermes Agent generates in
`~/.hermes/skills/` and offers to publish each new one to Atrium — by shelling
out to the `atrium` CLI. It does **not** reimplement signing or chain logic; the
TypeScript CLI stays the single source of truth.

```
Hermes writes skill.md  ──▶  atrium-hermes (watchdog)  ──▶  prompt [y/N/edit/skip]
                                                              └──▶ atrium publish …  ──▶  on-chain
```

## Behaviour

1. Daemon watches `~/.hermes/skills/*.md` (path configurable).
2. On a new/changed file it waits `debounce_seconds` (Hermes may still be writing).
3. Re-reads the file (TOCTOU-safe), parses frontmatter.
4. If economic fields are missing (`price_per_call_usdc`), it **augments** the file:
   adds the default price, `derivation_method: hermes-loop`.
5. Prompts: *"Hermes generated `<name>`. Publish for `$price`/call? [y/N/edit/skip-forever]"*
   (skipped when `auto_publish = true`).
6. On **y** → `atrium publish <path> --network <net>`, parses the skillId/tx from output,
   appends to `~/.atrium-hermes/published.jsonl`.
7. **skip-forever** records the path so it's never prompted again.
8. Errors (no USDC, IPFS failure, revert) are surfaced and the daemon keeps running.

## Commands

```bash
atrium-hermes daemon                 # start watcher (detaches)
atrium-hermes daemon --foreground    # run attached
atrium-hermes status                 # running? + recent publishes
atrium-hermes publish-pending        # publish skills queued while daemon was down
atrium-hermes config [--edit]        # show / edit config
atrium-hermes ignore <skill-path>    # never publish this skill
atrium-hermes doctor                 # check atrium CLI + paths + config
```

## Config — `~/.atrium-hermes/config.toml`

```toml
[watch]
hermes_skills_dir = "~/.hermes/skills"
debounce_seconds = 5

[publishing]
default_price_usdc = "0.001"
auto_publish = false          # true = publish without prompting (cost/privacy risk)
network = "base-sepolia"

[ignore]
patterns = ["*.draft.md", "test-*"]
```

State lives under `~/.atrium-hermes/`: `published.jsonl` (audit log), `ignored.txt`
(skip list), `daemon.pid`, `daemon.log`. Override the directory with
`ATRIUM_HERMES_HOME` (used by the test suite).

## Notes / non-goals

- Sidecar process, **not** a native Hermes plugin (Hermes has no stable plugin SDK at v0.13).
- Never auto-publishes without confirmation unless you opt in via `auto_publish`.
- Unix only in v1 (macOS + Linux). The daemon uses a double-fork; TTY prompts on
  Windows are out of scope.
- Requires the `atrium` CLI on `PATH` — run `atrium-hermes doctor` to verify. See INSTALL.md.

## Develop / test

```bash
python -m venv .venv && . .venv/bin/activate
pip install -e ".[dev]"
pytest
```
