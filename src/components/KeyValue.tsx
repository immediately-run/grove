import type { ReactNode } from 'react';

interface Pair {
  /** Label — rendered in Space Mono, uppercased. */
  label: string;
  /** Value — a plain string or arbitrary ReactNode (links, code, etc.). */
  value: ReactNode;
}

interface Props {
  /** Label/value pairs, rendered top-to-bottom as <dt>/<dd> rows. */
  pairs: Pair[];
}

// Import-free engine component: a compact definition list of label/value pairs
// (contact details, metadata, quick facts). `label` is set in Space Mono and
// uppercased; `value` may be a string or any ReactNode, so links and inline
// code compose naturally. Rendered as a <dl> of <dt>/<dd> pairs with hairline
// row separators and a panel background, using the same design tokens as the
// rest of the component vocabulary.
export default function KeyValue({ pairs }: Props) {
  return (
    <dl className="grove-keyvalue">
      {pairs.map((p, i) => (
        <div className="grove-keyvalue__row" key={i}>
          <dt className="grove-keyvalue__label">{p.label}</dt>
          <dd className="grove-keyvalue__value">{p.value}</dd>
        </div>
      ))}
    </dl>
  );
}
