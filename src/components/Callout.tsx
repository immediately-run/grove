import type { ReactNode } from 'react';

interface Props {
  variant?: 'tip' | 'note' | 'warning';
  type?: 'tip' | 'note' | 'warning';
  title?: string;
  children?: ReactNode;
}

// Import-free engine component: a high-contrast info/warning box.
export default function Callout({ variant, type, title, children }: Props) {
  const v = variant || type || 'note';
  return (
    <div className="grove-callout" data-v={v}>
      <div>
        {title ? <div className="grove-callout__t">{title}</div> : null}
        <div className="grove-callout__b">{children}</div>
      </div>
    </div>
  );
}
