import { useEffect, useState } from 'react';
import { headingId } from '../lib/wiki';

interface Head {
  id: string;
  text: string;
  level: number;
}

// `<Toc/>` — the on-this-page rail. Reads the rendered prose headings from the DOM
// (the entry is rendered via <Include>, so there's no source to parse), assigns
// stable ids, and scroll-spies the current section. Renders nothing when an entry
// has no sub-headings, so the rail/disclosure can collapse cleanly.
export default function Toc({ entryKey }: { entryKey?: string }) {
  const [heads, setHeads] = useState<Head[]>([]);
  const [cur, setCur] = useState<string>('');

  useEffect(() => {
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const scan = () => {
      const prose = document.querySelector('.grove-prose');
      const nodes = prose ? Array.from(prose.querySelectorAll('h2, h3')) : [];
      if (!nodes.length && tries++ < 8) {
        timer = setTimeout(scan, 120);
        return;
      }
      const found: Head[] = nodes.map((n) => {
        const text = n.textContent || '';
        const id = n.id || headingId(text);
        n.id = id;
        return { id, text, level: n.tagName === 'H3' ? 3 : 2 };
      });
      setHeads(found);
    };
    scan();
    return () => clearTimeout(timer);
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
