import { DEFAULT_MDX_COMPONENTS } from '@immediately-run/sdk';
import AssetImage from './components/AssetImage';
import Callout from './components/Callout';
import Lede from './components/Lede';
import Infobox from './components/Infobox';
import More from './components/More';
import DocList from './components/DocList';
import TagCloud from './components/TagCloud';
import Directory from './components/Directory';

// The import-free component vocabulary every entry shares (Grove's "engine
// components" tier). Registered into the MDXProvider by boot(), so MDX uses them
// with no import line. `a` (the wiki-link/router Link) and other HTML overrides
// come from DEFAULT_MDX_COMPONENTS; we add the Markdown `img` resolver.
export const GROVE_MDX = {
  ...DEFAULT_MDX_COMPONENTS,
  img: AssetImage,
  Callout,
  Lede,
  Infobox,
  More,
  DocList,
  TagCloud,
  Directory,
};
