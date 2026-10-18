// Play queue side panel: history, the playing track, the manual queue and what comes next from the source.
// Virtualized (queues can hold thousands of tracks); upcoming rows can be dragged to reorder.
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { coverUrl } from '@/api/images';
import { trackTitle } from '@/api/models';
import { playlistEdit } from '@/api/tidal';
import { promptText } from '@/components/Dialog';
import { Icon } from '@/components/Icon';
import { EqualizerIcon, PlaylistSaveIcon } from '@/components/icons/player';
import { trackMenu } from '@/components/menus';
import { OverlayScroll } from '@/components/player/OverlayScroll';
import { invalidate } from '@/lib/query';
import { navigate } from '@/lib/navigation';
import { player, usePlayer, type QueueEntry } from '@/state/player';
import { toast, useUi } from '@/state/ui';
import { isAutoplayEntry } from './autoplay';
import s from './PlayQueue.module.css';

type Zone = 'history' | 'current' | 'manual' | 'next';

interface Header {
  label: string;
  link?: { title: string; path?: string };
  clear?: () => void;
  clearTest?: string;
}

interface Row {
  pos: number;
  entry: QueueEntry;
  zone: Zone;
  header?: Header;
}

const ROW = 60;
const WITH_HEADER = 140;

/** Removes upcoming entries matching `pred` (positions after the current track). */
function dropUpcoming(pred: (e: QueueEntry) => boolean) {
  const s = usePlayer.getState();
  usePlayer.setState({ order: [...s.order.slice(0, s.pos + 1), ...s.order.slice(s.pos + 1).filter((i) => !pred(s.entries[i]))] });
}

function useRows(): Row[] {
  const entries = usePlayer((st) => st.entries);
  const order = usePlayer((st) => st.order);
  const pos = usePlayer((st) => st.pos);
  const source = usePlayer((st) => st.source);
  return useMemo(() => {
    const rows: Row[] = [];
    if (!order.length) return rows;
    for (let i = 0; i < pos; i++) rows.push({ pos: i, entry: entries[order[i]], zone: 'history' });
    const link = source ? { title: source.title, path: source.path } : undefined;
    rows.push({
      pos,
      entry: entries[order[pos]],
      zone: 'current',
      header: {
        label: 'Playing from:',
        link,
        clear: () => dropUpcoming((e) => !e.manual),
        clearTest: 'playqueue-clear-playing-from',
      },
    });
    let i = pos + 1;
    let first = true;
    for (; i < order.length && entries[order[i]]?.manual; i++) {
      rows.push({
        pos: i,
        entry: entries[order[i]],
        zone: 'manual',
        header: first ? { label: 'Next in queue', clear: () => dropUpcoming((e) => !!e.manual), clearTest: 'playqueue-clear-queue' } : undefined,
      });
      first = false;
    }
    first = true;
    let firstAuto = true;
    for (; i < order.length; i++) {
      const entry = entries[order[i]];
      if (entry && isAutoplayEntry(entry.qid)) {
        rows.push({
          pos: i,
          entry,
          zone: 'next',
          header: firstAuto
            ? { label: 'Autoplay', clear: () => dropUpcoming((e) => isAutoplayEntry(e.qid)), clearTest: 'playqueue-clear-autoplay' }
            : undefined,
        });
        firstAuto = false;
        continue;
      }
      rows.push({ pos: i, entry, zone: 'next', header: first ? { label: 'Next Up from:', link } : undefined });
      first = false;
    }
    return rows.filter((r) => r.entry);
  }, [entries, order, pos, source]);
}

function SectionHeader({ h }: { h: Header }) {
  return (
    <div className={s.sectionHeader}>
      <div className={s.playingFrom} data-test="playing-from-container">
        <p className="ellipsis">
          {h.label}
          {h.link && (
            <>
              {' '}
              {h.link.path ? (
                <Link to={h.link.path} className={s.fromLink} data-test="playing-from-links">
                  {h.link.title}
                </Link>
              ) : (
                <span className={s.fromLink} data-test="playing-from-links">
                  {h.link.title}
                </span>
              )}
            </>
          )}
        </p>
      </div>
      {h.clear && (
        <button type="button" className={s.clear} data-test={h.clearTest} onClick={h.clear}>
          <p>Clear</p>
        </button>
      )}
    </div>
  );
}

function QueueRow({ row, playing, drag }: { row: Row; playing: boolean; drag: DragApi }) {
  const t = row.entry.track;
  const movable = row.zone === 'manual' || row.zone === 'next';
  const isCurrent = row.zone === 'current';
  return (
    <div
      className={`${s.item} ${row.zone === 'history' ? s.history : ''} ${drag.over === row.pos ? s.dropTarget : ''} ${drag.from === row.pos ? s.dragging : ''}`}
      data-test="playqueue-item"
      role="row"
      draggable={movable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(row.pos));
        drag.start(row.pos);
      }}
      onDragOver={(e) => {
        if (drag.from === null || !(row.zone === 'manual' || row.zone === 'next')) return;
        e.preventDefault();
        drag.hover(row.pos);
      }}
      onDrop={(e) => {
        e.preventDefault();
        drag.drop(row.pos);
      }}
      onDragEnd={drag.end}
      onDoubleClick={() => !isCurrent && player.playAt(row.pos)}
      onContextMenu={(e) => {
        e.preventDefault();
        void trackMenu({ clientX: e.clientX, clientY: e.clientY }, t);
      }}
    >
      <div className={s.coverCell} role="cell">
        <div className={s.cover} data-test="cell-cover" role="group">
          <img src={coverUrl(t.album.cover, 44)} alt="" draggable={false} />
          {!isCurrent && (
            <div className={s.coverPlay} onClick={() => player.playAt(row.pos)}>
              <button type="button" className={s.coverPlayBtn} data-test="play-button" aria-label="Play">
                <Icon name="play" size={16} />
              </button>
            </div>
          )}
        </div>
        {isCurrent && (
          <>
            <span className={`${s.nowPlaying} ${playing ? s.eqOn : ''}`} data-test="nowplaying-icon">
              <EqualizerIcon size={16} className={s.eq} />
            </span>
            <div className={s.currentTint} />
          </>
        )}
      </div>
      <div className={s.textCell} role="cell">
        <div className={s.titleRow}>
          <Link to={`/track/${t.id}`} className={s.titleLink} data-test="playqueue-item-title" title={trackTitle(t)} draggable={false}>
            <p className={`${s.title} ${isCurrent ? s.current : ''}`}>{trackTitle(t)}</p>
          </Link>
        </div>
        <span className={s.artists}>
          {t.artists.map((a, i) => (
            <span key={`${a.id}-${i}`}>
              {i > 0 && ', '}
              <Link to={`/artist/${a.id}`} className="link" data-test="grid-item-detail-text-title-artist" aria-label={a.name} title={a.name} draggable={false}>
                {a.name}
              </Link>
            </span>
          ))}
        </span>
      </div>
      <div className={s.actionCell} role="cell">
        {movable ? (
          <button type="button" className={s.remove} data-test="remove-button" title="Remove" onClick={() => player.removeAt(row.pos)}>
            <Icon name="close" size={20} />
          </button>
        ) : (
          <button
            type="button"
            className={s.more}
            data-test="play-queue-item-context-menu"
            aria-label="Show options"
            title="Show options"
            onClick={(e) => void trackMenu(e.currentTarget, t)}
          >
            <Icon name="more" size={20} />
          </button>
        )}
      </div>
    </div>
  );
}

interface DragApi {
  from: number | null;
  over: number | null;
  start: (pos: number) => void;
  hover: (pos: number) => void;
  drop: (pos: number) => void;
  end: () => void;
}

function useDrag(): DragApi {
  const [from, setFrom] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  return {
    from,
    over,
    start: (p) => setFrom(p),
    hover: (p) => over !== p && setOver(p),
    drop: (p) => {
      if (from !== null && from !== p) player.move(from, p);
      setFrom(null);
      setOver(null);
    },
    end: () => {
      setFrom(null);
      setOver(null);
    },
  };
}

async function saveAsPlaylist() {
  const s = usePlayer.getState();
  const ids = s.order.map((i) => s.entries[i]?.track.id).filter(Boolean);
  if (!ids.length) return;
  const name = await promptText('Create playlist from queue', 'Playlist title', s.source?.title ? `${s.source.title} queue` : 'Play queue');
  if (!name) return;
  try {
    const r = await playlistEdit.create(name);
    const uuid: string | undefined = r?.data?.uuid ?? r?.uuid;
    if (!uuid) throw new Error('no playlist id');
    for (let i = 0; i < ids.length; i += 100) await playlistEdit.addTracks(uuid, ids.slice(i, i + 100));
    invalidate('sidebar:');
    toast(`Created “${name}”`);
    navigate(`/playlist/${uuid}`);
  } catch {
    toast('Could not create the playlist');
  }
}

export function PlayQueue() {
  const rows = useRows();
  const playing = usePlayer((st) => st.playing);
  const pos = usePlayer((st) => st.pos);
  const scrollRef = useRef<HTMLDivElement>(null);
  const drag = useDrag();
  const historyCount = rows.filter((r) => r.zone === 'history').length;
  const [label, setLabel] = useState<string | null>(null);

  const virt = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (rows[i]?.header ? WITH_HEADER : ROW),
    getItemKey: (i) => rows[i]?.entry.qid ?? i,
    overscan: 8,
  });

  // open scrolled so the last two history rows sit above "Playing from" (like TIDAL)
  const opened = useRef(false);
  useLayoutEffect(() => {
    if (opened.current || !rows.length) return;
    opened.current = true;
    if (scrollRef.current) scrollRef.current.scrollTop = Math.max(0, historyCount * ROW - 2 * ROW);
  }, [rows.length, historyCount]);

  // follow the playing track when it changes
  const lastPos = useRef(pos);
  useEffect(() => {
    if (lastPos.current === pos) return;
    lastPos.current = pos;
    if (scrollRef.current) scrollRef.current.scrollTo({ top: Math.max(0, historyCount * ROW - 2 * ROW), behavior: 'smooth' });
  }, [pos, historyCount]);

  const onScroll = () => {
    const top = scrollRef.current?.scrollTop ?? 0;
    setLabel(historyCount && top < historyCount * ROW ? 'History' : null);
  };
  useEffect(onScroll, [historyCount]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) =>
      e.key === 'Escape' && !(e.target as HTMLElement)?.closest('input, [role="dialog"], [role="menu"]') && useUi.setState({ queueOpen: false });
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={s.wrapper}>
      <aside className={s.container}>
        <div className={s.drop}>
          <div className={s.queue} data-test="playqueue">
            <div className={s.header} data-test="playqueue-header">
              <h2 className={s.heading} data-test="playqueue-title">
                Play queue
              </h2>
              <button
                type="button"
                className={s.headerBtn}
                data-test="playqueue-save-button"
                aria-label="Create new playlist"
                title="Create new playlist"
                disabled={!rows.length}
                onClick={() => void saveAsPlaylist()}
              >
                <span>
                  <PlaylistSaveIcon size={16} />
                </span>
              </button>
              <button
                type="button"
                className={s.headerBtn}
                data-test="playqueue-close-button"
                aria-label="Close"
                title="Close"
                onClick={() => useUi.setState({ queueOpen: false })}
              >
                <span>
                  <Icon name="close" size={16} />
                </span>
              </button>
            </div>
            {historyCount > 0 && (
              <div className={s.stickyLabel}>
                <p className="ellipsis">{label}</p>
              </div>
            )}
            {rows.length === 0 ? (
              <div className={s.empty} data-test="playqueue-empty">
                <p className={s.emptyTitle}>Your queue is empty</p>
                <p className={s.emptyText}>Play something, or use “Play next” and “Add to queue” on any track.</p>
              </div>
            ) : (
              <OverlayScroll
                className={s.scroll}
                innerClassName={s.scrollInner}
                testId="playqueue-scroll"
                ariaLabel="Play queue"
                ref={scrollRef}
                onScroll={onScroll}
              >
                <div role="table" aria-label="Play queue" className={s.table} style={{ height: virt.getTotalSize() }}>
                  {virt.getVirtualItems().map((vi) => {
                    const row = rows[vi.index];
                    return (
                      <div key={vi.key} className={s.vrow} style={{ height: vi.size, transform: `translateY(${vi.start}px)` }}>
                        {row.header && <SectionHeader h={row.header} />}
                        <div className={s.rowWrap}>
                          <QueueRow row={row} playing={playing} drag={drag} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </OverlayScroll>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
