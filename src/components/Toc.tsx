import { useEffect, useState } from 'react';
import { headingId } from '../lib/wiki';

interface Head {
  id: string;
  text: string;
  level: number;
}

// `<Toc/>` — the on-this-page rail. Reads the rendered prose headings from the DOM
// (the entry is rendered via <Include>, so there's no source to parse), assigns
// stable ids, and scroll-spies the current section. A MutationObserver re-scans
// when the prose swaps on navigation, so the rail never shows a stale entry's
// headings. Renders nothing when an entry has no sub-headings.
export default function Toc({ entryKey }: { entryKey?: string }) {
  const [heads, setHeads] = useState<Head[]>([]);
  const [cur, setCur] = useState<string>('');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHeads([]);
    const scan = () => {
      const prose = document.querySelector('.grove-prose');
      const nodes = prose ? Array.from(prose.querySelectorAll('h2, h3')) : [];
      const found: Head[] = nodes.map((n) => {
        const text = n.textContent || '';
        const id = n.id || headingId(text);
        n.id = id;
        return { id, text, level: n.tagName === 'H3' ? 3 : 2 };
      });
      setHeads((prev) =>
        prev.length === found.length && prev.every((h, i) => h.id === found[i].id) ? prev : found
      );
    };
    scan();
    // Re-scan as the prose mounts/swaps (Include resolves async on navigation).
    const prose = document.querySelector('.grove-prose');
    const obs = prose ? new MutationObserver(scan) : null;
    if (prose && obs) obs.observe(prose, { childList: true, subtree: true });
    const timers = [120, 300, 600].map((d) => setTimeout(scan, d));
    return () => {
      obs?.disconnect();
      timers.forEach(clearTimeout);
    };
  }, [entryKey]);

  useEffect(() => {
    if (!heads.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length) setCur((visible[0].target as HTMLElement).id);
      },
      { rootMargin: '-64px 0px -70% 0px', threshold: 0 }
    );
    heads.forEach((h) => {
      const el = document.getElementById(h.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [heads]);

  if (!heads.length) return null;

  return (
    <nav className="grove-toc" aria-label="On this page">
      <div className="grove-toc__h">On this page</div>
      {heads.map((h) => (
        <a
          key={h.id}
          href={`#${h.id}`}
          data-cur={cur === h.id ? '1' : '0'}
          className={h.level === 3 ? 'lvl3' : undefined}
          onClick={(e) => {
            e.preventDefault();
            document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        >
          {h.text}
        </a>
      ))}
    </nav>
  );
}
