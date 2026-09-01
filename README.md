# Grove — the wiki viewer for [immediately.run](https://immediately.run)

Grove renders an MDX corpus as a wiki: plain interlinked entries with frontmatter,
a sidebar, search, backlinks, tags, timelines — transpiled in the browser, no
server, no build step at runtime. It ships three ways:

1. **As a fork** — copy this repo, replace `content/` with your entries, push,
   open it on immediately.run. Your corpus, your code, one repo.
2. **As the dispatched viewer** — a corpus mounted into a running Grove via the
   `open-wiki` task; the wiki is somebody else's directory and Grove reads it
   through the mount (the engine never assumes it owns the corpus).
3. **As a pinned library** — `@immediately-run/grove` as an ordinary npm
   dependency: compose `src/lib.ts`'s helpers and the component vocabulary into
   your own viewer.

The composition surface — every component, its tier and overridability, the
frontmatter keys the engine reads — is declared in
[`viewer.manifest.json`](./viewer.manifest.json) and summarized in [`llms.txt`](./llms.txt).
The themes and layouts are compared live by the `Themes` and `Layouts` entries of
the sample corpus; the theming contract (token-only themes, declared faces,
checked contrast) is stated in [`THEMING.md`](./THEMING.md). What the engine owns
versus what content may reach is [`docs/ENGINE_BOUNDARY.md`](./docs/ENGINE_BOUNDARY.md).

## Running locally

```bash
npm install
npm run dev        # vite dev server — the sample handbook
npm run verify     # lint + build + tests + the manifest/contrast/token gates
```

On immediately.run, open
`https://immediately.run/present/github/<owner>/grove/main/files/content/home.mdx`
(fork) — or dispatch it at any wiki directory with the platform's file picker.
A GitHub Action (`.github/workflows/cache.yml`) publishes a pre-cached zip to
this repo's own Pages on every push to `main`, so anonymous loads are fast.

## Authoring entries

Entries are `.mdx` files under `content/` with YAML frontmatter (`title`, `tags`,
`date`, `nav`, `order`, plus the engine keys in the manifest: `site`, `theme`,
`layout`, `view`, `frame`, `render`, `cover`, …). Interlink with wiki links;
declare a picture per entry with `cover:`; group a folder with a
`content/<dir>/_layout.mdx` starter. The built-in agent answers questions about
the corpus over the host's chat slot — ask it where things are before editing.

## License

Apache-2.0. Bundled fonts in `assets/fonts/` carry their own notices
(OFL / USWDS) alongside.
