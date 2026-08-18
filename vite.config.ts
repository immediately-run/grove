import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import mdx from '@mdx-js/rollup'
import { devFs } from '@immediately-run/dev-fs'

// MDX must run before @vitejs/plugin-react so the JSX it emits is handled by
// React's transform (Fast Refresh included). immediately.run processes .mdx
// natively; this wiring keeps the local `vite dev`/`build` in sync.
//
// devFs() (@immediately-run/dev-fs) makes `import ... from 'fs'` work during
// local `vite dev`, bridging the same async ZenFS surface immediately.run
// provides to your real disk. It is dev-only and absent from production builds.
// https://vite.dev/config/
export default defineConfig({
  plugins: [
    devFs(),
    { enforce: 'pre', ...mdx() },
    react(),
  ],
  // `fs` is provided by the dev-fs bridge in `vite dev` and by the immediately.run
  // host at runtime. immediately.run transpiles source directly (it never runs
  // this dist), so leave `fs` external in the production build rather than trying
  // to bundle a node builtin for the browser.
  build: {
    rollupOptions: {
      external: ['fs', 'node:fs'],
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    // Installs the stub host transport the SDK's root module needs at import time —
    // see src/test/setup.ts. Without it a component test dies before it runs.
    setupFiles: ['src/test/setup.ts'],
    server: {
      // The SDK's own dist uses extensionless relative imports (`./SafeContent`),
      // which a bundler resolves and raw node ESM does not. Inlining it makes the
      // safe-renderer tests exercise the REAL published package — the same bytes the
      // sandbox resolves on immediately.run — instead of a stub. Without this the
      // suite fails at import with "Cannot find module …/safeContent/SafeContent".
      deps: { inline: ['@immediately-run/sdk'] },
    },
  },
})
