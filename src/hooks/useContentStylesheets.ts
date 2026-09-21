// The stylesheets a corpus declares on its home entry, read (MDX_FROM_MOUNT_SPEC D7).
//
// `loading` is DERIVED in render — the loaded set is compared with the declared one — not
// set by an effect, so the render in which a declaration first appears (home was just read)
// already reports `loading`. The entry gate reads it; a render that saw `ready` there would
// paint the entry once unstyled.
import { useEffect, useState } from 'react';
import { declaredStylesheets, sheetFromSource, type ContentStylesheet } from '../lib/contentStylesheet';
import { safeSources } from '../lib/safeSources';

export interface ContentStylesheets {
  status: 'loading' | 'ready';
  sheets: ContentStylesheet[];
  /** Reader-facing lines: a declaration that names no entry, or a sheet that did not read. */
  errors: string[];
}

interface Loaded {
  sig: string;
  sheets: ContentStylesheet[];
  errors: string[];
}

const NONE: Loaded = { sig: '', sheets: [], errors: [] };

export function useContentStylesheets(declared: unknown, homeKey: string): ContentStylesheets {
  const { keys, errors: declarationErrors } = declaredStylesheets(declared, homeKey);
  const sig = keys.join('|');
  const [loaded, setLoaded] = useState<Loaded>(NONE);

  useEffect(() => {
    if (!sig) return;
    let alive = true;
    const paths = sig.split('|');
    // `allSettled` never rejects, so this chain has no rejection to lose.
    void Promise.allSettled(paths.map((p) => safeSources.read(p))).then((results) => {
      if (!alive) return;
      const sheets: ContentStylesheet[] = [];
      const errors: string[] = [];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') sheets.push(sheetFromSource(paths[i], r.value));
        else errors.push(`${paths[i]} — could not be read (${r.reason instanceof Error ? r.reason.message : String(r.reason)})`);
      });
      setLoaded({ sig, sheets, errors });
    });
    return () => {
      alive = false;
    };
  }, [sig]);

  if (!sig) return { status: 'ready', sheets: [], errors: declarationErrors };
  if (loaded.sig !== sig) return { status: 'loading', sheets: [], errors: declarationErrors };
  return { status: 'ready', sheets: loaded.sheets, errors: [...declarationErrors, ...loaded.errors] };
}
