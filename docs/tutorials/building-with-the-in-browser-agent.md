# Building a Grove component with the in-browser coding agent

Grove's content is meant to be changed *by asking an agent*. The platform also
ships a general **in-browser coding agent** (the "Agents" activity) that can read,
search, and **edit the running app's files** with a real tool-calling loop — the
same `<Quote>` component from
[creating-a-component.md](./creating-a-component.md), built by talking instead of
typing.

This guide is two things at once: the **steps that work today**, and an honest
log of **what's still missing** (this doc was produced by actually driving the
agent end-to-end with GLM 5.2 over OpenRouter and writing down where it broke).

## How the agent is wired

- The agent is the `immediately-run/agent-demo` app, bound in the build-default
  registry to two regions: **`panel.agent`** (the conversation list, left) and
  **`stage.conversation`** (the main pane — where you type and the agent runs).
  Open it with the **"Agents"** button in the left activity rail (edit mode).
- In `stage.conversation` the agent is granted a **read-write, copy-on-write
  mount of the app's working tree**, plus filesystem tools (`read_file`,
  `write_file`, `list_dir`, `glob`, `grep`, `stat`, `delete_file`) merged with the
  app's capability catalog ("24 tools (catalog + files)" in the header).
- It is **bring-your-own-key**: it calls the model provider directly via
  `net:fetch`, with the host **injecting** your stored key per request — the app
  never sees the secret value. The default provider is **OpenRouter**.

## The happy path (what works)

### 1. Load Grove with a writable mount

`immediately.run dev` (local provider) is **read-only by construction**, so the
agent can't persist edits to a locally-served tree. Load Grove **from GitHub**
instead — that gives the agent a writable copy-on-write mount, and you persist
with the normal Contribute / PR flow:

```
https://local.immediately.run/edit/github/immediately-run/grove/main/
```

(Use `local.immediately.run` for the local host, or `immediately.run` for prod —
never `localhost`; config is keyed by hostname.)

### 2. Open the agent and connect your key

1. Click **Agents** in the left rail. The main pane becomes the conversation.
2. Click **"Add OpenRouter key"**. The host draws a **"Share a secret with this
   app"** powerbox; pick your stored **OpenRouter** key. This mints the per-app
   use-grant — the app receives only a handle, never the value.
   - No OpenRouter key stored yet? The powerbox offers to add one: origin
     `https://openrouter.ai`, type **bearer-token**. You enter the key in the
     *host* dialog (sealed with your passkey) — never in the app.

### 3. Ask for the component

Type a self-contained prompt and **Run**. Give it the conventions up front so it
doesn't have to guess — point it at the same rules humans follow:

> Create a new MDX component `<Quote>` … First read `CLAUDE.md`,
> `src/mdxComponents.ts`, and the existing `Callout.tsx` / `WikiLink.tsx` /
> `index.css` to match conventions. Then create `src/components/Quote.tsx`
> (default export, **only** the component), add `.grove-quote` styles to
> `GroveApp.css` using the design tokens, register it in `GROVE_MDX`, and add a
> demo `<Quote>` to `content/home.mdx`. Reuse `<WikiLink>` for the source link.

The agent reads the files with its tools, writes the new files into the CoW
mount, and the preview hot-reloads. Review the diff, then **Contribute** to open a
PR. (See [creating-a-component.md](./creating-a-component.md) for the five edits
the agent should end up making — that's your review checklist.)

## What's missing today (findings)

Driving this flow with **GLM 5.2 over OpenRouter** surfaced real gaps. Until they
land, prefer the manual flow in
[creating-a-component.md](./creating-a-component.md), or use the stock agent on
its default model.

1. **You can't pick the model in the UI.** The model is hard-coded in
   `agent-demo/src/lib/modelClient.ts` (`PROVIDERS.openrouter.model`, default
   `openai/gpt-4o-mini`); `createModelClient` takes only a provider id. To run a
   specific model (e.g. `z-ai/glm-5.2`) you must **edit that source and run the
   modified agent-demo as a region override**:

   ```bash
   # in a checkout of immediately-run/agent-demo, set the model in
   # src/lib/modelClient.ts, then:
   immediately.run dev . --region stage.conversation \
     --preview immediately-run/grove@main \
     --origin https://local.immediately.run --json
   ```

   Open the printed link but switch `/present/` → `/edit/` (the Agents rail only
   exists in edit mode; `--preview` currently resolves to a `/present/` route).
   *Wanted: a model selector on the conversation (provider + model slug).*

2. **The region-override path hangs on the first model call.** Running the
   modified (GLM 5.2) agent as a `stage.conversation` override — which gets a
   **fresh dev appKey** — the agent connects the key and accepts the prompt, then
   sits on **"Running…" forever**: no request to `openrouter.ai` ever leaves the
   browser, and no consent prompt, error, or timeout is shown (a backend
   `security-events` entry is logged, consistent with the first `net:fetch` being
   gated for the fresh appKey). Net effect: **selecting a model and actually
   running it via the agent is currently blocked end-to-end.** *Wanted: surface
   the gate outcome (consent or `forbidden`) instead of hanging; a turn timeout
   with a visible error.*

3. **The Settings rail is a stub** ("SETTINGS — SOON") and does not navigate to
   `/settings`. Secrets are managed only through an app's own powerbox (the
   agent's "Add … key"), so there is no standalone place to add/inspect an
   OpenRouter key before opening the agent.

4. **Small UX papercuts.** The connect button reads "Add OpenRouter key" even
   when a key is already stored (it matches by bound-origin substring); the
   connected state is in-memory React state, so a reload shows the button again
   and re-prompts the powerbox.

## Recommendation

The agent's *architecture* is right — RW working-tree mount, real file tools,
host-injected BYOK, capability-scoped tool catalog. The blockers are **model
selection** and the **dev-override `net:fetch` hang**. Until both land:

- To use the **default** model, the stock agent (no override) is the smooth path.
- To use a **specific** model (GLM 5.2, etc.), or when the agent stalls, fall
  back to the manual steps in
  [creating-a-component.md](./creating-a-component.md) — which is how the
  `<Quote>` shipped in this repo was ultimately built.
