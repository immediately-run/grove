# Grove — the agent authoring loop

**Status:** product definition (proposal) · **Updated:** 2026-06-26
**Author:** drafted for peter@peterneumark.com
**Companion to:** [`grove.md`](./grove.md) and
[`grove-interactive-content.md`](./grove-interactive-content.md) — read those first.
**Platform source of truth:** the immediately-run **docs** repo,
`specs/AGENT_AUTHORING_ARCHITECTURE.md` (the cross-app architecture; this doc is the
Grove-specific application of it).

---

## Why this document exists

`grove-interactive-content.md` settles *where authority lives*: Grove holds no standing
high-stakes authority, and the agent — because it needs `llm:chat` — runs as a separate,
host-brokered **mini-app**, not ambient in Grove's tree. This document settles the part that
left open: **how that agent actually authors the wiki and closes the loop on what it wrote** —
the principal it runs under, the interface it uses to change content, what it observes, and how
its edits reconcile with a human editing at the same time.

The one-line thesis: **the agent proposes; Grove applies.** The agent never holds write access
to the wiki. It emits semantic patches; Grove — which owns the wiki schema and contract —
validates them, merges them against concurrent edits, and writes.

---

## The self-authoring agent principal

The agent mini-app runs under a tight principal whose ceiling is exactly:

- `chat()` — the LLM slot (the host injects the user's key; Grove/the agent never sees it).
- `diagnostics:read` *(subject: this Grove)* — MDX compile/transpile errors + captured console.
- `render:read` *(subject)* — an on-demand rendered-DOM / a11y snapshot, to verify a result.
- `ipc → Grove` — propose patches; receive "current entry / selection" context deltas.
- **and nothing else** — no `net:fetch`, no secrets, no foreign mounts, no cross-repo reach,
  and **no document write**.

It has its **own appKey** (distinct from Grove), which keeps its grants isolated from Grove's
frame (and sidesteps the `SPEC_AUDIT_REPORT.md` SH-1 grant-bleed defect). Because
`diagnostics:read` and a write port are above the **stage** ceiling Grove runs under, the agent
*must* be a separate, higher-principal slot — the platform forces the externalization, and that
is what makes the agent survive Grove re-rendering itself.

The signature always-present **"Ask Grove…" line stays in Grove's own DOM** (brief 06), but it
holds no loop and no grants: it only **forwards the prompt over IPC** to the agent mini-app.
The conversation, the loop, and the authority live in the mini-app; the line is a styled
forwarder, so a re-render of the wiki never loses the conversation.

---

## The interface: semantic patches, not file writes

> *(Superseded 2026-06-27 by `AGENT_AUTHORING_ARCHITECTURE.md` §3/§7. The semantic-patch interface
> is **dropped**: the workbench agent writes Grove's filesystem directly (an ordinary
> editing-session write), and Grove does not validate/apply patches. The motivation below — the
> agent needs no write authority because Grove is the gatekeeper — is replaced by: the agent has
> the workbench's existing tree-write authority, and the security backstop is the **gate** (commit
> for git; for a non-git space, a local pre-publish diff review + LWW publish with
> **detect-after-clobber** via `RemoteOverwriteEmitter` — **not** a preventing CAS, FirestoreFS has
> no etag), not a Grove validator. Grove's contract (taxonomy, link integrity, frontmatter schema)
> becomes **feedback** via `diagnostics:read` + a Layer-3 drift flag, not a pre-write reject.
> Conflict is file-level (`buffer.ts` block-on-dirty + a **content-comparison token** — git blob
> SHA / Firestore `!sameData`), not a Grove-run conflict chain.)*

>>>>>>> 7ad89b3 (docs(agent-authoring): fix stale CAS terminology in reconciliation notes (D2))
The agent speaks Grove's schema over the IPC edge, in two verbs:

- `patch(target, fieldOps)` for a **wiki entry** (an `.mdx` file: typed frontmatter + MDX body).
  Examples: *add tag `draft` to entry E*; *set the body of E to …*; *create entry `{ slug, title,
  tags, body }`*; *rewrite the `[[link]]` in E from X to Y*.
- `putAsset(path, bytes)` for an **opaque** unit (an image) — whole-file replace.

Grove receives a patch and, before writing, runs it through its own gate: validate against the
contract (Layer 0 conventions, the `GROVE.md` taxonomy, frontmatter schema), check link
integrity, then apply through the conflict chain (below). This is the principled "proxy through
the app" — Grove adds real policy (schema + contract + conflict handling), so the hop earns its
place, and the agent needs no write authority at all.

**What Grove writes through.** In the common case Grove's content lives in a **separate**
filesystem (a space / a content repo), and Grove writes it via an ordinary **rw mount grant** —
collaborator-gated, read-only for untrusted viewers, revocable; *not* a standing app
capability. Only in the **fused single-repo** Grove (content stored in Grove's own app repo) is
the write the standing `exposesWorkingTree:'rw'` region property — opt-in, and the configuration
where GitHub's branch/PR/merge becomes the durable conflict layer (a real reason a
heavily-customized Grove chooses it).

---

## Observe + context: closing the loop

**Context — re-derived, never read from Grove's memory.** The agent builds context the same way
a fresh agent session does: it reads the **manifest** (`.grove/manifest.json`), the **authored
contract** (`GROVE.md`), and the entries themselves; and it receives **live deltas** — the
current entry, the text selection — over the IPC edge. The context contract *is* the agent
contract Grove already defines (Layers 0–2).

**Observe — what it sees after a write.**

1. **Diagnostics** (`diagnostics:read`): if a patch produces invalid MDX, the compile error is
   delivered to the agent so it can self-correct. Covers compile failures and runtime `console`
   throws.
2. **Render snapshot** (`render:read`, on demand): "did the entry render the way I intended,"
   for the visual/semantic check diagnostics can't give.

**The loop:** read context → `chat()` → emit `patch` → Grove validates + merges + writes → host
re-reads/recompiles (last-good Grove keeps rendering if a candidate fails) → diagnostics (± a
render snapshot) come back → broken means the error is in the next prompt; good means Grove
re-renders and re-emits context. **Landing is a separate, gated `contribute` step** — the user
reviews the diff before agent-authored bytes become durable.

---

## Conflicts: the agent is just another writer

Scope is **light async collaboration** (a few writers, mostly different entries, occasional
collision) — not real-time multi-cursor. Agent patches, a human editing in the platform editor,
and a remote collaborator all become writes to the content mount, surfaced to everyone by
`onFsChange`.

- **File-per-entry partitions most conflict away.** Two writers on *different* entries never
  conflict. The domain shrinks to the same entry, concurrently.
- **Within an entry, merge by field.** Frontmatter is a typed map (per-key merge — disjoint keys
  auto-merge); the body is text (3-way). A human retitling while the agent retags the same entry
  is disjoint and merges cleanly; only a true same-field overlap blocks.
- **Chained resolvers, most-specific to most-general:** Grove's contract-aware resolver
  (taxonomy, link integrity) → MDX/Markdown structural merge → generic text → terminal. The
  terminal is **GitHub branch/PR** when content is a git repo, or last-write / a *user-initiated*
  agent-diff for a non-git space.
- **Backstops:** semantic staleness (a patch correct as bytes but wrong because the entry's
  meaning changed under it) is caught by **human review at `contribute`**; **undo is
  per-author-scoped** (your edits and your agent's, not a collaborator's).

---

## What changes in Grove (from today)

`GroveAgent.tsx` today runs `chat()` **text-only, ambient in Grove's tree**, and hands writes off
to the platform editor via `requestEdit`. The target architecture:

> *(Corrected 2026-06-27 per `AGENT_AUTHORING_ARCHITECTURE.md` §3/§7 — steps 1–3 below are
> superseded. The agent is the platform **workbench agent** (editing-session principal), not a
> Grove self-authoring mini-app; it **writes Grove's filesystem directly**, so there is no patch
> interface and no Grove-run conflict chain. Grove becomes a read-only renderer; its contract
> surfaces as `diagnostics:read` + a Layer-3 drift flag (feedback), and conflict is file-level
> (`buffer.ts` block-on-dirty + a **content-comparison token**, detect-after-clobber on non-git via
> `RemoteOverwriteEmitter` — not a preventing CAS) reconciled at the gate, not inside Grove.)*

1. ~~**Externalize the agent** into a mini-app under the self-authoring principal~~ → **use the
   platform workbench agent** (own appKey, editing-session principal). Keep the in-DOM "Ask
   Grove…" line as a grant-less forwarder of the prompt to the workbench agent.
2. ~~**Replace the text-only loop with the patch interface**~~ → the workbench agent **writes
   Grove's filesystem directly**; Grove does not validate/apply patches.
3. ~~**Apply through a conflict chain** inside Grove~~ → conflict is **file-level at the working
   tree / the gate** (not a Grove-run resolver chain in V1).
4. **Wire observation** — `diagnostics:read` (+ optional `render:read`), context re-derived from
   the manifest/`GROVE.md`/entries plus IPC nav deltas.
5. **Consider the FS-1/FS-2 split** — content in a separate mount by default (no standing write
   capability for Grove), with the fused single-repo as the opt-in, GitHub-conflict-resolved
   configuration for a heavily-customized Grove.

None of this requires Grove to run with elevated privilege, and none of it is a privileged
agent daemon: the trusted core stays the host, the agent stays confined, and Grove's
customization stays in unprivileged code.

---

## Open questions (Grove-specific; platform-level ones live in the docs-repo note)

1. **Patch vocabulary** — the concrete `fieldOps` for entries (tags, frontmatter keys, body
   ranges, link rewrites) and how Grove registers its resolver + schema with the host.
2. **Fused-case write scoping** — when content is in Grove's own repo, whether patch application
   is chroot'd to the content subtree so document patches cannot reach engine source.
3. **Contract validation timing** — validate a patch *before* writing (reject) vs. write then
   flag drift (the Layer-3 validator), and how rejections surface back to the agent.
4. **Always-present line ↔ mini-app placement** — keeping the brief-06 resting/expanded feel when
   the loop's surface is a host-composited region.
