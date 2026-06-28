import { DEFAULT_MDX_COMPONENTS } from '@immediately-run/sdk';
import AssetImage from './components/AssetImage';
import Callout from './components/Callout';
import Lede from './components/Lede';
import Infobox from './components/Infobox';
import More from './components/More';
import DocList from './components/DocList';
import TagCloud from './components/TagCloud';
import TagList from './components/TagList';
import Directory from './components/Directory';
import WikiLink from './components/WikiLink';
import Quote from './components/Quote';
import Toc from './components/Toc';
import Backlinks from './components/Backlinks';
import PageMeta from './components/PageMeta';
import RecentlyUpdated from './components/RecentlyUpdated';
import DocsByTag from './components/DocsByTag';
import ChildPages from './components/ChildPages';
import Timeline from './components/Timeline';
import FamilyTree from './components/FamilyTree';

// The import-free component vocabulary every entry shares (Grove's "engine
// components" tier). Registered into the MDXProvider by boot(), so MDX uses them
// with no import line. `a` is overridden with the wiki-link resolver (resolved /
// broken / self states); `img` resolves mount-relative assets off the fs.
export const GROVE_MDX = {
  ...DEFAULT_MDX_COMPONENTS,
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
  Quote,
  Toc,
  Backlinks,
  PageMeta,
  RecentlyUpdated,
  DocsByTag,
  ChildPages,
  Timeline,
  FamilyTree,
};
