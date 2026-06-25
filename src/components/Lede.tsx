import type { ReactNode } from 'react';

// Import-free engine component: the oversized opening paragraph of an entry.
export default function Lede({ children }: { children?: ReactNode }) {
  return <p className="grove-lede">{children}</p>;
}
