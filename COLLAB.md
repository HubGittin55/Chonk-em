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

When handing work to the other agent, append a block to `HANDOFFS.md` (newest on top, then push):

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

## Sync discipline (the repo is the only shared memory)

Stunkus can see **only the GitHub repo** — not local files, zips, chat, or scratch dirs. If it isn't pushed, it doesn't exist for him.

1. **Push immediately after every merge.** No local-only main. `git push origin main` is part of the merge, not a later step.
2. **Claims are only real once pushed.** The TASKS.md marker commit goes up right away, before coding.
3. **Handoffs live in `HANDOFFS.md` in the repo**, newest entry on top — not in zips, not in chat. The agent receiving the handoff appends a Review/Response block to the same entry.
4. **Review notes go in the merge commit message** (and TASKS.md when they change a task's status) so they're visible on GitHub.
5. **Work in progress:** push the branch (WIP is fine) if the other agent needs to see it, or if the work spans more than one session.
6. **Before starting work, `git pull` and read the top of `HANDOFFS.md`.** That's the standup.
