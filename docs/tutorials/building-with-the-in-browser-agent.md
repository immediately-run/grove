# Building a Grove component with the in-browser coding agent

Grove's content is meant to be changed *by asking an agent*. The platform also
ships a general **in-browser coding agent** (the "Agents" activity) that reads,
searches, and **edits the running app's files** with a real tool-calling loop —
the same `<Quote>` component from
[creating-a-component.md](./creating-a-component.md), built by talking instead of
typing.

This guide is two things at once: the **steps that work today**, and an honest
log of **what's still rough** (it was produced by actually driving the agent
end-to-end against Grove with GLM 5.2 over OpenRouter and writing down where it
broke).

> **Status, 2026-06-30.** This flow now works end-to-end: the agent reads and
> writes **Grove's** working tree and Grove re-renders. That last sentence used to
> be false — the agent was mounted on *its own* repo and every Grove path read
> `not found`. That was the AA-23 gap, now fixed (site-main #208 + agent-demo #11).
>
> **Re-verified 2026-07-01** on `local.immediately.run` with GLM 5.2 over
> OpenRouter, driving a *fresh* `<Kbd>` component end-to-end: 6 real `read_file`s
> (not `not found`), then `write_file` + `edit_file`×4, and Grove's preview
> hot-reloaded to render the new component. GLM ran **clean this time** — every
> turn emitted its tool calls (`finish_reason: tool_calls`), so the "announces but
> emits none" edge (findings §2) is **intermittent, not deterministic**. The only
> human step was the one passkey tap (§1). Also fixed on the same day: the file
> explorer now labels Grove's working tree `immediately-run/grove` read-only
> (was mislabeled as the explorer's own repo, read-write — site-main #212 +
> file-explorer #20).

## How the agent is wired

- The agent is the `immediately-run/agent-demo` app, bound in the build-default
  registry to two regions: **`panel.agent`** (the conversation list, left) and
  **`stage.conversation`** (the main pane — where you type and the agent runs).
  Open it with the **"Agents"** button in the left activity rail (edit mode).
- **It authors the *stage app's* working tree, not its own (AA-23).** While Grove
  is the loaded app, the host confers Grove's working tree to the agent as a
  scoped, read-write `worktree` mount — the **editor's cross-repo grant kind**, not
  "self-access." The agent's filesystem tools (`read_file`, `write_file`,
  `edit_file`, `list_dir`, `glob`, `grep`, `stat`, `delete_file`) are chrooted to
  **that** tree, merged with the app's capability catalog (the header shows the
  merged count, e.g. "23 tools (catalog + files)" — the exact number tracks the
  catalog and drifts, so read the "catalog + files" suffix, not the digit). Switch
  which app is loaded and the prior port is torn down and a new one minted.
- **Inference goes through the platform `llm.chat` service, not a per-app key.**
  The agent calls the host-mediated `chat()` and needs only the **`llm:chat`**
  capability — *no* `net:fetch`, no bring-your-own-key powerbox. The app names no
  vendor and no model; the **host** resolves your provider/model preference and
  injects the key per request, so the app never sees the secret. (This replaced the
  old BYOK/`net:fetch` design — if you find docs mentioning an "Add OpenRouter key"
  button or `modelClient.ts`, they're historical.)

## The happy path (what works)

### 1. Load Grove with a writable mount

`immediately.run dev` (local provider) is **read-only by construction**, so the
agent can't persist edits to a locally-served tree. Load Grove **from GitHub**
instead — that gives a writable copy-on-write mount, and you persist with the
normal Contribute / PR flow:

```
https://local.immediately.run/edit/github/immediately-run/grove/main/
```

(Use `local.immediately.run` for the local host, or `immediately.run` for prod —
never `localhost`; config is keyed by hostname.)

### 2. Set the provider and model (one-time)

There is **no Settings UI yet** (see the gaps below), so the provider/model
preference is set with a dev hook. In the host's top-frame console:

```js
await window.__irLlmPref.set({ providerId: 'llm.chat.openrouter', model: 'z-ai/glm-5.2' })
// read it back: await window.__irLlmPref.get()
```

This writes `/etc/config/llm-provider.json` in the host's ZenFS. The OpenRouter
key itself is stored once, host-side, sealed with your passkey — the app never
sees it. GLM 5.2's OpenRouter slug is `z-ai/glm-5.2`.

### 3. Open the agent and ask for the component

1. Click **Agents** in the left rail. The main pane becomes the conversation; the
   header should read "… tools (catalog + files)".
2. Type a self-contained prompt and **Run**. Give it the conventions up front so
   it doesn't have to guess — point it at the same rules humans follow:

   > Create a new MDX component `<Quote>` … First read `CLAUDE.md`,
   > `src/mdxComponents.ts`, and the existing `Callout.tsx` / `WikiLink.tsx` /
   > `index.css` to match conventions. Then create `src/components/Quote.tsx`
   > (default export, **only** the component), add `.grove-quote` styles using the
   > design tokens, register it in the MDX component map, and add a demo `<Quote>`
   > to `content/home.mdx`. Reuse `<WikiLink>` for the source link.

   > **Pick a component that doesn't already exist.** `<Quote>` (and `<Callout>`,
   > `<WikiLink>`, `<KeyValue>`, …) already ship in this repo and are registered in
   > `src/mdxComponents.ts` — asking for one of those has the agent *rewrite* an
   > existing file, so you can't tell a real create from a no-op. For a clean run
   > pick a fresh name and swap it through the prompt (the 2026-07-01 re-verify used
   > `<Kbd>` — a keycap: `src/components/Kbd.tsx`, `.grove-kbd`, a `<Kbd>⌘K</Kbd>`
   > demo). Skim `src/components/` first to see what's taken.

3. **Approve the passkey prompt.** The first `chat()` of a session raises a native
   WebAuthn / Touch-ID dialog to unseal the model key. A human has to tap it once;
   it can't be automated (see the gaps). After that the loop runs unattended.

The agent reads the files with its tools, writes the new files into the CoW mount,
and the preview hot-reloads. Review the diff, then **Contribute** to open a PR.
(See [creating-a-component.md](./creating-a-component.md) for the five edits the
agent should end up making — that's your review checklist.)

## Verifying / iterating (driving it yourself)

The honest way to confirm any of this — and to catch the "works locally, breaks on
the host" failures — is to drive a real browser and watch the SDK channel.

- **Chrome DevTools MCP** (`mcp__chrome-devtools__*`): take an accessibility
  **snapshot** for element `uid`s, fill/click, then read the **console** and
  **network**. The decisive signal for *this* flow is a
  `POST https://openrouter.ai/api/v1/chat/completions` carrying
  `"model":"z-ai/glm-5.2"` with a `tools` array, and a `read_file` tool result that
  returns **real Grove file content** (not `not found`).
- **Controlled-input gotcha:** the prompt box is a React controlled input.
  Programmatically *setting* its value (e.g. Chrome MCP `fill`) does **not** arm
  **Run** — only real keystrokes (`type_text`) sync React state. Type, don't set.
- **Testing an unmerged agent-demo:** to run a local agent-demo build *as the
  workbench* (e.g. before a change is merged), dev-override the `stage.conversation`
  region with Grove still the previewed app:

  ```bash
  # in a checkout of immediately-run/agent-demo
  immediately.run dev --region stage.conversation \
    --preview "edit/github/immediately-run/grove/main/" \
    --origin https://local.immediately.run --json
  ```

  Open the printed deep link. The region shows a **"Customized binding"** badge and
  loads your source over the loopback; the binding's working-tree exposure is
  re-derived from the build default, so the AA-23 `rw` port still applies. (If the
  override doesn't take on first load, reload once — the directive is persisted to
  `sessionStorage` and applies on the next resolve.)

## What's still rough (findings)

Driving this with **GLM 5.2 over OpenRouter** surfaced real gaps. None of them
break the architecture; they're UX and model-reliability edges.

1. **The first `chat()` parks silently on the passkey unseal.** Chrome-MCP (and
   any automation) can't tap the native WebAuthn dialog, so an unattended run sits
   on "Running…" with **no request, no error, no timeout**. Keep a human on the
   keyboard for that one tap. *Wanted: a visible "waiting for unlock" state and a
   turn timeout instead of a silent hang.*
2. **GLM-via-OpenRouter sometimes announces tool calls but emits none —
   *intermittent*.** On some turns the model writes "I'll read the files…", reasons
   through it, then finishes with `stop` and **zero** `tool_calls`; and after a tool
   error it can return an empty `stop` (no text, no call) — a silent give-up. It is
   **not deterministic**: the 2026-07-01 re-verify (`<Kbd>`) ran fully clean — every
   turn returned `finish_reason: tool_calls` and all 6 reads + 5 writes fired.
   **Mitigated (agent-demo #14):** the loop now has a bounded stall backstop — a
   no-tool-call turn that is empty or announces work without a call gets **one**
   directive nudge ("emit the tool call now") before it gives up, shown live as a
   muted "↺ nudging the model to continue…" row. It's conservative (a genuine
   wrap-up is never nudged) and bounded (max one nudge per stall episode, reset by
   any tool-executing turn), so it recovers the common stalls without ever looping.
   *Still wanted for the tail: auto-retry heuristics beyond a single nudge, or a more
   reliable provider route.*
3. **No model picker in the UI.** Provider + model is a host preference set via the
   `window.__irLlmPref` dev hook (step 2); the **Settings** rail is still a stub
   ("SETTINGS — SOON") and doesn't navigate to `/settings`. *Wanted: a real
   provider+model selector on the conversation.*
4. **A dead-end shows nothing.** When the model stops with empty content, the stage
   renders only the (failed) tool chips — no "I stopped because…" line. *Wanted: a
   terminal-without-result state.*

## Recommendation

The agent's architecture is right — a scoped rw working-tree port over the *stage*
app (AA-23), real file tools, host-mediated `llm.chat` (no per-app key), and a
capability-scoped tool catalog. The happy path works end-to-end today with a human
for the one passkey tap. The rough edges are **model selection UX** and **GLM
tool-call reliability**, not the wiring.

- For a smooth run, use a provider/model you've found reliable for tool-calling.
- When the agent stalls mid-task or skips its tool calls, fall back to the manual
  steps in [creating-a-component.md](./creating-a-component.md) — which is how the
  `<Quote>` shipped in this repo was originally built.
