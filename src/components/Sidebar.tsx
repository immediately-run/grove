/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useContext, useMemo, useState } from 'react';
import { Link, useMetadataQuery } from '@immediately-run/sdk';
import { TinkerableContext } from '@immediately-run/sdk/TinkerableContext';
import { CONTENT_DIR, keyToHref, sandboxPathToKey } from '../lib/content';
import Icon from './Icon';

const SEP = '\t';

interface TreeNode {
  name: string;
  key?: string; // leaf entry key
  title?: string;
  children: Record<string, TreeNode>;
}

function insert(root: TreeNode, key: string, title: string) {
  const rel = key.replace(CONTENT_DIR, '').replace(/\.mdx?$/, '');
  const parts = rel.split('/');
  let node = root;
  parts.forEach((part, i) => {
    const leaf = i === parts.length - 1;
    node.children[part] = node.children[part] || { name: part, children: {} };
    node = node.children[part];
    if (leaf) {
      node.key = key;
      node.title = title;
    }
  });
}

function hasDescendant(node: TreeNode, key: string): boolean {
  return Object.values(node.children).some((c) => c.key === key || hasDescendant(c, key));
}

// A folder (has children) or a leaf entry. Folders are collapsible; the branch
// holding the current entry starts open.
function Branch({ node, currentKey, depth }: { node: TreeNode; currentKey: string; depth: number }) {
  const childKeys = Object.keys(node.children).sort();
  const isFolder = childKeys.length > 0;
  const containsCurrent = !!currentKey && (node.key === currentKey || hasDescendant(node, currentKey));
  const [open, setOpen] = useState(depth < 1 || containsCurrent);

  if (!isFolder) {
    return (
      <Link href={keyToHref(node.key!)} className="gs-tree__row" data-cur={node.key === currentKey ? '1' : '0'}>
        <Icon name="file" />
        {(node.title || node.name).replace(/\.$/, '')}
      </Link>
    );
  }

  return (
    <div>
      <div className="gs-tree__row gs-folder" data-open={open ? '1' : '0'} onClick={() => setOpen((o) => !o)}>
        <Icon name="chevron-down" className="chev" />
        {node.name}
        <span className="ct">{childKeys.length}</span>
      </div>
      {open ? (
        <div className="gs-tree__children">
          {childKeys.map((k) => (
            <Branch key={k} node={node.children[k]} currentKey={currentKey} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

// `.grove-sidebar` — the wiki shell's left rail: a namespace tree + author-defined
// `ui/sidebar` sections (a header + a link into the tagged entry).
export default function Sidebar() {
  const ctx = useContext(TinkerableContext) as any;
  const currentKey = sandboxPathToKey(ctx?.navigationState?.sandboxPath || '/');

  const queryFn = useCallback(
    (fm: Record<string, any>) =>
      Object.keys(fm)
        .filter((p) => p.startsWith(CONTENT_DIR) && /\.mdx?$/.test(p))
        .map((p) => [p, fm[p]?.title || '', (fm[p]?.tags || []).join(','), fm[p]?.nav || ''].join(SEP)),
    []
  );
  const q = useMetadataQuery(queryFn);
  const rows: string[] = q && 'result' in q ? (q as any).result : [];

  const rowsKey = rows.join('|');
  const { tree, sections } = useMemo(() => {
    const root: TreeNode = { name: '', children: {} };
    const secs: { key: string; label: string }[] = [];
    rows.forEach((r) => {
      const [key, title, tags, nav] = r.split(SEP);
      insert(root, key, title);
      if ((tags || '').split(',').includes('ui/sidebar')) secs.push({ key, label: nav || title || key });
    });
    return { tree: root, sections: secs };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsKey]);

  const topKeys = Object.keys(tree.children).sort();

  return (
    <aside className="grove-sidebar">
      <div className="gs-block">
        <div className="gs-block__h">Browse</div>
        <div className="gs-tree">
          {topKeys.map((k) => (
            <Branch key={k} node={tree.children[k]} currentKey={currentKey} depth={0} />
          ))}
        </div>
      </div>
      {sections.map((s) => (
        <div className="gs-block" key={s.key}>
          <div className="gs-block__h">{s.label.replace(/\.$/, '')}</div>
          <div className="gs-section__body">
            <Link href={keyToHref(s.key)} className="grove-wikilink" data-state="ok">
              Open
            </Link>
          </div>
        </div>
      ))}
    </aside>
  );
}
