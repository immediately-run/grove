import type { ReactNode } from 'react';
import WikiLink from './WikiLink';

interface Props {
  /** Attribution — a person, role, or document. Rendered in mono as "— cite". */
  cite?: string;
  /** Wiki path of the entry the quote is drawn from, e.g.
   *  "content/handbook/onboarding.mdx". When set, a "Source →" link is shown. */
  source?: string;
  children?: ReactNode;
}

// Import-free engine component: a pull-quote with a gradient accent spine and a
// large gradient opening quote mark. `cite` is the attribution (Space Mono);
// `source`, when given, links to the entry the quote came from — its
// resolved / broken / self state is decided by the shared <WikiLink> resolver, so
// a moved or missing target reads as broken rather than a dead link (no
// hand-rolled href logic here, just the wiki path → in-app href normalization).
export default function Quote({ cite, source, children }: Props) {
  const href = source ? (source.startsWith('/') ? source : `/${source}`) : null;
  return (
    <figure className="grove-quote">
      <blockquote className="grove-quote__body">{children}</blockquote>
      {(cite || href) && (
        <figcaption className="grove-quote__cap">
          {cite ? <span className="grove-quote__cite">{cite}</span> : null}
          {href ? (
            <WikiLink href={href} className="grove-quote__src">
              Source →
            </WikiLink>
          ) : null}
        </figcaption>
      )}
    </figure>
  );
}
