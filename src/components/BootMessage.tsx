import type { ReactNode } from 'react';

/** The single line Grove shows while it cannot paint an entry yet — booting, listing the
 *  bundle, or waiting on the files an entry needs — and, given a message, when boot fails. */
export default function BootMessage({ children = 'Opening…' }: { children?: ReactNode }) {
  return (
    <div className="grove-boot">
      <p className="grove-boot__msg">{children}</p>
    </div>
  );
}
