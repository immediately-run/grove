import type { ReactNode } from 'react';
import Icon from './Icon';

interface Props {
  variant?: 'tip' | 'note' | 'warning';
  type?: 'tip' | 'note' | 'warning';
  title?: string;
  children?: ReactNode;
}

const ICON: Record<string, string> = { tip: 'sparkles', note: 'message', warning: 'alert' };

// Import-free engine component: an Obsidian-style callout panel with an accent
// spine + a Lucide cue (tip / note / warning).
export default function Callout({ variant, type, title, children }: Props) {
  const v = variant || type || 'note';
  return (
    <div className="grove-callout" data-v={v}>
      <Icon name={ICON[v] || 'message'} />
      <div>
        {title ? <div className="grove-callout__t">{title}</div> : null}
        <div className="grove-callout__b">{children}</div>
      </div>
    </div>
  );
}
