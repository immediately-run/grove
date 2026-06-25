import type { ReactNode } from 'react';

interface Props {
  title?: string;
  cover?: boolean;
  children?: ReactNode;
}

// Import-free engine component: a sidebar fact panel. Authors put a markdown
// list of `- Key: value` lines inside; it renders as the panel body.
export default function Infobox({ title, cover, children }: Props) {
  return (
    <aside className="grove-infobox">
      {title ? <div className="grove-infobox__h">{title}</div> : null}
      {cover ? <div className="grove-infobox__cover" /> : null}
      <div className="grove-infobox__body">{children}</div>
    </aside>
  );
}
