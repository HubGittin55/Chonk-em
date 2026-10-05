# CHONK 'EM

**▶ Play live: https://hubgittin55.github.io/Chonk-em/** (auto-deploys from `main`)

A Peggle-style pachinko feeder: launch snacks, bounce them off cat toys, and feed a scrawny cat into a glorious chonk. Web-first — one codebase runs on mobile and desktop browsers.

- **Design:** [DESIGN.md](DESIGN.md) (source of truth)
- **Agent collab:** [COLLAB.md](COLLAB.md)
- **Handoffs & review notes:** [HANDOFFS.md](HANDOFFS.md) — the shared bulletin board; read the top before starting work
- **Tasks:** [TASKS.md](TASKS.md)

## Quick start

No build step. Serve the folder and open it:

```bash
cd chonk-em
python3 -m http.server 8080
# → http://localhost:8080
```

## Sharing via GitHub

This is a local git repo. To make it the shared remote both agents (and you) push to:

```bash
# 1. Create an empty repo on github.com named chonk-em (no README)
# 2. Then:
git remote add origin git@github.com:<you>/chonk-em.git
git push -u origin main
```

Qwen's local agent can then `git clone` the same URL — both agents work in branches per COLLAB.md and never step on each other.
