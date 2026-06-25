/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/refs */
import React, { useState, useRef } from 'react';
import { getEntriesMap, SITE, NAV, INITIAL_TREE, PEOPLE } from '../data/wikiData';
import type { Entry, EntryBlock, Person } from '../data/wikiData';
import { backlinksFor, tokenizeInline } from '../lib/wikiHelpers';

/* ───────────────────────── ICONS (Lucide-style, currentColor, 1.75) ──────────── */
function I(paths: string[], extra?: React.SVGProps<SVGSVGElement>): React.ReactElement {
  return React.createElement(
    'svg',
    {
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.75,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      ...extra,
    },
    paths.map((d, i) => React.createElement('path', { key: i, d }))
  );
}

const IC = {
  search: () => I(['M11 11m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0', 'M21 21l-4.3-4.3']),
  pencil: () => I(['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z']),
  plus: () => I(['M12 5v14', 'M5 12h14']),
  menu: () => I(['M4 6h16', 'M4 12h16', 'M4 18h16']),
  sun: () =>
    I([
      'M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0',
      'M12 2v2',
      'M12 20v2',
      'M4.9 4.9l1.4 1.4',
      'M17.7 17.7l1.4 1.4',
      'M2 12h2',
      'M20 12h2',
      'M4.9 19.1l1.4-1.4',
      'M17.7 6.3l1.4-1.4',
    ]),
  moon: () => I(['M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z']),
  chevron: () => I(['M9 6l6 6-6 6']),
  chevronDown: () => I(['M6 9l6 6 6-6']),
  unlink: () =>
    I([
      'M17 7l1-1a4 4 0 0 1 6 6l-1 1',
      'M7 17l-1 1a4 4 0 0 1-6-6l1-1',
      'M3 3l18 18',
      'M11 7l1.5 1.5',
      'M16.5 12.5L18 14',
    ]),
  folder: () => I(['M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z']),
  file: () => I(['M14 3v5h5', 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z']),
  tip: () =>
    I([
      'M9 18h6',
      'M10 22h4',
      'M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2Z',
    ]),
  note: () => I(['M12 8v4', 'M12 16h.01', 'M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20Z']),
  warn: () =>
    I([
      'M12 9v4',
      'M12 17h.01',
      'M10.3 3.9 2 18a1.7 1.7 0 0 0 1.5 2.6h17A1.7 1.7 0 0 0 22 18L13.7 3.9a1.7 1.7 0 0 0-3 0Z',
    ]),
  spark: () => I(['M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4Z']),
  arrow: () => I(['M5 12h14', 'M13 6l6 6-6 6']),
  x: () => I(['M18 6 6 18', 'M6 6l12 12']),
  send: () => I(['M22 2 11 13', 'M22 2 15 22l-4-9-9-4Z']),
  check: () => I(['M20 6 9 17l-5-5']),
  undo: () => I(['M9 14 4 9l5-5', 'M4 9h11a5 5 0 0 1 0 10h-1']),
  external: () =>
    I([
      'M15 3h6v6',
      'M10 14 21 3',
      'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
    ]),
  key: () =>
    I(['M15 7a4 4 0 1 0-3.9 5l1.9 1.9 2 2 2-2-2-2 1.9-1.9A4 4 0 0 0 15 7Z']),
};

/* ───────────────────────── BRAND MARK (node-and-edge glyph) ──────────── */
function groveGlyph(color: string = '#fff'): React.ReactElement {
  return React.createElement(
    'svg',
    {
      viewBox: '0 0 32 32',
      style: { position: 'absolute', inset: 0, width: '100%', height: '100%' },
    },
    [
      React.createElement(
        'g',
        { key: 'e', stroke: color, strokeWidth: 1.6, strokeLinecap: 'round', opacity: 0.85 },
        [
          React.createElement('line', { key: 1, x1: 10, y1: 11, x2: 16, y2: 20 }),
          React.createElement('line', { key: 2, x1: 22, y1: 9, x2: 16, y2: 20 }),
          React.createElement('line', { key: 3, x1: 10, y1: 11, x2: 22, y2: 9 }),
        ]
      ),
      React.createElement('g', { key: 'n', fill: color }, [
        React.createElement('circle', { key: 1, cx: 10, cy: 11, r: 2.6 }),
        React.createElement('circle', { key: 2, cx: 22, cy: 9, r: 2.2 }),
        React.createElement('circle', { key: 3, cx: 16, cy: 20, r: 3 }),
      ]),
    ]
  );
}

function brandTile(): React.ReactElement {
  return React.createElement(
    'span',
    {
      className: 'tile',
      style: { background: 'var(--grad)', position: 'relative', display: 'inline-block' },
    },
    groveGlyph('#fff')
  );
}

interface AgentMsg {
  role: 'user' | 'agent';
  text?: string;
  kind?: 'proposal' | 'applied';
  intro?: string;
  discarded?: boolean;
  applied?: boolean;
  proposal?: {
    summary: string;
    files: { op: 'add' | 'edit'; path: string }[];
    diff: [string, string][];
    note: string[];
    gotoLabel?: string;
    gotoSlug?: string;
    applied: string;
    run: () => void;
  };
  gotoLabel?: string;
  gotoSlug?: string;
  note?: string[];
}

export default function GroveApp() {
  // App configuration & State
  const [route, setRoute] = useState<string>('home');
  const [theme, setTheme] = useState<string>('default');
  const [light, setLight] = useState<boolean>(false);
  const [nav, setNav] = useState<'side' | 'top'>('side');
  const [vw, setVw] = useState<'mobile' | 'desktop'>('desktop');
  const [dataState, setDataState] = useState<'content' | 'loading' | 'empty' | '404' | 'error'>('content');
  const [writable, setWritable] = useState<boolean>(true);
  const [treeOpen, setTreeOpen] = useState<Record<string, boolean>>({
    handbook: true,
    teams: true,
    processes: true,
    reports: true,
    people: false,
  });

  const [editBusy, setEditBusy] = useState<boolean>(false);
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [searchQ, setSearchQ] = useState<string>('');

  const [agentRest, setAgentRest] = useState<'line' | 'tab' | 'icon' | 'band'>('line');
  const [agentOpen, setAgentOpen] = useState<boolean>(false);
  const [agentDetent, setAgentDetent] = useState<'half' | 'full'>('half');
  const [agentBackend, setAgentBackend] = useState<'ok' | 'nokey' | 'forbidden'>('ok');
  
  const [agentMsgs, setAgentMsgs] = useState<AgentMsg[]>([]);
  const [agentThinking, setAgentThinking] = useState<boolean>(false);
  const [agentDraft, setAgentDraft] = useState<string>('');

  // Dynamically simulated wiki features
  const [timelineAdded, setTimelineAdded] = useState<boolean>(false);
  const [graphAdded, setGraphAdded] = useState<boolean>(false);
  const [wikiEntries, setWikiEntries] = useState<Record<string, Entry>>(getEntriesMap());
  const [treeData, setTreeTreeData] = useState(INITIAL_TREE);

  const rootRef = useRef<HTMLElement | null>(null);

  const navItems = () => {
    return NAV.concat(timelineAdded ? [{ label: 'Timeline', slug: 'view:timeline' }] : [])
      .concat(graphAdded ? [{ label: 'Org graph', slug: 'view:graph' }] : []);
  };

  const getScroller = () => {
    return rootRef.current ? rootRef.current.closest('.device__scroll') as HTMLElement : null;
  };

  const go = (slug: string) => {
    const sc = getScroller();
    if (slug.startsWith('tag:') || slug.startsWith('view:')) {
      setRoute(slug);
      setDataState('content');
      setSearchOpen(false);
      setMenuOpen(false);
      if (sc) sc.scrollTop = 0;
      return;
    }
    if (!wikiEntries[slug]) {
      setRoute(slug);
      setDataState('404');
      setSearchOpen(false);
      setMenuOpen(false);
      return;
    }
    setRoute(slug);
    setDataState('content');
    setSearchOpen(false);
    setMenuOpen(false);
    if (sc) sc.scrollTop = 0;
  };

  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  const toggleFolder = (name: string) => {
    setTreeOpen((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const effNav = () => (vw === 'mobile' ? 'top' : nav);

  const flashEdit = () => {
    setEditBusy(true);
    setTimeout(() => setEditBusy(false), 1100);
  };

  // Parsing & Inline styling using helpers
  const renderParsedText = (str: string, cur: string) => {
    const tokens = tokenizeInline(str);
    return tokens.map((t, i) => {
      if (t.type === 'text') {
        return t.content;
      }
      if (t.type === 'wiki-link') {
        const target = t.target;
        const exists = !!wikiEntries[target];
        const state = target === cur ? 'self' : exists ? 'ok' : 'broken';
        return React.createElement(
          'a',
          {
            key: i,
            className: 'grove-wikilink',
            'data-state': state,
            onClick: state === 'ok' ? () => go(target) : undefined,
            title: state === 'broken' ? `No entry "${target}" — ask Grove to create it` : target,
          },
          state === 'broken' ? [t.label, ' ', IC.unlink()] : t.label
        );
      }
      if (t.type === 'code') {
        return React.createElement('code', { key: i }, t.content);
      }
      if (t.type === 'bold') {
        return React.createElement('strong', { key: i }, t.content);
      }
      if (t.type === 'link') {
        const isInternal = !!wikiEntries[t.target];
        return React.createElement(
          'a',
          {
            key: i,
            className: 'mdlink',
            onClick: isInternal ? () => go(t.target) : undefined,
            href: isInternal ? undefined : t.target,
            target: isInternal ? undefined : '_blank',
            rel: isInternal ? undefined : 'noopener noreferrer',
          },
          t.label
        );
      }
      return null;
    });
  };

  const headingsOf = (entry: Entry) => {
    return (entry.body || [])
      .filter((b) => b.type === 'h2' || b.type === 'h3')
      .map((b, i) => ({
        id: 'h-' + i + '-' + (b.text || '').toLowerCase().replace(/[^a-z]+/g, '-'),
        text: b.text || '',
        lvl: b.type === 'h3' ? 3 : 2,
      }));
  };

  const renderBlock = (b: EntryBlock, cur: string, idx: number, hids: { id: string; text: string; lvl: number }[]) => {
    const P = (s: string) => renderParsedText(s, cur);
    switch (b.type) {
      case 'lede':
        return React.createElement(
          'p',
          { key: idx, style: { fontSize: '1.22em', lineHeight: 1.5, color: 'var(--ink-2)' } },
          P(b.text || '')
        );
      case 'p':
        return React.createElement('p', { key: idx }, P(b.text || ''));
      case 'h2':
      case 'h3': {
        const hid = hids.shift();
        return React.createElement(b.type, { key: idx, id: hid?.id }, b.text || '');
      }
      case 'ul':
        return React.createElement(
          'ul',
          { key: idx },
          (b.items || []).map((it, i) => React.createElement('li', { key: i }, P(it)))
        );
      case 'callout':
        return React.createElement(
          'div',
          { key: idx, className: 'grove-callout', 'data-v': b.variant },
          [
            b.variant === 'tip' ? IC.tip() : b.variant === 'warning' ? IC.warn() : IC.note(),
            React.createElement('div', { key: 'x' }, [
              React.createElement('div', { key: 1, className: 'grove-callout__t' }, b.title),
              React.createElement('div', { key: 2, className: 'grove-callout__b' }, P(b.text || '')),
            ]),
          ]
        );
      case 'table':
        return React.createElement(
          'div',
          { key: idx, className: 'grove-table-wrap' },
          React.createElement('table', { className: 'grove-table' }, [
            React.createElement(
              'thead',
              { key: 'h' },
              React.createElement(
                'tr',
                {},
                (b.head || []).map((c, i) => React.createElement('th', { key: i }, c))
              )
            ),
            React.createElement(
              'tbody',
              { key: 'b' },
              (b.rows || []).map((r, i) =>
                React.createElement(
                  'tr',
                  { key: i },
                  r.map((c, j) =>
                    React.createElement(
                      'td',
                      {
                        key: j,
                        className: j > 0 && /[$x%\u0394]|\d/.test(c) ? 'mono' : '',
                      },
                      c
                    )
                  )
                )
              )
            ),
          ])
        );
      case 'image':
        return React.createElement('figure', { key: idx, className: 'grove-img' }, [
          React.createElement('div', { key: 1, className: 'grove-img__box' }),
          React.createElement(
            'figcaption',
            { key: 2, className: 'grove-img__cap' },
            (b.label || '') + ' · resolving via SDK asset url…'
          ),
        ]);
      case 'infobox':
        return React.createElement('aside', { key: idx, className: 'grove-infobox' }, [
          React.createElement('div', { key: 1, className: 'grove-infobox__h' }, b.title),
          b.cover ? React.createElement('div', { key: 2, className: 'grove-infobox__cover' }) : null,
          React.createElement(
            'dl',
            { key: 3 },
            (b.fields || []).flatMap((f, i) => [
              React.createElement('dt', { key: 't' + i }, f[0]),
              React.createElement('dd', { key: 'd' + i }, f[1]),
            ])
          ),
        ]);
      case 'component':
        return renderComponent((b.props && b.props.name) || b.name || '', b.props || {}, idx);
      default:
        return null;
    }
  };

  const renderComponent = (name: string, props: any, idx: number) => {
    if (name === 'doclist') return DocList(props, idx);
    if (name === 'tagcloud') return TagCloud(idx);
    if (name === 'directory') return Directory(props, idx);
    return null;
  };

  const renderTag = (t: string, key: string | number) => {
    return React.createElement(
      'a',
      { key: key, className: 'grove-tag', onClick: () => go('tag:' + t) },
      '#' + t
    );
  };

  const DocList = (props: any, idx: number | string) => {
    const slugs = props.slugs || Object.keys(wikiEntries).filter((s) => !wikiEntries[s].isView);
    const items = slugs.map((s: string) => wikiEntries[s]).filter(Boolean);
    const head =
      props.title !== undefined && props.title !== null
        ? React.createElement('div', { key: 'h', className: 'grove-doclist__head' }, [
            React.createElement('h2', { key: 1 }, props.title),
            React.createElement('span', { key: 2, className: 'n' }, items.length + ' entries'),
          ])
        : null;

    if (props.shape === 'grid') {
      return React.createElement('div', { key: idx }, [
        head,
        React.createElement(
          'div',
          { key: 'g', className: 'grove-doclist', 'data-shape': 'grid' },
          items.map((e: Entry, i: number) =>
            React.createElement(
              'div',
              {
                key: i,
                className: 'gdl-card' + (i === 0 ? ' accent' : ''),
                onClick: () => go(e.slug),
              },
              [
                React.createElement('div', { key: 1, className: 'gdl-card__pic' }),
                React.createElement('div', { key: 2, className: 'gdl-card__foot' }, [
                  React.createElement('div', { key: 1, className: 'gdl-card__t' }, e.title),
                  React.createElement('div', { key: 2, className: 'gdl-card__d' }, e.desc),
                  React.createElement(
                    'div',
                    { key: 3, className: 'gdl-card__tags' },
                    e.tags.slice(0, 2).map((t, j) => renderTag(t, j))
                  ),
                ]),
              ]
            )
          )
        ),
      ]);
    }

    return React.createElement('div', { key: idx }, [
      head,
      React.createElement(
        'div',
        { key: 'f', className: 'grove-doclist', 'data-shape': 'feed' },
        items.map((e: Entry, i: number) =>
          React.createElement('div', { key: i, className: 'gdl-row', onClick: () => go(e.slug) }, [
            React.createElement('div', { key: 1 }, [
              React.createElement('div', { key: 1, className: 'gdl-row__t' }, e.title),
              React.createElement('div', { key: 2, className: 'gdl-row__d' }, e.desc),
              React.createElement(
                'div',
                { key: 3, className: 'gdl-row__tags' },
                e.tags.slice(0, 3).map((t, j) => renderTag(t, j))
              ),
            ]),
            React.createElement('div', { key: 2, className: 'gdl-row__meta' }, [
              e.date,
              React.createElement('br', { key: 'b' }),
              '→ ' + e.mins + ' min read',
            ]),
          ])
        )
      ),
    ]);
  };

  const TagCloud = (idx: number) => {
    const counts: Record<string, number> = {};
    Object.values(wikiEntries).forEach((e) =>
      e.tags.forEach((t) => (counts[t] = (counts[t] || 0) + 1))
    );
    return React.createElement(
      'div',
      { key: idx, className: 'grove-tagcloud' },
      Object.keys(counts)
        .sort()
        .map((t, i) =>
          React.createElement(
            'a',
            {
              key: i,
              className: 'grove-tag',
              onClick: () => go('tag:' + t),
              style: {
                fontSize: 11 + counts[t] * 2 + 'px',
                padding: '4px 12px',
              },
            },
            '#' + t + ' ',
            React.createElement('span', { key: 'n', style: { opacity: 0.5, marginLeft: 4 } }, counts[t])
          )
        )
    );
  };

  const Directory = (props: any, idx: number) => {
    const activePeople = PEOPLE.concat(
      agentMsgs.some((m) => m.applied && m.gotoSlug === 'directory' && m.proposal?.summary.includes('Jamie'))
        ? [
            {
              slug: 'people/jamie-rivera',
              name: 'Jamie Rivera',
              role: 'Support engineer',
              team: 'Engineering',
              phone: 'x2212',
              email: 'jamie@meridian.co',
            },
          ]
        : []
    );
    const rows = props.team ? activePeople.filter((p) => p.team === props.team) : activePeople;
    return React.createElement(
      'div',
      { key: idx, className: 'grove-table-wrap', style: { marginTop: props.compact ? 16 : 0 } },
      React.createElement('table', { className: 'grove-table' }, [
        React.createElement(
          'thead',
          { key: 'h' },
          React.createElement(
            'tr',
            {},
            ['Name', 'Role', props.compact ? null : 'Team', 'Phone', props.compact ? null : 'Email']
              .filter(Boolean)
              .map((c, i) => React.createElement('th', { key: i }, c as string))
          )
        ),
        React.createElement(
          'tbody',
          { key: 'b' },
          rows.map((p, i) =>
            React.createElement(
              'tr',
              { key: i, style: { cursor: 'pointer' }, onClick: () => go(p.slug) },
              [
                React.createElement('td', { key: 1, style: { fontWeight: 600 } }, p.name),
                React.createElement('td', { key: 2 }, p.role),
                props.compact ? null : React.createElement('td', { key: 3 }, p.team),
                React.createElement('td', { key: 4, className: 'mono' }, p.phone),
                props.compact ? null : React.createElement('td', { key: 5, className: 'mono' }, p.email),
              ].filter(Boolean)
            )
          )
        ),
      ])
    );
  };

  const EntryView = (entry: Entry) => {
    const cur = entry.slug;
    const hids = headingsOf(entry);
    const hidsCopy = hids.slice();
    const isDoc = entry.layout === 'doc';
    const header = React.createElement('header', { key: 'hd', className: 'grove-entry-header' }, [
      entry.crumb && entry.crumb.length
        ? React.createElement('nav', { key: 'c', className: 'crumb' }, [
            React.createElement('a', { key: 0, onClick: () => go('home') }, 'home'),
            ...entry.crumb.flatMap((c, i) => [
              React.createElement('span', { key: 's' + i }, '/'),
              React.createElement('span', { key: 'c' + i }, c),
            ]),
            React.createElement('span', { key: 'sf' }, '/'),
            React.createElement(
              'span',
              { key: 'cf', style: { color: 'var(--ink-2)' } },
              entry.slug.split('/').pop()
            ),
          ])
        : null,
      React.createElement('h1', { key: 't', className: entry.grad ? 'grad' : '' }, entry.title),
      React.createElement('div', { key: 'm', className: 'grove-meta' }, [
        React.createElement('span', { key: 1 }, entry.date),
        React.createElement('span', { key: 2, className: 'dot' }, '·'),
        React.createElement('span', { key: 3 }, '→ ' + entry.mins + ' min read'),
        React.createElement('span', { key: 4, className: 'dot' }, '·'),
        ...entry.tags.map((t, i) => renderTag(t, 'tg' + i)),
        writable
          ? React.createElement(
              'button',
              {
                key: 'ed',
                className: 'grove-edit-affordance',
                'data-busy': editBusy ? '1' : '0',
                title: 'Edit in the immediately.run editor',
                onClick: flashEdit,
              },
              [IC.pencil(), editBusy ? 'Opening editor…' : 'Edit']
            )
          : null,
      ]),
    ]);
    const prose = React.createElement(
      'div',
      { key: 'pr', className: 'grove-prose' },
      entry.body.map((b, i) => renderBlock(b, cur, i, hidsCopy))
    );
    const backlinks = entry.isView ? null : Backlinks(entry);
    const main = React.createElement('div', { key: 'main', className: 'gp-main' }, [
      header,
      prose,
      backlinks,
    ]);

    if (isDoc && vw === 'desktop') {
      const toc = React.createElement('aside', { key: 'toc', className: 'grove-toc' }, [
        React.createElement('div', { key: 'h', className: 'grove-toc__h' }, 'On this page'),
        hids.map((hd, i) =>
          React.createElement(
            'a',
            {
              key: i,
              className: hd.lvl === 3 ? 'lvl3' : '',
              'data-cur': i === 0 ? '1' : '0',
              onClick: () => scrollTo(hd.id),
            },
            hd.text
          )
        ),
      ]);
      return React.createElement('div', { key: 'pg', className: 'grove-page', 'data-layout': 'doc' }, [
        main,
        toc,
      ]);
    }

    if (isDoc && vw === 'mobile' && hids.length) {
      const disc = React.createElement('details', { key: 'disc', className: 'grove-toc__disclosure' }, [
        React.createElement('summary', { key: 's' }, 'On this page · ' + hids.length + ' sections'),
        React.createElement(
          'nav',
          { key: 'n', className: 'grove-toc' },
          hids.map((hd, i) =>
            React.createElement(
              'a',
              { key: i, className: hd.lvl === 3 ? 'lvl3' : '', onClick: () => scrollTo(hd.id) },
              hd.text
            )
          )
        ),
      ]);
      return React.createElement(
        'div',
        { key: 'pg', className: 'grove-page', 'data-layout': 'doc' },
        React.createElement('div', { className: 'gp-main' }, [header, disc, prose, backlinks])
      );
    }

    return React.createElement('div', { key: 'pg', className: 'grove-page', 'data-layout': entry.layout }, main);
  };

  const scrollTo = (id: string) => {
    const sc = getScroller();
    const el = sc ? sc.querySelector('#' + CSS.escape(id)) as HTMLElement : null;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const Backlinks = (entry: Entry) => {
    const bl = backlinksFor(entry.slug, wikiEntries);
    return React.createElement('section', { key: 'bl', className: 'grove-backlinks' }, [
      React.createElement('div', { key: 'h', className: 'grove-backlinks__h' }, [
        React.createElement('span', { key: 1 }, 'Linked from'),
        React.createElement('span', { key: 2, className: 'n' }, bl.length + ' entries'),
      ]),
      bl.length
        ? React.createElement(
            'div',
            { key: 'l', className: 'grove-backlinks__list' },
            bl.map((b, i) =>
              React.createElement('a', { key: i, className: 'grove-bl', onClick: () => go(b.slug) }, [
                React.createElement('div', { key: 1, className: 'grove-bl__t' }, [
                  b.title,
                  b.crumb ? React.createElement('span', { key: 'c', className: 'crumb' }, b.crumb + '/') : null,
                ]),
                React.createElement('div', { key: 2, className: 'grove-bl__snip' }, '…' + b.snip + '…'),
              ])
            )
          )
        : React.createElement(
            'p',
            { key: 'e', style: { color: 'var(--ink-3)', fontSize: 14, marginTop: 8 } },
            'Nothing links here yet.'
          ),
    ]);
  };

  const TopNav = () => {
    return React.createElement('nav', { key: 'nav', className: 'grove-nav' }, [
      React.createElement(
        'button',
        {
          key: 'hb',
          className: 'grove-hamburger icbtn',
          title: 'Menu',
          onClick: () => setMenuOpen(true),
        },
        IC.menu()
      ),
      React.createElement('a', { key: 'br', className: 'grove-brand', onClick: () => go('home') }, [
        brandTile(),
        SITE.title,
      ]),
      effNav() === 'top' && vw === 'desktop'
        ? React.createElement(
            'div',
            { key: 'lk', className: 'grove-nav__links' },
            navItems().map((n, i) =>
              React.createElement(
                'a',
                {
                  key: i,
                  'data-cur': route === n.slug ? '1' : '0',
                  onClick: () => go(n.slug),
                },
                n.label
              )
            )
          )
        : null,
      React.createElement('div', { key: 'cl', className: 'grove-nav__cluster' }, [
        React.createElement(
          'button',
          { key: 's', className: 'icbtn', title: 'Search', onClick: () => setSearchOpen(true) },
          IC.search()
        ),
        React.createElement(
          'button',
          { key: 't', className: 'icbtn', title: 'Theme', onClick: () => setLight(!light) },
          light ? IC.moon() : IC.sun()
        ),
        writable ? React.createElement('button', { key: 'n', className: 'icbtn', title: 'New entry' }, IC.plus()) : null,
        writable
          ? React.createElement(
              'button',
              {
                key: 'a',
                className: 'icbtn icbtn--primary',
                title: 'Ask Grove',
                onClick: () => setAgentOpen(true),
              },
              IC.spark()
            )
          : null,
      ]),
    ]);
  };

  const Sidebar = (entry?: Entry) => {
    const cur = entry?.slug;
    const tree = treeData.map((f, i) => {
      const open = treeOpen[f.name] !== false;
      return React.createElement('div', { key: i }, [
        React.createElement(
          'div',
          {
            key: 'r',
            className: 'gs-tree__row gs-folder',
            'data-open': open ? '1' : '0',
            onClick: () => toggleFolder(f.name),
          },
          [
            React.createElement(
              'span',
              { key: 'c', className: 'chev', style: { display: 'inline-flex', width: 14, height: 14 } },
              IC.chevron()
            ),
            IC.folder(),
            f.name,
            React.createElement('span', { key: 'ct', className: 'ct' }, f.count),
          ]
        ),
        open
          ? React.createElement(
              'div',
              { key: 'ch', className: 'gs-tree__children' },
              f.children?.map((c, j) =>
                React.createElement(
                  'div',
                  { key: j, className: 'gs-tree__row', 'data-cur': c.slug === cur ? '1' : '0', onClick: () => go(c.slug || '') },
                  [IC.file(), c.name]
                )
              )
            )
          : null,
      ]);
    });

    return React.createElement('aside', { key: 'sb', className: 'grove-sidebar' }, [
      React.createElement('div', { key: 't', className: 'gs-block' }, [
        React.createElement('div', { key: 'h', className: 'gs-block__h' }, 'Namespace'),
        React.createElement('div', { key: 'b', className: 'gs-tree' }, tree),
      ]),
      React.createElement('div', { key: 'a', className: 'gs-block' }, [
        React.createElement('div', { key: 'h', className: 'gs-block__h' }, [
          React.createElement('span', { key: 1 }, 'About'),
          React.createElement(
            'span',
            { key: 2, className: 'mono', style: { fontSize: 9, opacity: 0.6 } },
            'ui/sidebar'
          ),
        ]),
        React.createElement('div', { key: 'b', className: 'gs-section__body' }, [
          "Meridian's internal handbook. Change anything by asking Grove. Read the colophon at ",
          React.createElement(
            'a',
            { key: 'l', className: 'grove-wikilink', 'data-state': 'ok', onClick: () => go('about') },
            'about'
          ),
          '.',
        ]),
      ]),
      React.createElement('div', { key: 'r', className: 'gs-block' }, [
        React.createElement('div', { key: 'h', className: 'gs-block__h' }, 'Recently updated'),
        React.createElement(
          'div',
          { key: 'b', style: { padding: 0 } },
          ['handbook/onboarding', 'processes/incident-response', 'reports/q2-2026'].map((s, i) => {
            const e = wikiEntries[s];
            if (!e) return null;
            return React.createElement(
              'div',
              { key: i, className: 'gs-tree__row', onClick: () => go(s) },
              [
                React.createElement(
                  'span',
                  { key: 't', style: { fontSize: 13 } },
                  e.title.replace(/\.$/, '')
                ),
                React.createElement('span', { key: 'd', className: 'ct' }, e.date.slice(5)),
              ]
            );
          })
        ),
      ]),
    ]);
  };

  const Footer = () => {
    return React.createElement('footer', { key: 'ft', className: 'grove-footer' }, [
      React.createElement('div', { key: 'l', className: 'grove-footer__links' }, [
        React.createElement('a', { key: 1, onClick: () => go('about') }, 'About'),
        React.createElement('a', { key: 2, onClick: () => go('directory') }, 'Directory'),
        React.createElement('a', { key: 3 }, 'GROVE.md'),
      ]),
      React.createElement(
        'div',
        { key: 'm', className: 'grove-footer__meta' },
        Object.keys(wikiEntries).length + ' entries · built with grove'
      ),
    ]);
  };

  const TagPage = (tag: string) => {
    const items = Object.values(wikiEntries).filter((e) => e.tags.includes(tag) && !e.isView);
    return React.createElement('div', { key: 'tp', className: 'grove-page', 'data-layout': 'full' }, [
      React.createElement('header', { key: 'h', className: 'grove-entry-header' }, [
        React.createElement('div', { key: 'c', className: 'crumb' }, 'tag'),
        React.createElement('h1', { key: 't' }, [
          React.createElement(
            'span',
            {
              key: 1,
              className: 'grove-tag',
              'data-active': '1',
              style: { fontSize: '0.5em', verticalAlign: 'middle', marginRight: 10 },
            },
            '#' + tag
          ),
          items.length + ' entries.',
        ]),
      ]),
      items.length
        ? DocList({ shape: 'feed', title: null, slugs: items.map((e) => e.slug) }, 'dl')
        : React.createElement(
            'div',
            { className: 'grove-state' },
            React.createElement('h2', {}, 'No entries tagged #' + tag + ' yet.')
          ),
    ]);
  };

  const Skeleton = () => {
    return React.createElement(
      'div',
      { key: 'sk', className: 'grove-page', 'data-layout': 'doc' },
      React.createElement('div', { className: 'gp-main' }, [
        React.createElement('div', {
          key: 1,
          className: 'sk',
          style: { width: '40%', height: 34, marginBottom: 18 },
        }),
        React.createElement('div', {
          key: 2,
          className: 'sk',
          style: { width: '62%', height: 14, marginBottom: 30 },
        }),
        ...[80, 95, 70, 90, 60, 85, 75].map((w, i) =>
          React.createElement('div', {
            key: 'l' + i,
            className: 'sk sk-line',
            style: { width: w + '%' },
          })
        ),
      ])
    );
  };

  const LatticeArt = () => {
    return React.createElement('svg', { viewBox: '0 0 140 96', style: { width: '100%', height: '100%' } }, [
      React.createElement('g', { key: 'e', stroke: 'var(--line-2)', strokeWidth: 1 }, [
        React.createElement('line', { key: 1, x1: 30, y1: 30, x2: 70, y2: 20 }),
        React.createElement('line', { key: 2, x1: 70, y1: 20, x2: 110, y2: 38 }),
        React.createElement('line', { key: 3, x1: 30, y1: 30, x2: 54, y2: 66 }),
        React.createElement('line', { key: 4, x1: 54, y1: 66, x2: 96, y2: 74 }),
        React.createElement('line', { key: 5, x1: 70, y1: 20, x2: 54, y2: 66 }),
        React.createElement('line', { key: 6, x1: 110, y1: 38, x2: 96, y2: 74 }),
      ]),
      React.createElement(
        'g',
        { key: 'n', fill: 'var(--ink-3)' },
        [[30, 30, 4], [70, 20, 3], [110, 38, 4], [54, 66, 3], [96, 74, 4]].map((p, i) =>
          React.createElement('circle', { key: i, cx: p[0], cy: p[1], r: p[2] })
        )
      ),
    ]);
  };

  const NotFound = (slug: string) => {
    const tail = slug.split('/').pop() || '';
    const guess = Object.keys(wikiEntries).find((s) => s !== slug && s.includes(tail.slice(0, 4))) || 'home';
    return React.createElement('div', { key: 'nf', className: 'grove-state' }, [
      React.createElement('div', { key: 1, className: 'grove-state__art' }, LatticeArt()),
      React.createElement('h2', { key: 2 }, 'No entry at /' + slug + '.'),
      React.createElement('p', { key: 3 }, [
        'That ',
        React.createElement(
          'span',
          { key: 1, className: 'grove-wikilink', 'data-state': 'broken', style: { cursor: 'default' } },
          '[[wiki-link]]'
        ),
        ' points nowhere yet. Closest match: ',
        React.createElement('code', { key: 2 }, '/' + guess),
        '.',
      ]),
      React.createElement('div', { key: 4, className: 'grove-state__actions' }, [
        React.createElement(
          'button',
          { key: 1, className: 'btn-ghost', onClick: () => go(guess) },
          [
            'Go to ',
            React.createElement(
              'code',
              { key: 'c', style: { background: 'none', border: 0, padding: 0, color: 'inherit' } },
              guess
            ),
          ]
        ),
        writable
          ? React.createElement(
              'button',
              { key: 2, className: 'btn-primary', onClick: () => setAgentOpen(true) },
              [IC.spark(), 'Create it with Grove']
            )
          : null,
      ]),
    ]);
  };

  /* ───────── AGENT LOGIC & BOT SIMULATION ───────── */
  const openAgent = () => {
    if (!writable) return;
    setAgentOpen(true);
    setAgentDetent(agentDetent || 'half');
  };
  
  const closeAgent = () => setAgentOpen(false);

  const agentFmt = (str: string) => {
    const out: React.ReactNode[] = [];
    str.split(/(`[^`]+`)/g).forEach((p, i) => {
      if (p.startsWith('`') && p.endsWith('`')) {
        out.push(React.createElement('code', { key: i }, p.slice(1, -1)));
      } else if (p) {
        out.push(p);
      }
    });
    return out;
  };

  const pushMsg = (m: AgentMsg) => {
    setAgentMsgs((prev) => prev.concat([m]));
  };

  const sendAgent = (text?: string) => {
    const finalTxt = (text || agentDraft || '').trim();
    if (!finalTxt) return;
    if (agentBackend !== 'ok') return;
    pushMsg({ role: 'user', text: finalTxt });
    setAgentDraft('');
    setAgentThinking(true);
    setAgentOpen(true);
    setTimeout(() => {
      setAgentThinking(false);
      respond(finalTxt);
    }, 850);
  };

  const respond = (text: string) => {
    const t = text.toLowerCase();
    const newP = (p: Partial<AgentMsg>) => {
      pushMsg({ role: 'agent', kind: 'proposal', applied: false, ...p });
    };

    if (/(timeline|chronolog)/.test(t)) {
      newP({
        intro:
          'A timeline view reads every entry with a `date` and lays them on an axis — no entry has to change. I’ll add the component and a nav item.',
        proposal: {
          summary: 'Add a Timeline view (reads the `date` frontmatter already on every entry).',
          files: [
            { op: 'add', path: 'src/components/Timeline.tsx' },
            { op: 'edit', path: 'src/providers.ts' },
            { op: 'add', path: 'content/views/timeline.mdx' },
          ],
          diff: [
            ['ctx', '// src/providers.ts'],
            ['ctx', 'export const components = {'],
            ['ctx', '  DocList, Backlinks, TagCloud,'],
            ['add', '+ Timeline,            // reads index, sorts by date'],
            ['ctx', '};'],
            ['ctx', ''],
            ['ctx', '// content/views/timeline.mdx'],
            ['add', '+ ---'],
            ['add', '+ title: Timeline'],
            ['add', '+ tags: [ui/nav]'],
            ['add', '+ ---'],
            ['add', '+ <Timeline />'],
          ],
          note: ['New component `Timeline` and a `ui/nav` tag.'],
          gotoLabel: 'View the timeline',
          gotoSlug: 'view:timeline',
          applied:
            'Added a `Timeline` view and a companion `Org graph` view — both read frontmatter that already exists (`date` and `team`). No entries were modified.',
          run: () => {
            setTimelineAdded(true);
            setGraphAdded(true);
          },
        },
      });
    } else if (/(broken|fix|dead).*(link|travel)|travel.?policy/.test(t) || /fix.*link/.test(t)) {
      newP({
        intro:
          'One broken link: `[[travel-policy]]` in `handbook/onboarding`. I’ll create the missing entry as a stub so the link resolves.',
        proposal: {
          summary: 'Create the missing `handbook/travel-policy` entry so `[[travel-policy]]` resolves.',
          files: [{ op: 'add', path: 'content/handbook/travel-policy.mdx' }],
          diff: [
            ['add', '+ ---'],
            ['add', '+ title: Travel policy'],
            ['add', '+ slug: travel-policy'],
            ['add', '+ tags: [handbook, policy]'],
            ['add', '+ ---'],
            ['add', '+ # Travel policy'],
            ['add', '+ A stub. Booking, per-diems, and approvals go here.'],
          ],
          note: ['Resolves 1 broken `[[wiki-link]]`.'],
          gotoLabel: 'Open the new entry',
          gotoSlug: 'handbook/travel-policy',
          applied: 'Created `handbook/travel-policy`. The broken link in `onboarding` now resolves.',
          run: () => {
            setWikiEntries((prev) => ({
              ...prev,
              'handbook/travel-policy': {
                slug: 'handbook/travel-policy',
                title: 'Travel policy.',
                layout: 'doc',
                crumb: ['handbook'],
                tags: ['handbook', 'policy'],
                date: '2026-06-25',
                mins: 2,
                desc: 'Booking, per-diems, and approvals.',
                body: [
                  {
                    type: 'p',
                    text: 'A stub created by Grove. Booking, per-diems, and approvals go here. Back to [[handbook/onboarding|onboarding]].',
                  },
                ],
              },
            }));
          },
        },
      });
    } else if (/(add|new).*(person|directory|phone|someone|hire)|directory.*add/.test(t)) {
      newP({
        intro:
          'I’ll add a person entry with the `role`, `team`, and `phone` the directory reads. Nothing else changes.',
        proposal: {
          summary: 'Add `people/jamie-rivera` with directory frontmatter.',
          files: [{ op: 'add', path: 'content/people/jamie-rivera.mdx' }],
          diff: [
            ['add', '+ ---'],
            ['add', '+ name: Jamie Rivera'],
            ['add', '+ role: Support engineer'],
            ['add', '+ team: Engineering'],
            ['add', '+ phone: x2212'],
            ['add', '+ tags: [person]'],
            ['add', '+ ---'],
          ],
          note: ['Uses the declared person schema — no new convention.'],
          gotoLabel: 'Open the directory',
          gotoSlug: 'directory',
          applied:
            'Added `people/jamie-rivera`. Tagged `#person`. They appear in the directory and the engineering roster.',
          run: () => {
            const p: Person = {
              slug: 'people/jamie-rivera',
              name: 'Jamie Rivera',
              role: 'Support engineer',
              team: 'Engineering',
              phone: 'x2212',
              email: 'jamie@meridian.co',
            };
            setWikiEntries((prev) => {
              if (prev[p.slug]) return prev;
              return {
                ...prev,
                [p.slug]: {
                  slug: p.slug,
                  title: p.name + '.',
                  layout: 'doc',
                  crumb: ['people'],
                  tags: ['person', 'engineering'],
                  date: '2026-06-25',
                  mins: 1,
                  desc: p.role + ' on ' + p.team + '.',
                  body: [
                    {
                      type: 'infobox',
                      title: p.name,
                      fields: [
                        ['Role', p.role],
                        ['Team', p.team],
                        ['Phone', p.phone],
                        ['Email', p.email],
                      ],
                    },
                    {
                      type: 'p',
                      text:
                        p.name +
                        ' is a support engineer on the [[teams/engineering|engineering]] team. Reach them at `' +
                        p.phone +
                        '`.',
                    },
                  ],
                },
              };
            });

            // Re-render tree dynamically
            setTreeTreeData((prevTree) =>
              prevTree.map((f) => {
                if (f.name === 'people') {
                  const hasJamie = f.children?.some((c) => c.slug === p.slug);
                  if (hasJamie) return f;
                  return {
                    ...f,
                    count: (f.count || 0) + 1,
                    children: (f.children || []).concat([
                      { type: 'file', slug: p.slug, name: 'jamie-rivera' },
                    ]),
                  };
                }
                return f;
              })
            );
          },
        },
      });
    } else if (/(sidebar|reorganbe|reorganize|nav|menu|reorder)/.test(t)) {
      newP({
        intro:
          'The sidebar is composed from `ui/sidebar`-tagged entries, ordered by `order`. Reordering is editing frontmatter — no code.',
        proposal: {
          summary: 'Reorder the sidebar: put `About` above `Recently updated`.',
          files: [
            { op: 'edit', path: 'content/sidebar/about.mdx' },
            { op: 'edit', path: 'content/sidebar/recent.mdx' },
          ],
          diff: [
            ['ctx', '# sidebar/about.mdx frontmatter'],
            ['del', '- order: 20'],
            ['add', '+ order: 10'],
            ['ctx', ''],
            ['ctx', '# sidebar/recent.mdx frontmatter'],
            ['del', '- order: 10'],
            ['add', '+ order: 20'],
          ],
          note: ['Just `order` values — the chrome is content.'],
          applied: 'Reordered the sidebar by editing two `order` fields. No engine change.',
          run: () => {},
        },
      });
    } else {
      pushMsg({
        role: 'agent',
        text:
          "I’m scoped to this wiki — I can add or edit entries, fix links, manage tags, and add views, all through Grove’s grants. Try one of the suggestions, or tell me what to change about `" +
          route +
          '`.',
      });
    }
  };

  const applyProposal = (idx: number) => {
    setAgentMsgs((prev) => {
      const msgs = prev.slice();
      const m = msgs[idx];
      if (!m || m.applied) return prev;
      if (m.proposal && m.proposal.run) m.proposal.run();
      
      msgs[idx] = { ...m, applied: true };
      msgs.push({
        role: 'agent',
        kind: 'applied',
        text: m.proposal?.applied,
        gotoLabel: m.proposal?.gotoLabel,
        gotoSlug: m.proposal?.gotoSlug,
        note: m.proposal?.note,
      });
      return msgs;
    });
  };

  const discardProposal = (idx: number) => {
    setAgentMsgs((prev) => {
      const msgs = prev.slice();
      if (msgs[idx]) {
        msgs[idx] = { ...msgs[idx], discarded: true };
      }
      return msgs;
    });
  };

  /* ───────── AGENT LAYOUT LAYER ───────── */
  const AgentLayer = () => {
    if (!writable) return null;
    return React.createElement('div', { className: 'grove-agent' }, [
      !agentOpen ? AgentResting() : null,
      agentOpen ? AgentPanel() : null,
    ]);
  };

  const AgentResting = () => {
    const mk = () => React.createElement('span', { className: 'mk' }, groveGlyph('#fff'));
    const onSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      sendAgent();
    };

    if (agentRest === 'line') {
      return React.createElement('form', { key: 'l', className: 'ga-line', onSubmit }, [
        mk(),
        React.createElement('input', {
          key: 'i',
          placeholder: 'Ask Grove to change this entry…',
          value: agentDraft,
          onChange: (e) => setAgentDraft(e.target.value),
          onFocus: openAgent,
        }),
        React.createElement('button', { key: 'b', type: 'submit', className: 'go', 'aria-label': 'Send' }, IC.send()),
      ]);
    }

    if (agentRest === 'tab') {
      return React.createElement('button', { key: 't', className: 'ga-tab', onClick: openAgent }, [
        React.createElement('div', { key: 1, className: 'grip' }),
        React.createElement('div', { key: 2, className: 'lbl' }, [mk(), 'Ask Grove']),
      ]);
    }

    if (agentRest === 'icon') {
      return React.createElement(
        'button',
        { key: 'i', className: 'ga-icon', onClick: openAgent, 'aria-label': 'Ask Grove' },
        IC.spark()
      );
    }

    if (agentRest === 'band') {
      return React.createElement('div', { key: 'b', className: 'ga-band' }, [
        React.createElement('div', { key: 1, className: 'ga-band__status' }, [
          mk(),
          React.createElement('span', { key: 2 }, [
            'Grove’s agent · ',
            React.createElement('b', { key: 'b' }, 'scoped to this wiki'),
            ' · ready',
          ]),
        ]),
        React.createElement('form', { key: 2, className: 'ga-band__row', onSubmit }, [
          React.createElement('input', {
            key: 'i',
            placeholder: 'Ask Grove…',
            value: agentDraft,
            onChange: (e) => setAgentDraft(e.target.value),
            onFocus: openAgent,
          }),
          React.createElement('button', { key: 'g', type: 'submit', className: 'go' }, IC.send()),
        ]),
      ]);
    }

    return null;
  };

  const AgentPanel = () => {
    const head = React.createElement('div', { key: 'head', className: 'ga-head' }, [
      vw === 'mobile' ? React.createElement('div', { key: 'g', className: 'grip' }) : null,
      React.createElement('span', { key: 'mk', className: 'mk' }, groveGlyph('#fff')),
      React.createElement('div', { key: 'id' }, [React.createElement('div', { className: 'id' }, 'Grove')]),
      React.createElement('span', { key: 'sc', className: 'scope' }, [IC.spark(), 'scoped to this wiki']),
      React.createElement('div', { key: 'gr', className: 'grow' }, [
        vw === 'mobile'
          ? React.createElement(
              'button',
              {
                key: 'd',
                className: 'ic',
                title: 'Resize',
                onClick: () => setAgentDetent(agentDetent === 'full' ? 'half' : 'full'),
              },
              IC.chevron()
            )
          : null,
        React.createElement('button', { key: 'x', className: 'ic', title: 'Collapse', onClick: closeAgent }, IC.x()),
      ]),
    ]);

    let banner = null;
    if (agentBackend === 'nokey') {
      banner = React.createElement('div', { key: 'bn', className: 'ga-banner' }, [
        IC.key(),
        React.createElement('div', { key: 't' }, [
          React.createElement('div', { className: 'ga-banner__t' }, 'Connect a key to use the agent.'),
          React.createElement('div', { className: 'ga-banner__d' }, [
            'Grove uses your own model key. ',
            React.createElement(
              'a',
              { key: 'a', onClick: () => setAgentBackend('ok') },
              'Add one in settings'
            ),
            ' to start. Reading the wiki never needs a key.',
          ]),
        ]),
      ]);
    } else if (agentBackend === 'forbidden') {
      banner = React.createElement('div', { key: 'bf', className: 'ga-banner' }, [
        IC.warn(),
        React.createElement('div', { key: 't' }, [
          React.createElement('div', { className: 'ga-banner__t' }, 'That’s outside Grove’s grants.'),
          React.createElement(
            'div',
            { className: 'ga-banner__d' },
            "Grove’s agent can only do what this app may do — edit entries, tags, links, and views. It can’t reach other apps or change host settings."
          ),
        ]),
      ]);
    }

    const body = React.createElement('div', { key: 'b', className: 'ga-body' }, AgentBody());
    const foot = React.createElement('div', { key: 'f', className: 'ga-foot' }, [
      React.createElement(
        'form',
        {
          key: 'r',
          className: 'ga-foot__row',
          onSubmit: (e) => {
            e.preventDefault();
            sendAgent();
          },
        },
        [
          React.createElement('input', {
            key: 'i',
            placeholder: agentBackend === 'ok' ? 'Ask Grove to change this wiki…' : 'Agent unavailable',
            value: agentDraft,
            disabled: agentBackend !== 'ok',
            onChange: (e) => setAgentDraft(e.target.value),
          }),
          React.createElement(
            'button',
            {
              key: 'g',
              type: 'submit',
              className: 'go',
              disabled: agentBackend !== 'ok' || !agentDraft.trim(),
            },
            IC.send()
          ),
        ]
      ),
      React.createElement('div', { key: 'h', className: 'ga-foot__hand' }, [
        React.createElement('span', { key: 1 }, 'Grove’s own agent · writes route through the host'),
        React.createElement('a', { key: 2 }, [IC.external(), 'Open in the workbench agent']),
      ]),
    ]);

    const inner = React.createElement('div', { key: 'in', className: 'ga-panel-inner' }, [
      head,
      banner,
      body,
      foot,
    ]);

    return [
      React.createElement('div', { key: 'sc', className: 'ga-scrim', onClick: closeAgent }),
      React.createElement('div', { key: 'pn', className: 'ga-panel', 'data-detent': agentDetent }, inner),
    ];
  };

  const AgentBody = () => {
    const out: React.ReactNode[] = [];
    if (agentMsgs.length === 0) {
      out.push(
        React.createElement('div', { key: 'ex', className: 'ga-explain' }, [
          'Grove’s agent knows ',
          React.createElement('b', { key: 1 }, 'this wiki'),
          ' — its frontmatter schema, tags, namespace, and components from ',
          React.createElement('b', { key: 2 }, 'GROVE.md'),
          '. Ask in plain language; it writes the MDX, shows you the diff, and records new conventions.',
        ])
      );
      out.push(
        React.createElement(
          'div',
          { key: 'ch', className: 'ga-chips' },
          suggestions().map((c, i) =>
            React.createElement('button', { key: i, className: 'ga-chip', onClick: () => sendAgent(c) }, c)
          )
        )
      );
      return out;
    }

    agentMsgs.forEach((m, i) => out.push(AgentMsgView(m, i)));
    if (agentThinking) {
      out.push(
        React.createElement('div', { key: 'think', className: 'ga-msg' }, [
          React.createElement('div', { key: 1, className: 'ga-msg__av grove' }, groveGlyph('#fff')),
          React.createElement('div', { key: 2, className: 'ga-msg__b' }, [
            React.createElement('div', { className: 'ga-msg__who' }, 'Grove'),
            React.createElement('div', { className: 'ga-msg__txt' }, [
              React.createElement('span', { key: 'c', className: 'ga-cursor' }),
            ]),
          ]),
        ])
      );
    }
    return out;
  };

  const suggestions = () => [
    'Add a person to the directory',
    'Fix broken links here',
    'Add a timeline view',
    'Reorganize the sidebar',
  ];

  const AgentMsgView = (m: AgentMsg, i: number) => {
    if (m.role === 'user') {
      return React.createElement('div', { key: i, className: 'ga-msg user' }, [
        React.createElement('div', { key: 1, className: 'ga-msg__av user' }, 'you'),
        React.createElement('div', { key: 2, className: 'ga-msg__b' }, [
          React.createElement('div', { className: 'ga-msg__who' }, 'You'),
          React.createElement('div', { className: 'ga-msg__txt' }, m.text),
        ]),
      ]);
    }

    const blocks: React.ReactNode[] = [];
    if (m.intro) blocks.push(React.createElement('div', { key: 'in', className: 'ga-msg__txt' }, agentFmt(m.intro)));
    if (m.text && m.kind !== 'applied') {
      blocks.push(React.createElement('div', { key: 'tx', className: 'ga-msg__txt' }, agentFmt(m.text)));
    }
    if (m.kind === 'proposal' && !m.discarded) blocks.push(ProposalCard(m, i));
    if (m.kind === 'applied') blocks.push(AppliedCard(m));
    if (m.discarded) {
      blocks.push(
        React.createElement(
          'div',
          { key: 'd', className: 'ga-msg__txt', style: { color: 'var(--ink-3)', fontStyle: 'italic' } },
          'Discarded.'
        )
      );
    }

    return React.createElement('div', { key: i, className: 'ga-msg' }, [
      React.createElement('div', { key: 1, className: 'ga-msg__av grove' }, groveGlyph('#fff')),
      React.createElement('div', { key: 2, className: 'ga-msg__b' }, [
        React.createElement('div', { className: 'ga-msg__who' }, 'Grove'),
        ...blocks,
      ]),
    ]);
  };

  const ProposalCard = (m: AgentMsg, i: number) => {
    const p = m.proposal;
    if (!p) return null;
    return React.createElement('div', { key: 'pc', className: 'ga-preview' }, [
      React.createElement('div', { key: 'h', className: 'ga-preview__h' }, [
        React.createElement('span', { key: 'b', className: 'badge' }, 'PROPOSED'),
        React.createElement('span', { key: 't' }, agentFmt(p.summary)),
      ]),
      React.createElement(
        'div',
        { key: 'f', className: 'ga-preview__files' },
        p.files.map((f, j) =>
          React.createElement('div', { key: j, className: 'ga-pf' }, [
            React.createElement('span', { key: 1, className: 'op ' + (f.op === 'add' ? 'add' : 'edit') }, f.op === 'add' ? '+' : '~'),
            f.path,
          ])
        )
      ),
      React.createElement(
        'div',
        { key: 'd', className: 'ga-diff' },
        p.diff.map((d, j) =>
          React.createElement('span', { key: j, className: 'ln ' + (d[0] === 'add' ? 'add' : d[0] === 'del' ? 'del' : 'ctx') }, d[1])
        )
      ),
      !m.applied
        ? React.createElement('div', { key: 'a', className: 'ga-preview__act' }, [
            React.createElement(
              'button',
              { key: 1, className: 'btn-primary ap', onClick: () => applyProposal(i) },
              [IC.check(), 'Apply']
            ),
            React.createElement(
              'button',
              { key: 2, className: 'btn-ghost', onClick: () => discardProposal(i) },
              'Discard'
            ),
          ])
        : null,
      m.applied
        ? React.createElement(
            'div',
            {
              key: 'ap',
              style: {
                padding: '10px 13px',
                borderTop: '1px solid var(--line)',
                fontSize: 12,
                color: 'var(--ink-3)',
                fontFamily: 'var(--mono)',
              },
            },
            '✓ applied'
          )
        : null,
    ]);
  };

  const AppliedCard = (m: AgentMsg) => {
    return React.createElement('div', { key: 'ac' }, [
      React.createElement('div', { key: 'a', className: 'ga-applied' }, [
        IC.check(),
        React.createElement('div', { key: 't', style: { flex: 1 } }, agentFmt(m.text || '')),
        React.createElement('button', { key: 'u', className: 'undo' }, [IC.undo(), 'Undo']),
      ]),
      m.gotoSlug
        ? React.createElement(
            'div',
            { key: 'g', style: { marginTop: 8 } },
            React.createElement(
              'button',
              {
                className: 'btn-ghost',
                onClick: () => {
                  go(m.gotoSlug || '');
                  closeAgent();
                },
              },
              [m.gotoLabel || 'Open', IC.arrow()]
            )
          )
        : null,
      m.note
        ? React.createElement('div', { key: 'n', className: 'ga-note' }, [
            IC.note(),
            React.createElement('span', { key: 't' }, [
              "Noted in this wiki's conventions — updated ",
              React.createElement('code', { key: 'c' }, 'GROVE.md'),
              '. ' + m.note[0],
            ]),
          ])
        : null,
    ]);
  };

  /* ───────── SEARCH PALETTE ───────── */
  const Search = () => {
    const q = searchQ.trim().toLowerCase();
    const entries = Object.values(wikiEntries).filter((e) => !e.slug.startsWith('view:'));
    const eHits = q
      ? entries.filter((e) =>
          (e.title + ' ' + e.slug + ' ' + e.tags.join(' ') + ' ' + (e.desc || ''))
            .toLowerCase()
            .includes(q)
        )
      : entries.slice(0, 5);

    const counts: Record<string, number> = {};
    entries.forEach((e) => e.tags.forEach((t) => (counts[t] = (counts[t] || 0) + 1)));
    const tHits = q ? Object.keys(counts).filter((t) => t.includes(q)) : [];
    
    const close = () => {
      setSearchOpen(false);
      setSearchQ('');
    };

    const rows: React.ReactNode[] = [];
    if (eHits.length) {
      rows.push(React.createElement('div', { key: 'ge', className: 'grove-search__grp' }, q ? 'Entries' : 'Recent'));
      eHits.slice(0, 7).forEach((e, i) =>
        rows.push(
          React.createElement(
            'div',
            {
              key: 'e' + i,
              className: 'grove-search__row',
              onClick: () => {
                go(e.slug);
                close();
              },
            },
            [
              IC.file(),
              React.createElement('span', { key: 't', className: 't' }, e.title.replace(/\.$/, '')),
              React.createElement('span', { key: 'c', className: 'c' }, e.slug),
            ]
          )
        )
      );
    }
    if (tHits.length) {
      rows.push(React.createElement('div', { key: 'gt', className: 'grove-search__grp' }, 'Tags'));
      tHits.slice(0, 5).forEach((t, i) =>
        rows.push(
          React.createElement(
            'div',
            {
              key: 't' + i,
              className: 'grove-search__row',
              onClick: () => {
                go('tag:' + t);
                close();
              },
            },
            [
              React.createElement(
                'span',
                {
                  key: 'h',
                  style: {
                    width: 15,
                    textAlign: 'center',
                    color: 'var(--ink-3)',
                    fontFamily: 'var(--mono)',
                  },
                },
                '#'
              ),
              React.createElement('span', { key: 't', className: 't' }, '#' + t),
              React.createElement('span', { key: 'c', className: 'c' }, counts[t] + ' entries'),
            ]
          )
        )
      );
    }

    return React.createElement(
      'div',
      {
        className: 'grove-search',
        onClick: (e) => {
          if ((e.target as HTMLElement).classList.contains('grove-search')) close();
        },
      },
      React.createElement('div', { className: 'grove-search__box' }, [
        React.createElement('div', { key: 'in', className: 'grove-search__in' }, [
          IC.search(),
          React.createElement('input', {
            key: 'i',
            autoFocus: true,
            placeholder: 'Search entries and tags…',
            value: searchQ,
            onChange: (e) => setSearchQ(e.target.value),
            onKeyDown: (e) => {
              if (e.key === 'Escape') close();
              if (e.key === 'Enter' && eHits[0]) {
                go(eHits[0].slug);
                close();
              }
            },
          }),
          React.createElement('kbd', { key: 'k' }, 'esc'),
        ]),
        eHits.length || tHits.length
          ? React.createElement('div', { key: 'r', className: 'grove-search__res' }, rows)
          : React.createElement('div', { key: 'e', className: 'grove-search__empty' }, [
              'No entry matches “',
              searchQ,
              '”.',
              writable
                ? React.createElement('div', { key: 'a', style: { marginTop: 14 } }, [
                    React.createElement(
                      'button',
                      {
                        className: 'btn-primary',
                        onClick: () => {
                          setSearchOpen(false);
                          setSearchQ('');
                          setAgentOpen(true);
                        },
                      },
                      [IC.spark(), 'Create it with Grove']
                    ),
                  ])
                : null,
            ]),
      ])
    );
  };

  /* ───────── EXTENSIBILITY VIEWS ───────── */
  const Timeline = () => {
    const items = Object.values(wikiEntries)
      .filter((e) => e.date && !e.slug.startsWith('view:') && !e.isView)
      .sort((a, b) => (a.date < b.date ? 1 : -1));

    return React.createElement('div', { key: 'tl', className: 'grove-page', 'data-layout': 'full' }, [
      React.createElement('header', { key: 'h', className: 'grove-entry-header' }, [
        React.createElement('div', { key: 'c', className: 'crumb' }, 'view · agent-added'),
        React.createElement('h1', { key: 't', className: 'grad' }, 'Timeline.'),
        React.createElement('div', { key: 'm', className: 'grove-meta' }, [
          'reads the ',
          React.createElement(
            'code',
            { key: 2, style: { fontFamily: 'var(--mono)', color: 'var(--accent-3)' } },
            'date'
          ),
          ' on ' + items.length + ' entries',
        ]),
      ]),
      React.createElement(
        'div',
        { key: 'ax', className: 'grove-timeline' },
        items.map((e, i) =>
          React.createElement(
            'div',
            {
              key: i,
              className: 'gtl-row',
              onClick: () => go(e.slug),
              style: { animationDelay: i * 60 + 'ms' },
            },
            [
              React.createElement('div', { key: 'd', className: 'gtl-date' }, e.date),
              React.createElement('div', { key: 'n', className: 'gtl-node' }),
              React.createElement('div', { key: 'c', className: 'gtl-card' }, [
                React.createElement('div', { key: 't', className: 'gtl-title' }, e.title),
                React.createElement('div', { key: 's', className: 'gtl-desc' }, e.desc),
                React.createElement(
                  'div',
                  { key: 'g', className: 'gtl-tags' },
                  e.tags.slice(0, 2).map((t, j) => React.createElement('span', { key: j, className: 'grove-tag' }, '#' + t))
                ),
              ]),
            ]
          )
        )
      ),
    ]);
  };

  const Graph = () => {
    const activePeople = PEOPLE.concat(
      agentMsgs.some((m) => m.applied && m.gotoSlug === 'directory' && m.proposal?.summary.includes('Jamie'))
        ? [
            {
              slug: 'people/jamie-rivera',
              name: 'Jamie Rivera',
              role: 'Support engineer',
              team: 'Engineering',
              phone: 'x2212',
              email: 'jamie@meridian.co',
            },
          ]
        : []
    );
    const teams = [...new Set(activePeople.map((p) => p.team))];
    const W = 640;
    const H = 380;
    const cx = W / 2;
    const cy = H / 2;
    const teamPos: Record<string, { x: number; y: number }> = {};
    teams.forEach((t, i) => {
      const a = (i / teams.length) * Math.PI * 2 - Math.PI / 2;
      teamPos[t] = { x: cx + Math.cos(a) * 150, y: cy + Math.sin(a) * 120 };
    });

    interface Node {
      id: string;
      x: number;
      y: number;
      team?: boolean;
      label: string;
      slug?: string;
    }

    const nodes: Node[] = [];
    const edges: [number, number, number, number][] = [];
    teams.forEach((t) => nodes.push({ id: t, x: teamPos[t].x, y: teamPos[t].y, team: true, label: t }));
    activePeople.forEach((p) => {
      const tp = teamPos[p.team];
      const sib = activePeople.filter((q) => q.team === p.team);
      const k = sib.findIndex((q) => q.slug === p.slug);
      const a = (k / Math.max(sib.length, 1)) * Math.PI * 2;
      const x = tp.x + Math.cos(a) * 64;
      const y = tp.y + Math.sin(a) * 52;
      nodes.push({ id: p.slug, x, y, label: p.name.split(' ')[0], slug: p.slug });
      edges.push([tp.x, tp.y, x, y]);
    });

    return React.createElement('div', { key: 'gr', className: 'grove-page', 'data-layout': 'full' }, [
      React.createElement('header', { key: 'h', className: 'grove-entry-header' }, [
        React.createElement('div', { key: 'c', className: 'crumb' }, 'view · agent-added'),
        React.createElement('h1', { key: 't', className: 'grad' }, 'Org graph.'),
        React.createElement('div', { key: 'm', className: 'grove-meta' }, 'reads the team field on each person entry'),
      ]),
      React.createElement(
        'div',
        { key: 'sv', className: 'grove-graph' },
        React.createElement(
          'svg',
          { viewBox: '0 0 ' + W + ' ' + H, style: { width: '100%', maxWidth: 680 } },
          [
            React.createElement(
              'g',
              { key: 'e', stroke: 'var(--line-2)', strokeWidth: 1.2 },
              edges.map((ed, i) =>
                React.createElement('line', { key: i, x1: ed[0], y1: ed[1], x2: ed[2], y2: ed[3] })
              )
            ),
            React.createElement(
              'g',
              { key: 'n' },
              nodes.map((nd, i) =>
                React.createElement(
                  'g',
                  {
                    key: i,
                    style: { cursor: nd.slug ? 'pointer' : 'default' },
                    onClick: nd.slug ? () => go(nd.slug || '') : undefined,
                  },
                  [
                    React.createElement('circle', {
                      key: 'c',
                      cx: nd.x,
                      cy: nd.y,
                      r: nd.team ? 13 : 7,
                      fill: nd.team ? 'url(#gg)' : 'var(--accent-violet)',
                      stroke: 'var(--bg)',
                      strokeWidth: 2,
                    }),
                    React.createElement(
                      'text',
                      {
                        key: 't',
                        x: nd.x,
                        y: nd.y + (nd.team ? 27 : 19),
                        textAnchor: 'middle',
                        fontSize: nd.team ? 12 : 10,
                        fontFamily: 'var(--mono)',
                        fill: nd.team ? 'var(--ink)' : 'var(--ink-2)',
                      },
                      nd.label
                    ),
                  ]
                )
              )
            ),
            React.createElement(
              'defs',
              { key: 'd' },
              React.createElement('linearGradient', { id: 'gg', x1: 0, y1: 0, x2: 1, y2: 1 }, [
                React.createElement('stop', { key: 1, offset: '0%', stopColor: 'var(--accent)' }),
                React.createElement('stop', { key: 2, offset: '100%', stopColor: 'var(--accent-2)' }),
              ])
            ),
          ]
        )
      ),
    ]);
  };

  const EmptyStub = (entry?: Entry) => {
    const e = entry || wikiEntries['home'];
    return React.createElement('div', { key: 'es', className: 'grove-page', 'data-layout': 'doc' }, [
      React.createElement('div', { className: 'gp-main' }, [
        React.createElement('header', { key: 'h', className: 'grove-entry-header' }, [
          e.crumb && e.crumb.length
            ? React.createElement('nav', { key: 'c', className: 'crumb' }, (e.crumb.concat([e.slug.split('/').pop() || ''])).join(' / '))
            : null,
          React.createElement('h1', { key: 't' }, e.title),
          React.createElement('div', { key: 'm', className: 'grove-meta' }, [
            React.createElement('span', { key: 1 }, 'draft'),
            React.createElement('span', { key: 2, className: 'dot' }, '·'),
            React.createElement('span', { key: 3 }, 'no body yet'),
          ]),
        ]),
        React.createElement(
          'div',
          {
            key: 'b',
            className: 'grove-state',
            style: { margin: '30px 0 0', textAlign: 'left', maxWidth: 540, padding: 0 },
          },
          [
            React.createElement('div', { key: 1, style: { width: 120, height: 84, opacity: 0.7, marginBottom: 18 } }, LatticeArt()),
            React.createElement('h2', { key: 2, style: { fontSize: 22 } }, 'This entry is a stub.'),
            React.createElement('p', { key: 3 }, 'It exists in the namespace but has no body. The fastest way to fill it in is to ask Grove.'),
            writable
              ? React.createElement(
                  'div',
                  { key: 4, className: 'grove-state__actions', style: { justifyContent: 'flex-start' } },
                  [
                    React.createElement('button', { key: 1, className: 'btn-primary', onClick: () => setAgentOpen(true) }, [IC.spark(), 'Draft it with Grove']),
                    React.createElement('button', { key: 2, className: 'btn-ghost', onClick: flashEdit }, [IC.pencil(), 'Edit the MDX']),
                  ]
                )
              : React.createElement('p', { key: 5, style: { color: 'var(--ink-3)', fontSize: 13 } }, 'Nothing to read here yet.'),
          ]
        ),
      ]),
    ]);
  };

  const MountError = () => {
    return React.createElement('div', { key: 'me', className: 'grove-state' }, [
      React.createElement('div', { key: 1, className: 'grove-state__art' }, LatticeArt()),
      React.createElement('h2', { key: 2 }, 'This space isn’t available.'),
      React.createElement('p', { key: 3 }, [
        'Grove couldn’t read the content space — it may not be shared with this app, or the grant was withdrawn. Reading resumes the moment access returns; nothing here is lost.',
      ]),
      React.createElement('div', { key: 4, className: 'grove-state__actions' }, [
        React.createElement('button', { key: 1, className: 'btn-ghost', onClick: () => setDataState('content') }, 'Retry'),
        React.createElement('button', { key: 2, className: 'btn-ghost' }, [IC.external(), 'Review access in the host']),
      ]),
      React.createElement(
        'p',
        { key: 5, style: { marginTop: 16, fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--ink-3)' } },
        'mount: read · forbidden'
      ),
    ]);
  };

  const MobileMenu = (entry?: Entry) => {
    const close = () => setMenuOpen(false);
    return React.createElement(
      'div',
      {
        className: 'grove-drawer',
        onClick: (e) => {
          if ((e.target as HTMLElement).classList.contains('grove-drawer')) close();
        },
      },
      React.createElement('div', { className: 'grove-drawer__panel' }, [
        React.createElement('div', { key: 'h', className: 'grove-drawer__h' }, [
          React.createElement('span', { key: 1, className: 'mk' }, groveGlyph('#fff')),
          React.createElement('span', { key: 2, className: 't' }, SITE.title),
          React.createElement('button', { key: 3, className: 'x', onClick: close }, IC.x()),
        ]),
        React.createElement(
          'div',
          { key: 'n', className: 'grove-drawer__nav' },
          navItems().map((n, i) =>
            React.createElement(
              'a',
              {
                key: i,
                'data-cur': route === n.slug ? '1' : '0',
                onClick: () => {
                  go(n.slug);
                  close();
                },
              },
              n.label
            )
          )
        ),
        React.createElement(
          'div',
          {
            key: 'tg',
            style: { display: 'flex', gap: 8, padding: '12px', borderBottom: '1px solid var(--line)' },
          },
          [
            theme === 'default'
              ? React.createElement(
                  'button',
                  {
                    key: 't',
                    className: 'btn-ghost',
                    style: { flex: 1, justifyContent: 'center' },
                    onClick: () => setLight(!light),
                  },
                  [light ? IC.moon() : IC.sun(), light ? 'Dark' : 'Light']
                )
              : null,
            React.createElement(
              'button',
              {
                key: 's',
                className: 'btn-ghost',
                style: { flex: 1, justifyContent: 'center' },
                onClick: () => {
                  close();
                  setSearchOpen(true);
                },
              },
              [IC.search(), 'Search']
            ),
          ]
        ),
        React.createElement('div', { key: 'sb' }, Sidebar(entry)),
      ])
    );
  };

  const Shell = () => {
    const entry = wikiEntries[route];
    let content;
    if (dataState === 'loading') content = Skeleton();
    else if (dataState === 'error') content = MountError();
    else if (dataState === 'empty') content = EmptyStub(entry);
    else if (route === 'view:timeline') content = Timeline();
    else if (route === 'view:graph') content = Graph();
    else if (route.startsWith('tag:')) content = TagPage(route.slice(4));
    else if (!entry || dataState === '404') content = NotFound(route);
    else content = EntryView(entry);

    return React.createElement(
      'div',
      {
        className: 'grove-shell',
        'data-nav': effNav(),
        ref: (el) => {
          rootRef.current = el;
        },
      },
      [
        TopNav(),
        nav === 'side' ? Sidebar(entry) : null,
        React.createElement('div', { key: 'ct', className: 'grove-content' }, content),
        Footer(),
      ]
    );
  };

  const Rail = () => {
    const segGroup = (label: string, opts: { v: any; l: string }[], val: any, on: (v: any) => void) =>
      React.createElement('div', { key: label, className: 'rail__sec' }, [
        React.createElement('h4', { key: 'h' }, label),
        React.createElement(
          'div',
          { key: 's', className: 'seg' },
          opts.map((o) =>
            React.createElement(
              'button',
              {
                key: String(o.v),
                'data-on': val === o.v ? '1' : '0',
                onClick: () => on(o.v),
              },
              o.l
            )
          )
        ),
      ]);

    return React.createElement('aside', { className: 'rail' }, [
      React.createElement('div', { key: 'b', className: 'rail__brand' }, [
        React.createElement('div', {
          key: 1,
          style: {
            width: 30,
            height: 30,
            borderRadius: '23%',
            background: 'linear-gradient(135deg,#f49ad4,#b285f2)',
            flex: '0 0 auto',
            position: 'relative',
          },
          children: groveGlyph('#fff'),
        }),
        React.createElement('div', { key: 2 }, [
          React.createElement('div', { key: 1, className: 'wm' }, 'grove'),
          React.createElement('div', { key: 2, className: 'sub' }, 'PROTOTYPE · immediately.run'),
        ]),
      ]),
      segGroup(
        'Theme · CSS-only re-skin',
        [
          { v: 'default', l: 'default' },
          { v: 'pixies', l: 'pixies' },
          { v: 'family', l: 'family' },
          { v: 'lotr', l: 'lotr' },
        ],
        theme,
        (v) => setTheme(v)
      ),
      theme === 'default'
        ? segGroup(
            'Mode',
            [
              { v: false, l: 'dark' },
              { v: true, l: 'light' },
            ],
            light,
            (v) => setLight(v)
          )
        : null,
      segGroup(
        'Viewport',
        [
          { v: 'mobile', l: 'mobile' },
          { v: 'desktop', l: 'desktop' },
        ],
        vw,
        (v) => setVw(v)
      ),
      segGroup(
        'Navigation · desktop',
        [
          { v: 'side', l: 'side' },
          { v: 'top', l: 'top' },
        ],
        nav,
        (v) => setNav(v)
      ),
      segGroup(
        'Writability',
        [
          { v: true, l: 'writable' },
          { v: false, l: 'read-only' },
        ],
        writable,
        (v) => {
          setWritable(v);
          setAgentOpen(false);
        }
      ),
      segGroup(
        'Agent · resting form',
        [
          { v: 'line', l: 'input line' },
          { v: 'tab', l: 'pull tab' },
          { v: 'icon', l: 'icon' },
          { v: 'band', l: 'live band' },
        ],
        agentRest,
        (v) => setAgentRest(v)
      ),
      segGroup(
        'Agent · backend',
        [
          { v: 'ok', l: 'key set' },
          { v: 'nokey', l: 'no key' },
          { v: 'forbidden', l: 'forbidden' },
        ],
        agentBackend,
        (v) => {
          setAgentBackend(v);
          if (v !== 'ok') {
            setAgentOpen(true);
          }
        }
      ),
      segGroup(
        'State',
        [
          { v: 'content', l: 'content' },
          { v: 'loading', l: 'loading' },
          { v: 'empty', l: 'stub' },
          { v: '404', l: '404' },
          { v: 'error', l: 'mount err' },
        ],
        dataState,
        (v) => {
          setDataState(v);
          if (v === '404') {
            setRoute('guides/missing');
          } else if (route === 'guides/missing') {
            setRoute('home');
          }
        }
      ),
      React.createElement(
        'div',
        { key: 'note', className: 'rail__note' },
        [
          'Grove’s promise — ',
          React.createElement(
            'b',
            { key: 1 },
            'CSS-only theming over stable .grove-* classes + tokens'
          ),
          '. Every control swaps a class or data-attribute. Same DOM, different skin.',
        ]
      ),
    ]);
  };

  const entry = wikiEntries[route];
  const layers: React.ReactElement[] = [
    React.createElement('div', { key: 'scroll', className: 'device__scroll' }, Shell()),
  ];

  const agent = AgentLayer();
  if (agent) layers.push(agent);

  if (menuOpen && vw === 'mobile') {
    layers.push(MobileMenu(entry));
  }

  if (searchOpen) {
    layers.push(Search());
  }

  const root = React.createElement(
    'div',
    {
      className: 'grove-root',
      'data-vw': vw,
      'data-nav': effNav(),
      'data-grove-theme': theme === 'default' ? undefined : theme,
      'data-theme': theme === 'default' && light ? 'light' : undefined,
    },
    layers
  );

  return React.createElement('div', { className: 'proto' }, [
    Rail(),
    React.createElement('main', { key: 'stage', className: 'stage' }, [
      React.createElement('div', { className: 'device', 'data-vw': vw }, root),
    ]),
  ]);
}
