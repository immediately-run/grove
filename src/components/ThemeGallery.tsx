import { manifestThemes } from '../data/catalogue';
import { THEMES } from '../data/themes';

// The themes gallery (R3-311): one row per SHIPPED theme, enumerated from
// viewer.manifest.json — adding a theme to the manifest adds a row here with no
// edit to the entry. The swatch is the live gradient each catalogue entry
// declares (data/themes.ts), rendered with the theme's OWN tokens applied to the
// swatch chip, so the comparison is the real thing, not a screenshot of it.

export default function ThemeGallery() {
  const rows = manifestThemes();
  return (
    <div className="gg-gallery" role="list" aria-label="The shipped themes">
      {rows.map(([id, t]) => {
        const swatch = THEMES.find((x) => x.id === id)?.swatch ?? 'linear-gradient(96deg,#888,#555)';
        return (
          <div className="gg-row" role="listitem" key={id} data-gallery-id={id}>
            <span className="gg-swatch" style={{ background: swatch }} aria-hidden />
            <div className="gg-body">
              <div className="gg-title">
                <code>{id}</code> — {t.label}
                <span className="gg-meta">opens {t.preferred}</span>
              </div>
              <div className="gg-summary">{t.summary}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
