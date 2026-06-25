// Entry point. immediately.run runs this module (package.json "main") and
// boot() installs the host runtime providers (module cache, MDX provider,
// TinkerableContext, router) and renders into #root. Global CSS is imported
// here so it is present at runtime.
import './index.css';
import './GroveApp.css';
import { boot } from '@immediately-run/sdk/boot';
import { GROVE_MDX } from './mdxComponents';
import App from './App';

// A single catch-all route renders the Grove shell for every URL; the shell
// reads the current path from TinkerableContext and renders the matching entry,
// so the nav/footer/theme chrome persists across navigation.
boot({
  mdxComponents: GROVE_MDX as never,
  routingSpec: {
    routes: [{ name: 'grove', pattern: /.*/, reactNode: <App /> }],
  },
});
