# The thin shell — Grove composed as a library (M3)

The third of `PLATFORM_LAYERING_SPEC §1.1`'s composition modes, as a runnable example.

- **M1 dispatch** — a content repo's `immediately.run.json` marker resolves to Grove through
  the binding registry. No shell; the host mounts the corpus on stock Grove.
- **M2 fork** — engine and corpus in one repo (the docs wiki). Total ownership, at the cost
  of re-merging the engine.
- **M3 library — this** — an ordinary `App.tsx` imports the engine pinned and arranges it.
  Ownership of composition without forking engine source.

## What to look at

`src/App.tsx` is the whole shell. It imports `GroveApp`, overrides one component through
`composeComponents`, and renders. The two commented-out lines are the failure cases: an
override of a locked component (`Outlet`) and of an engine internal (`SafeEntryBody`) both
throw at module load, naming what went wrong and what the available surface is.

## The dependency

```json
"@immediately-run/grove": "github:immediately-run/grove#<commit-sha>"
```

Pin a commit sha rather than `#main` for anything real — `LIBRARY_MOUNTS_SPEC §7` makes a
commit-pinned ref immutable and cache-first, which is both reproducible and the fast path.
A branch ref works and picks up new commits on reload, which is the right trade only while
you are iterating on the engine and the shell together.

The engine's bytes arrive from its own GitHub Pages cache zip, and since the library-mount
artifact work its **pre-transpiled artifacts arrive with them** — the shell consumes the
engine's compiled output instead of re-transpiling ~5k lines of TSX on every cold boot.

## Mode invariance

The same corpus under `content/` renders identically here and under a fork or a dispatch.
That is `§1.1`'s mode-invariance rule, and it is a rule about the CORPUS: anything true of a
corpus in only one mode is a contract bug, not a feature.
