# Grove tutorials

Practical, repeatable guides for working on this wiki — written for **humans and
coding agents alike**. Each one is concrete: exact files, exact conventions, a
worked example you can copy.

- **[creating-a-component.md](./creating-a-component.md)** — add a new import-free
  MDX component to Grove (the `<Quote>` worked example): the files to touch, the
  conventions that keep it from breaking on immediately.run, how to link to wiki
  entries, and how to verify. Start here to add UI vocabulary authors can drop
  into any `.mdx` entry.
- **[building-with-the-in-browser-agent.md](./building-with-the-in-browser-agent.md)**
  — do the same work by *driving the platform's in-browser coding agent* (the
  "Agents" main-pane): it authors Grove's working tree through the host-mediated
  `llm.chat` service (no per-app key). Covers the setup that works today, how to
  verify it, and the rough edges to expect.

> The platform-wide tutorials (browser debugging, local dev, changing a UI
> component, the MCP bridge) live in the **docs repo** under `docs/tutorials/`.
> These Grove-scoped guides assume that baseline and focus on Grove specifics.
