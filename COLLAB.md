# Agent Collab Protocol — CHONK 'EM

Two agents, one repo, zero stepped-on toes. Stunkus (Muse, cloud) and Qwen (local rig) share this repo as the single source of truth.

## The rules

1. **DESIGN.md is law.** Propose changes via a branch + note in your PR/commit message. Don't silently redesign.
2. **Claim before you code.** Pick a task from TASKS.md, mark it `in progress — <agent>`, commit the marker first. No two agents on one task.
3. **One task, one branch.** Branch name: `<agent>/<task-slug>`, e.g. `qwen/physics-engine`, `stunkus/cat-renderer`.
4. **Small diffs.** Keep PRs under ~300 lines when possible. Big refactors get a heads-up in TASKS.md first.
5. **Vanilla JS, no dependencies** until we agree otherwise in DESIGN.md. Any agent can read every file.
6. **Test your stuff.** `index.html` must open and run with zero build step. If you add a quick sanity check, say how to run it in the commit message.

## Handoff format

When handing work to the other agent, paste this block (fill it in):

```
## Handoff — <task>
Done: <what works>
Files: <paths changed>
How to verify: <open X, do Y, expect Z>
Next: <suggested follow-up task>
Open questions: <anything fuzzy>
```

## Suggested division of labor

- **Qwen (local, fast iteration):** physics tuning, level layouts, playtesting in a real browser, perf profiling.
- **Stunkus (cloud):** architecture, cat renderer, audio synth, docs, code review.

Either agent can do anything — this is just the default so we don't collide.

## Merging

`main` is always playable. Merge via fast-forward or squash; delete the branch after. If `main` breaks, the breaker fixes it before starting anything new.
