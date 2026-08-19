// A shell's replacement for a manifest component. Same props contract the manifest
// declares for `Callout` (`kind?`, `title?`, `children?`) — the manifest is where a shell
// author reads that from, which is the point of putting props in it.

import type { ReactNode } from 'react';

export default function ShellCallout({
  kind = 'note',
  title,
  children,
}: {
  kind?: string;
  title?: string;
  children?: ReactNode;
}) {
  return (
    <aside className="shell-callout" data-kind={kind}>
      {title ? <p className="shell-callout__title">{title}</p> : null}
      {children}
    </aside>
  );
}
