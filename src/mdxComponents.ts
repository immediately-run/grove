import { DEFAULT_MDX_COMPONENTS } from '@immediately-run/sdk';
import { SAFE_INTRINSICS } from './lib/safeIntrinsics';
import AssetImage from './components/AssetImage';
import Callout from './components/Callout';
import Lede from './components/Lede';
import Infobox from './components/Infobox';
import More from './components/More';
import DocList from './components/DocList';
import TagCloud from './components/TagCloud';
import TagList from './components/TagList';
import Directory from './components/Directory';
import DirectoryList from './components/DirectoryList';
import WikiLink from './components/WikiLink';
import Quote from './components/Quote';
import KeyValue from './components/KeyValue';
import Kbd from './components/Kbd';
import Toc from './components/Toc';
import Backlinks from './components/Backlinks';
import PageMeta from './components/PageMeta';
import RecentlyUpdated from './components/RecentlyUpdated';
import DocsByTag from './components/DocsByTag';
import ChildPages from './components/ChildPages';
import Timeline from './components/Timeline';
import FamilyTree from './components/FamilyTree';
import Outlet from './components/Outlet';
import GroveNav from './components/GroveNav';
import GroveFooter from './components/GroveFooter';
import Sidebar from './components/Sidebar';

// The import-free component vocabulary every entry shares (Grove's "engine
// components" tier). Registered into the MDXProvider by boot(), so MDX uses them
// with no import line. `a` is overridden with the wiki-link resolver (resolved /
// broken / self states); `img` resolves mount-relative assets off the fs.
//
// boot() merges this map OVER the SDK's DEFAULT_MDX_COMPONENTS (@immediately-run/sdk
// ≥ 0.23.0, MARKDOWN_SYNTAX_SPEC §11.3), so the platform defaults (default `a`,
// `Admonition`, `WikiLink`) are inherited automatically — do NOT re-add a manual
// `...DEFAULT_MDX_COMPONENTS` spread here (redundant under merge semantics).
export const GROVE_MDX = {
  a: WikiLink,
  img: AssetImage,
  Callout,
  Lede,
  Infobox,
  More,
  DocList,
  TagCloud,
  TagList,
  Directory,
  DirectoryList,
  Quote,
  KeyValue,
  Kbd,
  Toc,
  Backlinks,
  PageMeta,
  RecentlyUpdated,
  DocsByTag,
  ChildPages,
  Timeline,
  FamilyTree,
  // Layout primitives — a `_layout.mdx` arranges the shell out of these around an
  // <Outlet/>, so the site chrome is content (see src/lib/layout.ts).
  Outlet,
  GroveNav,
  GroveSidebar: Sidebar,
  GroveFooter,
};

// The map the INTERPRETER (safe) renderer consumes — one definition, used by both
// `SafeEntryBody` (entry bodies) and `SafeLayout` (the `_layout.mdx` chain), so the two
// halves of a safe-rendered page can never drift apart in what they resolve. (R3-263)
//
// Layered exactly as `boot()` layers the compiled path, so a document renders identically
// under either standard: the SDK's platform defaults (Admonition / WikiLink / HeadingAnchor,
// carrying the deep-link resolver) UNDER the Grove vocabulary above — plus the sanitizing
// structural tags (`src/lib/safeIntrinsics.tsx`), which the compiled path gets for free from
// JSX and the safe path must be handed explicitly.
//
// Precedence is deliberate: intrinsics go on the BOTTOM. `GROVE_MDX` overrides `a` and `img`
// with <WikiLink>/<AssetImage>, and those must win — SAFE_INTRINSICS does not register `a`
// or `img` at all, but ordering it last would be a trap for whoever adds them.
export const SAFE_MDX = {
  ...SAFE_INTRINSICS,
  ...(DEFAULT_MDX_COMPONENTS as Record<string, unknown>),
  ...GROVE_MDX,
};
