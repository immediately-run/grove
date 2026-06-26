/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import { chat, requestEdit, useChatProvider } from '@immediately-run/sdk';
import { keyToRepoRel } from '../lib/content';
import Icon from './Icon';

interface Msg {
  role: 'user' | 'assistant';
  text: string;
}

type Banner = null | 'no-key' | 'forbidden' | 'read-only' | 'error';

const CHIPS = [
  'Add an entry…',
  'Fix broken links here',
  'Summarize this entry',
  'Reorganize the sidebar',
  'Add a timeline view',
];

// `.grove-agent` (brief 06) — Grove's own, always-present, capability-scoped agent.
// Resting state: the thin "Ask Grove…" input line pinned to the bottom (approach 1,
// the recommended posture — content stays fully visible until invoked). Expands into
// a bottom dock (desktop) / sheet (mobile). Rides the host `llm.chat@1` slot via the
// SDK `chat()` stream; degrades to the SP-7 connect-a-key / forbidden / read-only
// banners rather than faking a host surface.
export default function GroveAgent({ writable, entryKey, entryTitle }: { writable: boolean; entryKey: string; entryTitle: string }) {
  const provider = useChatProvider();
  const [open, setOpen] = useState(false);
  const [detent, setDetent] = useState<'half' | 'full'>('half');
  const [resting, setResting] = useState('');
  const [draft, setDraft] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [sendBanner, setSendBanner] = useState<Banner>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const footRef = useRef<HTMLInputElement>(null);

  // Derived banner: read-only (no write grant) / no-key (no provider bound, SP-7)
  // come straight from props+provider; send-time errors layer on top.
  const staticBanner: Banner = !writable ? 'read-only' : provider === null ? 'no-key' : null;
  const banner: Banner = sendBanner || staticBanner;

  useEffect(() => {
    if (open) requestAnimationFrame(() => footRef.current?.focus());
  }, [open]);
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [msgs, streaming]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || streaming) return;
    setOpen(true);
    setDraft('');
    setResting('');
    const history = [...msgs, { role: 'user' as const, text: q }];
    setMsgs([...history, { role: 'assistant', text: '' }]);
    setStreaming(true);
    setSendBanner(null);

    try {
      const req = {
        messages: [
          {
            role: 'system' as const,
            content: [
              {
                type: 'text' as const,
                text: `You are Grove, the embedded agent for this MDX wiki. Entries live as .mdx files under /content and interlink with markdown links and frontmatter tags. The reader is currently on "${entryTitle}". Be concise and wiki-fluent; when you propose changes, describe them plainly. You never see secrets and privileged writes are confirmed by the host.`,
              },
            ],
          },
          ...history.map((m) => ({
            role: m.role,
            content: [{ type: 'text' as const, text: m.text }],
          })),
        ],
        modelHint: 'smart' as const,
      };
      let acc = '';
      for await (const d of chat(req)) {
        if (d.type === 'text-delta') {
          acc += d.text;
          setMsgs((prev) => {
            const next = prev.slice();
            next[next.length - 1] = { role: 'assistant', text: acc };
            return next;
          });
        }
      }
      if (!acc) throw new Error('empty');
    } catch (e: any) {
      const code = e?.code || e?.message;
      setSendBanner(code === 'auth-required' ? 'no-key' : code === 'forbidden' ? 'forbidden' : 'error');
      // Drop the empty assistant placeholder.
      setMsgs((prev) => (prev.length && prev[prev.length - 1].text === '' ? prev.slice(0, -1) : prev));
    } finally {
      setStreaming(false);
    }
  }

  const restingDisabled = banner === 'read-only';

  return (
    <div className="grove-agent">
      {/* Resting: the always-present thin input line (approach 1). */}
      {!open && (
        <form
          className="ga-line"
          onSubmit={(e) => {
            e.preventDefault();
            if (restingDisabled) setOpen(true);
            else send(resting);
          }}
        >
          <span className="mk" />
          <input
            value={resting}
            placeholder={restingDisabled ? 'Ask Grove about this wiki…' : `Ask Grove to change "${entryTitle}"…`}
            onChange={(e) => setResting(e.target.value)}
            onFocus={() => setOpen(true)}
            aria-label="Ask Grove"
          />
          <button className="go" type="submit" aria-label="Ask Grove">
            <Icon name="send" />
          </button>
        </form>
      )}

      {/* Expanded: dock (desktop) / sheet (mobile). */}
      {open && (
        <>
          <div className="ga-scrim" onClick={() => setOpen(false)} />
          <div className="ga-panel" data-detent={detent}>
            <div className="ga-panel-inner">
              <div className="ga-head">
                <span className="grip" onClick={() => setDetent((d) => (d === 'half' ? 'full' : 'half'))} />
                <span className="mk" />
                <span className="id">Grove</span>
                <span className="scope">
                  <Icon name="shield" />
                  scoped to this wiki
                </span>
                <span className="grow">
                  <button className="ic" aria-label={detent === 'half' ? 'Expand' : 'Collapse'} onClick={() => setDetent((d) => (d === 'half' ? 'full' : 'half'))}>
                    <Icon name={detent === 'half' ? 'chevron-down' : 'chevron-right'} />
                  </button>
                  <button className="ic" aria-label="Close" onClick={() => setOpen(false)}>
                    <Icon name="x" />
                  </button>
                </span>
              </div>

              {banner && <AgentBanner banner={banner} />}

              <div className="ga-body" ref={bodyRef}>
                {msgs.length === 0 ? (
                  <>
                    <div className="ga-explain">
                      <b>Grove's agent</b> knows this wiki's entries, tags, and components. Ask it to add or
                      change content in plain language — it proposes the edit, and the host confirms the write.
                    </div>
                    {!restingDisabled && (
                      <div className="ga-chips">
                        {CHIPS.map((c) => (
                          <button key={c} className="ga-chip" onClick={() => send(c)}>
                            {c}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  msgs.map((m, i) => (
                    <div key={i} className={`ga-msg ${m.role}`}>
                      <span className={`ga-msg__av ${m.role === 'assistant' ? 'grove' : 'user'}`}>
                        {m.role === 'user' ? 'you' : ''}
                      </span>
                      <div className="ga-msg__b">
                        <div className="ga-msg__who">{m.role === 'assistant' ? 'Grove' : 'You'}</div>
                        <div className="ga-msg__txt">
                          {m.text}
                          {streaming && i === msgs.length - 1 && m.role === 'assistant' ? <span className="ga-cursor" /> : null}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="ga-foot">
                <form
                  className="ga-foot__row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    send(draft);
                  }}
                >
                  <input
                    ref={footRef}
                    value={draft}
                    placeholder="Ask Grove…"
                    disabled={streaming || restingDisabled}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <button className="go" type="submit" disabled={streaming || restingDisabled || !draft.trim()} aria-label="Send">
                    <Icon name={streaming ? 'stop' : 'send'} />
                  </button>
                </form>
                <div className="ga-foot__hand">
                  <span>Grove's own agent · scoped to your grants</span>
                  <a
                    onClick={() => requestEdit({ path: keyToRepoRel(entryKey) }).catch(() => undefined)}
                    role="button"
                    tabIndex={0}
                  >
                    <Icon name="external" />
                    Open in the workbench
                  </a>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// The no-key / forbidden / read-only / error states — calm explanations that hand
// to the host secret flow rather than faking a key prompt.
function AgentBanner({ banner }: { banner: Banner }) {
  const copy: Record<string, { t: string; d: React.ReactNode }> = {
    'no-key': {
      t: 'Connect a key to use the agent.',
      d: 'Grove rides whichever model provider you connect in the host. Add a key to start asking.',
    },
    forbidden: {
      t: 'The agent isn’t available here.',
      d: "This Grove wasn't granted the chat capability. Reading still works as normal.",
    },
    'read-only': {
      t: 'You’re viewing read-only.',
      d: 'The agent can explain this wiki, but changes need write access to this space.',
    },
    error: {
      t: 'The agent hit a snag.',
      d: 'The model or backend errored. Try again in a moment.',
    },
  };
  const c = copy[banner as string];
  if (!c) return null;
  return (
    <div className="ga-banner">
      <Icon name="alert" />
      <div>
        <div className="ga-banner__t">{c.t}</div>
        <div className="ga-banner__d">{c.d}</div>
      </div>
    </div>
  );
}
