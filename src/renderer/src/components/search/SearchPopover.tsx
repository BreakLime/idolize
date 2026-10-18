// Header search field + popover: recent searches when empty, live (debounced) query suggestions and
// direct hits while typing. Enter opens the results page, Escape clears/closes, ↑/↓ move through rows.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import type { MediaItem } from '@/api/models';
import { ExplicitBadge } from '@/components/Badges';
import { Icon } from '@/components/Icon';
import { HistoryIcon, SmallClose, TrashIcon } from '@/components/icons/artistSearch';
import { openItemMenu } from '@/components/MediaCard';
import { onCommand } from '@/lib/commands';
import { CoverImage, ItemArtists, isExplicit, itemTitle, kindLabel, ListItem, playFromSearch, searchPath } from './ListItem';
import { recent, useRecent } from './recent';
import { prefixHighlights, splitHighlights, type QuerySuggestion } from './highlight';
import { suggestions, type Suggestions } from './searchApi';
import s from './SearchPopover.module.css';

const DEBOUNCE_MS = 250;
const slug = (q: string) => q.trim().toLowerCase().replace(/\s+/g, '-');
const itemId = (i: MediaItem) => (i.kind === 'playlist' ? i.uuid : String(i.id));

/** Debounced suggestions for the typed text; stale responses are dropped. */
function useSuggestions(text: string, enabled: boolean) {
  const [data, setData] = useState<{ q: string; res: Suggestions } | null>(null);
  useEffect(() => {
    const q = text.trim();
    if (!enabled || !q) return;
    let live = true;
    const t = setTimeout(() => {
      suggestions(q)
        .then((res) => live && setData({ q, res }))
        .catch(() => live && setData({ q, res: { history: [], suggestions: [], directHits: [] } }));
    }, DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [text, enabled]);
  return data;
}

function Highlighted({ s: sug }: { s: QuerySuggestion }) {
  return (
    <>
      {splitHighlights(sug.query, sug.highlights).map((p, i) =>
        p.hl ? (
          <span key={i} className={s.highlight}>
            {p.text}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

function DirectHit({ item, onOpen, onPlay }: { item: MediaItem; onOpen: (i: MediaItem) => void; onPlay: (i: MediaItem) => void }) {
  const path = searchPath(item);
  const title = itemTitle(item);
  const round = item.kind === 'artist';
  const testBase = `${item.kind}-direct-hit-${itemId(item)}`;
  const label = kindLabel(item);
  return (
    <div
      className={`${s.row} ${s.directHit}`}
      data-test={testBase}
      tabIndex={-1}
      data-nav-row=""
      onClick={() => onOpen(item)}
      onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && onOpen(item)}
      onContextMenu={(e) => openItemMenu(e, item)}
    >
      <button
        type="button"
        className={`${s.hitImage} ${round ? s.hitRound : ''}`}
        data-test={`${testBase}--play-button`}
        aria-label="Play"
        tabIndex={-1}
        onClick={(e) => {
          e.stopPropagation();
          onPlay(item);
        }}
      >
        <CoverImage item={item} round={round} px={48} />
        <Icon name="play" size={16} className={s.hitPlay} />
      </button>
      <div className={`${s.sub} ${round ? s.subArtist : ''}`}>
        <span className={s.textContainer}>
          <span className={s.hitTitleRow}>
            <span className={`${s.hitTitle} ellipsis`}>
              {path ? (
                <Link
                  to={path}
                  tabIndex={-1}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpen(item);
                  }}
                >
                  {title}
                </Link>
              ) : (
                <span>{title}</span>
              )}
            </span>
            {isExplicit(item) && <ExplicitBadge />}
          </span>
          {!round && (
            <span className={`${s.hitArtists} ellipsis`}>
              <span className={s.hitKind}>{label} · </span>
              <ItemArtists item={item} onNavigate={() => onOpen(item)} />
            </span>
          )}
        </span>
        <button
          type="button"
          className={s.hitMenu}
          data-test={`${testBase}--context-menu-button`}
          aria-label="Show options"
          title="Show options"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            openItemMenu(e.currentTarget, item);
          }}
        >
          <Icon name="more" size={24} />
        </button>
      </div>
    </div>
  );
}

export function SearchPopover() {
  const nav = useNavigate();
  const loc = useLocation();
  const [params] = useSearchParams();
  const urlQuery = loc.pathname.startsWith('/search') ? (params.get('q') ?? '') : '';
  const [text, setText] = useState(urlQuery);
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const items = useRecent((st) => st.items);
  const queries = useRecent((st) => st.queries);
  const typed = text.trim();
  const sugg = useSuggestions(text, open);

  useEffect(() => setText(urlQuery), [urlQuery]);
  // any navigation closes the popover
  useEffect(() => setOpen(false), [loc.key]);
  useEffect(
    () =>
      onCommand('navigate:search', () => {
        input.current?.focus();
        input.current?.select();
      }),
    [],
  );

  const close = useCallback(() => {
    setOpen(false);
    input.current?.blur();
  }, []);

  const submit = (q: string) => {
    const t = q.trim();
    if (!t) return;
    recent.addQuery(t);
    setText(t);
    close();
    nav(`/search?q=${encodeURIComponent(t)}`);
  };
  const openItem = (i: MediaItem) => {
    recent.addItem(i);
    close();
    const p = searchPath(i);
    if (p) nav(p);
    else void playFromSearch(i, typed);
  };
  const playHit = (i: MediaItem) => {
    recent.addItem(i);
    void playFromSearch(i, typed);
  };

  // rows for keyboard navigation (buttons / direct hits in DOM order)
  const rows = () => Array.from(panel.current?.querySelectorAll<HTMLElement>('[data-nav-row]') ?? []);
  const move = (dir: 1 | -1) => {
    const list = rows();
    if (!list.length) return;
    const i = list.indexOf(document.activeElement as HTMLElement);
    const next = i + dir;
    if (next < 0) input.current?.focus();
    else list[Math.min(next, list.length - 1)]?.focus();
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      move(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      move(-1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (document.activeElement !== input.current) input.current?.focus();
      else if (text) setText('');
      else close();
    }
  };

  // matching local history + API history, de-duplicated against suggestions
  const showSuggestions = open && !!typed && sugg?.q === typed;
  const history: QuerySuggestion[] = [];
  if (open && typed) {
    const seen = new Set<string>();
    for (const q of queries) {
      if (q.toLowerCase().startsWith(typed.toLowerCase()) && !seen.has(q.toLowerCase())) {
        seen.add(q.toLowerCase());
        history.push({ query: q, highlights: prefixHighlights(q, typed) });
      }
    }
    for (const h of sugg?.q === typed ? sugg.res.history : []) {
      if (seen.has(h.query.toLowerCase())) continue;
      seen.add(h.query.toLowerCase());
      history.push(h);
    }
  }
  const histKeys = new Set(history.map((h) => h.query.toLowerCase()));
  const sugList = showSuggestions ? sugg!.res.suggestions.filter((x) => !histKeys.has(x.query.toLowerCase())) : [];
  const hits = showSuggestions ? sugg!.res.directHits : [];
  const showRecent = open && !typed && items.length > 0;
  const showPanel = showRecent || (open && !!typed && (history.length > 0 || sugList.length > 0 || hits.length > 0));

  return (
    <div className={`${s.container} ${open ? s.open : ''}`} data-test="search-popover-container" onKeyDown={onKeyDown}>
      <div className={s.field}>
        <Icon name="search" size={16} className={s.icon} />
        <input
          ref={input}
          className={s.input}
          data-test="search-popover-search-field"
          aria-label="Search"
          placeholder="Search"
          value={text}
          spellCheck={false}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onMouseDown={() => setOpen(true)}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit(text);
          }}
        />
        {text && (
          <button
            type="button"
            className={s.clear}
            aria-label="Clear"
            data-test="search-field-clear"
            onClick={() => {
              setText('');
              input.current?.focus();
            }}
          >
            <Icon name="close" size={16} />
          </button>
        )}
      </div>
      {open && <button type="button" className={s.backdrop} data-test="search-popover-backdrop" aria-hidden="true" tabIndex={-1} onMouseDown={close} />}
      {showPanel && (
        <div className={s.popover} data-test="search-popover-popover" role="dialog" aria-label="Search">
          <div className={s.panel} data-test="query-suggestions" ref={panel}>
            {showRecent ? (
              <div data-test="recent-searches-container">
                <div className={s.recentHeader}>
                  <span className={s.recentTitle}>Recent Searches</span>
                  <button type="button" className={s.recentClear} data-test="recent-searches-clear" aria-label="Clear recent searches" onClick={() => recent.clear()}>
                    <SmallClose size={12} />
                  </button>
                </div>
                <div data-test="recent-searches">
                  {items.map((it) => (
                    <div
                      key={`${it.kind}-${itemId(it)}`}
                      className={`${s.recentItem} search-row`}
                      data-test={`recent-search-item-${itemId(it)}`}
                      role="button"
                      tabIndex={-1}
                      data-nav-row=""
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('a,button')) return;
                        openItem(it);
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && openItem(it)}
                    >
                      <div className={s.recentCell}>
                        <ListItem
                          item={it}
                          size={48}
                          query={typed}
                          menuButton
                          onOpen={() => {
                            recent.addItem(it);
                            close();
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {history.map((h) => (
                  <div key={`h-${h.query}`} className={s.historyRow}>
                    <button
                      type="button"
                      className={`${s.row} ${s.history}`}
                      data-test={`history-item-${slug(h.query)}`}
                      aria-label="Recent query"
                      tabIndex={-1}
                      data-nav-row=""
                      onClick={() => submit(h.query)}
                    >
                      <HistoryIcon size={26} className={s.historyIcon} />
                      <span className={`${s.historyText} ellipsis`}>
                        <Highlighted s={h} />
                      </span>
                    </button>
                    <button
                      type="button"
                      className={s.historyDelete}
                      data-test={`history-item-delete-${slug(h.query)}`}
                      aria-label="Delete recent query"
                      tabIndex={-1}
                      onClick={() => {
                        recent.removeQuery(h.query);
                        input.current?.focus();
                      }}
                    >
                      <TrashIcon size={20} />
                    </button>
                  </div>
                ))}
                {sugList.map((q) => (
                  <button
                    key={`s-${q.query}`}
                    type="button"
                    className={`${s.row} ${s.suggestion}`}
                    data-test={`suggestion-${slug(q.query)}`}
                    aria-label="Query suggestion"
                    role="link"
                    tabIndex={-1}
                    data-nav-row=""
                    onClick={() => submit(q.query)}
                  >
                    <span className={s.suggestionIcon}>
                      <Icon name="search" size={16} />
                    </span>
                    <span className={`${s.suggestionText} ellipsis`}>
                      <Highlighted s={q} />
                    </span>
                  </button>
                ))}
                {hits.map((it) => (
                  <DirectHit key={`d-${it.kind}-${itemId(it)}`} item={it} onOpen={openItem} onPlay={playHit} />
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
