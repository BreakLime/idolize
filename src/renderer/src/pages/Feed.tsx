// Feed: new releases from followed artists, monthly history mixes … grouped by recency like TIDAL.
import { Link, useNavigate } from 'react-router';
import { coverUrl, mixImageUrl } from '@/api/images';
import { itemPath } from '@/api/models';
import { Icon } from '@/components/Icon';
import { openItemMenu } from '@/components/MediaCard';
import { feedActivities, type FeedActivity } from '@/components/home/api';
import { groupFeed } from '@/components/home/feedGroups';
import s from '@/components/home/Feed.module.css';
import p from '@/components/pageModules.module.css';
import { playItem, useIsPlayingSource } from '@/lib/play';
import { useQuery } from '@/lib/query';

const albumKind = (type: string) => (type === 'SINGLE' ? 'Single' : type === 'EP' ? 'EP' : 'Album');

// ── rows ─────────────────────────────────────────────────────────────────────

function FeedItem({ a }: { a: FeedActivity }) {
  const nav = useNavigate();
  const item = a.item;
  const path = itemPath(item);
  const playing = useIsPlayingSource(item);
  const img = item.kind === 'album' ? coverUrl(item.cover, 48) : mixImageUrl(item, 48);
  return (
    <div className={s.item} data-test="feed-item" role="link" tabIndex={0} onClick={() => nav(path)} onKeyDown={(e) => e.key === 'Enter' && nav(path)} onContextMenu={(e) => openItemMenu(e, item)}>
      <article className={s.cell} data-test={`list-item-${item.kind}`}>
        <Link to={path} className={s.cover} data-test="cell-cover" aria-label={item.title} onClick={(e) => e.stopPropagation()}>
          <span className={s.coverImg}>{img && <img src={img} alt="" loading="lazy" draggable={false} data-test={item.kind === 'mix' ? 'cover-art' : undefined} />}</span>
          <span className={`${s.coverHover} ${playing ? s.coverOn : ''}`}>
            <button
              type="button"
              className={s.play}
              data-test="play-button"
              aria-label={playing ? 'Pause' : 'Play'}
              title={playing ? 'Pause' : 'Play'}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void playItem(item);
              }}
            >
              <Icon name={playing ? 'pause' : 'play'} size={16} />
            </button>
          </span>
        </Link>
        <div className={s.text}>
          <div className={s.textRow}>
            <Link to={path} className={s.titleLink} data-test="grid-item-detail-text-title-link" title={item.title} onClick={(e) => e.stopPropagation()}>
              <span className={`${s.title} ellipsis`}>{item.title}</span>
            </Link>
          </div>
          <span className={`${s.sub} ellipsis`}>
            {item.kind === 'album' ? (
              <>
                {albumKind(item.type)} by{' '}
                {item.artists.map((ar) => (
                  <Link key={ar.id} to={`/artist/${ar.id}`} className={s.artist} data-test="grid-item-detail-text-title-artist" title={ar.name} onClick={(e) => e.stopPropagation()}>
                    {ar.name}
                  </Link>
                ))}
              </>
            ) : (
              <span data-test="subtitle">{item.subTitle}</span>
            )}
          </span>
        </div>
        <div className={s.buttons}>
          <button
            type="button"
            className={s.menu}
            aria-label="Show options"
            title="Show options"
            onClick={(e) => {
              e.stopPropagation();
              openItemMenu(e.currentTarget, item);
            }}
          >
            <Icon name="more" size={20} />
          </button>
        </div>
      </article>
    </div>
  );
}

export default function Feed() {
  const q = useQuery('feed:activities', feedActivities);
  const groups = q.data ? groupFeed(q.data) : [];

  return (
    <div className={p.page}>
      <div className={`${p.pageTitle} ${s.feed}`} data-test="feed-page">
        <div className={p.pageTitleRow}>
          <h1 className={p.pageTitleText}>Feed</h1>
        </div>
        {q.data ? (
          groups.length ? (
            groups.map(([label, list]) => (
              <div key={label} className={s.section} data-test="feed-interval">
                <div className={s.sectionHeader}>
                  <h2>{label}</h2>
                </div>
                <div className={s.list}>
                  {list.map((a) => (
                    <FeedItem key={`${a.item.kind}:${a.item.id}:${a.occurredAt}`} a={a} />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className={s.empty} data-test="feed-empty">
              <span className={s.emptyIcon}>
                <Icon name="bell" size={32} />
              </span>
              <span className={s.emptyTitle}>No updates yet</span>
              <span>Follow artists to see their new releases here.</span>
            </div>
          )
        ) : q.error ? (
          <div className={s.empty} data-test="feed-error">
            <span className={s.emptyTitle}>Couldn’t load your feed</span>
            <button type="button" className={p.retry} onClick={() => void q.refetch().catch(() => {})}>
              Try again
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
