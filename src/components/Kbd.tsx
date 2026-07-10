import type { ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

// Import-free engine component: a keyboard key cap, e.g. <Kbd>⌘K</Kbd>.
export default function Kbd({ children }: Props) {
  return <kbd className="grove-kbd">{children}</kbd>;
}
