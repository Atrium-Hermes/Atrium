# Installing atrium-hermes

## 1. Prerequisites

- Python ≥ 3.10 (macOS or Linux)
- The **`atrium` CLI** installed and on your `PATH` (this sidecar drives it)
- A configured Atrium identity (`atrium init`) with a funded wallet + `PINATA_JWT`
  in `~/.atrium/.env` — the sidecar relies on the CLI's existing setup.

### Make the `atrium` CLI available

From the repo root:

```bash
npm install
cd cli && npm run build && npm link      # exposes `atrium` on PATH
atrium --version                          # should print 0.1.0
```

## 2. Install the sidecar

```bash
cd plugins/hermes
python -m venv .venv && . .venv/bin/activate
pip install -e .
```

This installs the `atrium-hermes` console script into the venv.

## 3. Verify

```bash
atrium-hermes doctor
```

Expected: `✓ atrium CLI on PATH`, `✓ config readable`, and your network / default
price summary. If `atrium` is not found, redo step 1 (`npm link`) or add the CLI's
`bin` dir to `PATH`.

## 4. Run

```bash
atrium-hermes config          # writes ~/.atrium-hermes/config.toml on first run; review it
atrium-hermes daemon          # start watching ~/.hermes/skills
# ... let Hermes generate a skill; you'll be prompted to publish ...
atrium-hermes status          # confirm running + see recent publishes
```

To stop a detached daemon: `kill $(cat ~/.atrium-hermes/daemon.pid)`.

## Troubleshooting

- **`atrium CLI not found on PATH`** — the sidecar can't publish. Re-run `npm link`
  in `cli/`, or activate the shell where `atrium` is available before `daemon`.
- **Publish fails with insufficient USDC / IPFS error** — these come straight from
  the CLI; fix them there (`atrium balance`, check `PINATA_JWT`) and re-run
  `atrium-hermes publish-pending`.
- **Daemon won't start: "already running"** — a stale `daemon.pid`; remove it if no
  process is actually running (`atrium-hermes status` reports liveness).
