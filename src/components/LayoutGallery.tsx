import { manifestLayouts, manifestPageVariants, manifestCollections } from '../data/catalogue';

// The layouts gallery (R3-311): the twelve shapes, grouped by the three buckets
// the catalogue exists as three of — because the MECHANISM differs per bucket (a
// copyable starter file · a frontmatter key · a component call), and one flat
// list would promise what a starter cannot deliver. Enumerated from
// viewer.manifest.json: adding a shape adds a row with no edit to the entry.

function Section({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <section className="gg-section">
      <h3>{title}</h3>
      <p className="gg-note">{note}</p>
      {children}
    </section>
  );
}

export default function LayoutGallery() {
  return (
    <div className="gg-gallery">
      <Section title="Layout starters" note="An `_layout.mdx` file a contributor copies — chrome is content.">
        {manifestLayouts().map(([id, l]) => (
          <div className="gg-row" role="listitem" key={id} data-gallery-id={id}>
            <div className="gg-body">
              <div className="gg-title">
                <code>{id}</code>
                <span className="gg-meta">{l.arranges}</span>
              </div>
              <div className="gg-summary">{l.summary}</div>
            </div>
          </div>
        ))}
      </Section>
      <Section title="Page variants" note="A frontmatter key on one entry — the page, not the chrome.">
        {manifestPageVariants().map(([id, v]) => (
          <div className="gg-row" role="listitem" key={id} data-gallery-id={id}>
            <div className="gg-body">
              <div className="gg-title">
                <code>
                  {v.key}: {v.value}
                </code>
                <span className="gg-meta">{id}</span>
              </div>
              <div className="gg-summary">{v.summary}</div>
            </div>
          </div>
        ))}
      </Section>
      <Section title="Collection shapes" note="What a list of entries looks like — a component call.">
        {manifestCollections().map(([id, c]) => (
          <div className="gg-row" role="listitem" key={id} data-gallery-id={id}>
            <div className="gg-body">
              <div className="gg-title">
                <code>{id}</code>
                {c.component && <span className="gg-meta">&lt;{c.component}&gt;</span>}
              </div>
              <div className="gg-summary">{c.summary}</div>
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
}
