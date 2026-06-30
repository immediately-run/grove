# Grove tutorials

Practical, repeatable guides for working on this wiki — written for **humans and
coding agents alike**. Each one is concrete: exact files, exact conventions, a
worked example you can copy.

- **[creating-a-component.md](./creating-a-component.md)** — add a new import-free
  MDX component to Grove (the `<Quote>` worked example): the files to touch, the
  conventions that keep it from breaking on immediately.run, how to link to wiki
  entries, and how to verify. Start here to add UI vocabulary authors can drop
  into any `.mdx` entry.
- **[add-a-component-with-the-agent.md](./add-a-component-with-the-agent.md)** — a
  **step-by-step** walkthrough that builds a real component (`<KeyValue>`) by *asking
  the in-browser coding agent*, with screenshots from an actual end-to-end run —
  including, honestly, where it stalled and how that was fixed. Read this for the
  concrete "ask, don't type" loop.
- **[building-with-the-in-browser-agent.md](./building-with-the-in-browser-agent.md)**
  — the reference for *how* that agent is wired (regions, the host-mediated
  `llm.chat` service, no per-app key) and its rough edges in general. Read this for
  the mechanics behind the walkthrough above.

> The platform-wide tutorials (browser debugging, local dev, changing a UI
> component, the MCP bridge) live in the **docs repo** under `docs/tutorials/`.
> These Grove-scoped guides assume that baseline and focus on Grove specifics.

<!-- freshness-escape live test 491525d -->
