// The three right-hand panels of Now Playing: similar tracks (radio), credits and lyrics.
import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { coverUrl, mixImageUrl } from '@/api/images';
import { trackTitle, type Track } from '@/api/models';
import { tracks as tracksApi } from '@/api/tidal';
import { ExplicitBadge } from '@/components/Badges';
import { PlayCircle } from '@/components/Buttons';
import { Icon } from '@/components/Icon';
import { mixMenu, trackMenu } from '@/components/menus';
import { playItem, useIsPlayingSource } from '@/lib/play';
import { useQuery } from '@/lib/query';
import { toggleFavorite, useIsFavorite } from '@/state/favorites';
import { currentTrack, player, usePlayer } from '@/state/player';
import { toast } from '@/state/ui';
import { QueueNextIcon } from '../icons/player';
import { OverlayScroll } from './OverlayScroll';
import { creditsFor, radiosFor, suggestedFor, type RadioCard } from './data';
import { activeLine, parseLyrics } from './lyrics';
import s from './NowPlayingPanels.module.css';

export function CreditsPanel({ track }: { track: Track }) {
  const { data, loading } = useQuery(`np:credits:${track.id}`, () => creditsFor(track));
  return (
    <div className={s.creditsContainer} data-test="now-playing-credits">
      <OverlayScroll className={s.creditsScroll} innerClassName={s.fadeEdges}>
        <div className={s.creditsList}>
          {loading && <div className={s.muted}>Loading credits…</div>}
          {!loading && !data?.length && <div className={s.muted}>No credits available for this track.</div>}
          {data?.map((g, i) => (
            <div className={s.creditGroup} key={`${g.type}-${i}`}>
              <h3 className={s.creditTitle}>{g.type}</h3>
              <div className={s.creditValue}>
                {g.contributors.map((c, j) => (
                  <span key={`${c.name}-${j}`}>
                    {j > 0 && ', '}
                    {c.id ? (
                      <Link to={`/artist/${c.id}`} className="link">
                        {c.name}
                      </Link>
                    ) : (
                      c.name
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </OverlayScroll>
    </div>
  );
}

function RadioTile({ card }: { card: RadioCard }) {
  const { mix } = card;
  const fav = useIsFavorite(mix);
  const playing = useIsPlayingSource(mix);
  return (
    <div className={s.card}>
      <div
        data-test={`mix-card-${mix.id}`}
        role="presentation"
        className={s.cardInner}
        onContextMenu={(e) => (e.preventDefault(), mixMenu({ clientX: e.clientX, clientY: e.clientY }, mix))}
      >
        <Link to={`/mix/${mix.id}`} className={s.cardImage} draggable={false}>
          <img data-test="mix-card-artwork" src={mixImageUrl(mix, 148)} alt="" draggable={false} />
          <div className={`${s.cardOverlay} ${playing ? s.forceShow : ''}`}>
            <span className={s.cardPlay}>
              <PlayCircle size={36} playing={playing} testId={`mix-card-${mix.id}-play-button`} onClick={() => void playItem(mix)} />
            </span>
            <button
              type="button"
              className={s.cardFav}
              data-test={`favorite-button-${mix.id}`}
              role="switch"
              aria-checked={fav}
              aria-label={fav ? 'Remove from My Collection' : 'Add to My Collection'}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void toggleFavorite(mix);
              }}
            >
              <Icon name={fav ? 'heart-filled' : 'heart'} size={12} />
            </button>
          </div>
        </Link>
        <div className={s.cardText}>
          <div className={s.cardTitle}>
            <Link to={`/mix/${mix.id}`} className="ellipsis link">
              {card.title}
            </Link>
          </div>
          <div className={s.cardSub}>{card.subtitle}</div>
        </div>
      </div>
    </div>
  );
}

function SuggestedRow({ t, list, index }: { t: Track; list: Track[]; index: number }) {
  const current = usePlayer((st) => currentTrack(st)?.id === t.id);
  const play = () => player.playList(list, index, { type: 'radio', id: String(list[0]?.id ?? t.id), title: 'Similar tracks' });
  return (
    <div
      className={s.trackRow}
      data-test="similar-media-item"
      onDoubleClick={play}
      onContextMenu={(e) => (e.preventDefault(), void trackMenu({ clientX: e.clientX, clientY: e.clientY }, t))}
    >
      <div className={s.trackItem}>
        <div className={s.trackImage}>
          <img data-test="similar-track-artwork" src={coverUrl(t.album.cover, 56)} alt="" draggable={false} />
          <div className={s.trackOverlay}>
            <button type="button" className={s.trackPlay} aria-label="Play" title="Play" onClick={play}>
              <Icon name="play" size={12} />
            </button>
          </div>
        </div>
        <div className={s.trackText}>
          <div className={s.trackTitleRow}>
            <div className={`${s.trackTitle} ${current ? s.current : ''}`}>
              <Link to={`/track/${t.id}`} className="link">
                {trackTitle(t)}
              </Link>
            </div>
            {t.explicit && (
              <span className={s.badges}>
                <ExplicitBadge />
              </span>
            )}
          </div>
          <div className={s.trackArtists}>
            {t.artists.map((a, i) => (
              <span key={`${a.id}-${i}`}>
                {i > 0 && ', '}
                <Link to={`/artist/${a.id}`} className="link">
                  {a.name}
                </Link>
              </span>
            ))}
          </div>
        </div>
        <div className={s.trackButtons}>
          <button
            type="button"
            className={s.rowBtn}
            data-test="add-next-button"
            aria-label="Add to queue next"
            title="Add to queue next"
            onClick={() => {
              player.playNext([t]);
              toast(`“${trackTitle(t)}” will play next`);
            }}
          >
            <QueueNextIcon size={24} />
          </button>
          <button type="button" className={s.rowBtn} aria-label="More options" onClick={(e) => void trackMenu(e.currentTarget, t)}>
            <Icon name="more" size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function SimilarPanel({ track }: { track: Track }) {
  const { data: radios } = useQuery(`np:radios:${track.id}`, () => radiosFor(track));
  const { data: suggested, loading } = useQuery(`np:suggested:${track.id}`, () => suggestedFor(track));
  return (
    <div className={s.similarContainer} data-test="now-playing-similar-tracks">
      <OverlayScroll className={s.fill} innerClassName={s.fadeBottom}>
        {!!radios?.length && (
          <section className={s.radioSection}>
            <div>
              <div className={s.sectionHeader} data-test="now-playing-mixes-and-radio-header">
                <h2 className={s.headerText}>Mixes &amp; Radio</h2>
              </div>
              <div className={s.cardRow} data-test="now-playing-mixes-and-radio-scroll">
                {radios.map((r) => (
                  <RadioTile key={r.mix.id} card={r} />
                ))}
              </div>
            </div>
          </section>
        )}
        <section className={s.tracksSection}>
          <h3 className={s.sectionTitle}>Suggested tracks</h3>
          <div className={s.trackList}>
            {loading && <div className={s.muted}>Loading…</div>}
            {!loading && !suggested?.length && <div className={s.muted}>No suggestions for this track.</div>}
            {suggested?.map((t, i) => (
              <SuggestedRow key={`${t.id}-${i}`} t={t} list={suggested} index={i} />
            ))}
          </div>
        </section>
      </OverlayScroll>
    </div>
  );
}

/** Lyrics are fetched for display only and never stored. Timed subtitles follow the player clock. */
export function LyricsPanel({ track }: { track: Track }) {
  const { data, loading } = useQuery(`np:lyrics:${track.id}`, async () => parseLyrics(await tracksApi.lyrics(track.id)));
  const now = usePlayer((st) => st.currentTime);
  const box = useRef<HTMLDivElement>(null);
  const userScrolled = useRef(0);
  const idx = data?.timed ? activeLine(data.lines, now + 0.15) : -1;

  useEffect(() => {
    if (!data?.timed || idx < 0 || Date.now() - userScrolled.current < 3000) return;
    const el = box.current?.querySelector<HTMLElement>(`[data-line="${idx}"]`);
    const sc = box.current;
    if (!el || !sc) return;
    sc.scrollTo({ top: el.offsetTop - sc.clientHeight / 2 + el.clientHeight / 2, behavior: 'smooth' });
  }, [idx, data]);

  return (
    <div className={s.lyricsContainer} data-test="now-playing-lyrics">
      <OverlayScroll ref={box} className={s.fill} innerClassName={`${s.fadeEdges} ${s.lyricsScroll}`}>
        {loading && <div className={s.muted}>Loading lyrics…</div>}
        {!loading && !data && <div className={s.lyricsEmpty}>No lyrics available for this track.</div>}
        {data && (
          <div className={`${s.lyrics} ${data.timed ? s.timed : ''}`} onWheel={() => (userScrolled.current = Date.now())}>
            {data.lines.map((l, i) =>
              data.timed ? (
                <button
                  key={i}
                  type="button"
                  data-line={i}
                  className={`${s.line} ${i === idx ? s.lineActive : i < idx ? s.linePast : ''}`}
                  onClick={() => player.seek(l.t)}
                >
                  {l.text || '♪'}
                </button>
              ) : (
                <p key={i} className={s.plainLine}>
                  {l.text || ' '}
                </p>
              ),
            )}
            {data.provider && <p className={s.provider}>Lyrics provided by {data.provider}</p>}
          </div>
        )}
      </OverlayScroll>
    </div>
  );
}
