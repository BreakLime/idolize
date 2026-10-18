// /search?q= (top results) and /search/:tab?q= — sticky pill bar, then the tab's layout:
// top hits list, profile/album/playlist/video grids, or the track table (tracks, uploads).
import { Link, useParams, useSearchParams } from 'react-router';
import { itemKey, type MediaItem, type Track, type Video } from '@/api/models';
import { search, type SearchResult } from '@/api/tidal';
import { LoadError } from '@/components/artist/LoadError';
import { openItemMenu } from '@/components/MediaCard';
import { MediaTable } from '@/components/MediaTable';
import { GridItem } from '@/components/search/GridItem';
import { ListItem, searchPath, playFromSearch } from '@/components/search/ListItem';
import { recent } from '@/components/search/recent';
import { useQuery } from '@/lib/query';
import s from '@/components/search/Search.module.css';

export type SearchTab = 'top' | 'artists' | 'albums' | 'tracks' | 'playlists' | 'videos' | 'uploads';

export const SEARCH_TABS: { id: SearchTab; label: string }[] = [
  { id: 'top', label: 'Top results' },
  { id: 'artists', label: 'Profiles' },
  { id: 'albums', label: 'Albums' },
  { id: 'tracks', label: 'Tracks' },
  { id: 'playlists', label: 'Playlists' },
  { id: 'videos', label: 'Videos' },
  { id: 'uploads', label: 'Uploads' },
];

export const searchUrl = (q: string, tab: SearchTab = 'top') => `/search${tab === 'top' ? '' : `/${tab}`}?q=${encodeURIComponent(q)}`;

function TopHit({ item, query }: { item: MediaItem; query: string }) {
  const id = item.kind === 'playlist' ? item.uuid : String(item.id);
  const path = searchPath(item);
  const open = () => recent.addItem(item);
  return (
    <div className={s.topHit} data-test={`search-results-top-hit-${id}`} onContextMenu={(e) => openItemMenu(e, item)}>
      <div className={s.fullWidth}>
        <span className={s.topHitCell} data-test={`search-results-top-hit-${id}-cell`}>
          <ListItem item={item} meta query={query} onOpen={open} />
        </span>
      </div>
      {path ? (
        <Link to={path} className={s.rowLink} data-test={`search-results-top-hit-${id}-link`} onClick={open}>
          <span className={s.visuallyHidden}>{item.kind}</span>
        </Link>
      ) : (
        <a
          className={s.rowLink}
          data-test={`search-results-top-hit-${id}-link`}
          onClick={() => {
            open();
            void playFromSearch(item, query);
          }}
        >
          <span className={s.visuallyHidden}>{item.kind}</span>
        </a>
      )}
    </div>
  );
}

const FILTER_TAB: Record<string, SearchTab> = { ARTISTS: 'artists', ALBUMS: 'albums', TRACKS: 'tracks', PLAYLISTS: 'playlists', VIDEOS: 'videos', UPLOADS: 'uploads' };

/** TIDAL shows "Top results" plus one pill per non-empty result type, in the API's relevance order. */
function pillTabs(data: SearchResult | undefined, current: SearchTab) {
  if (!data) return SEARCH_TABS;
  const ids = data.filters.map((f) => FILTER_TAB[f]).filter(Boolean);
  const order: SearchTab[] = [
    'top',
    ...(ids.length
      ? ids
      : SEARCH_TABS.slice(1)
          .map((t) => t.id)
          .filter((id) => id !== 'top' && data[id as Exclude<SearchTab, 'top'>].items.length)),
  ];
  if (!order.includes(current)) order.push(current);
  return order.map((id) => SEARCH_TABS.find((t) => t.id === id)!);
}

function Pills({ tab, query, data }: { tab: SearchTab; query: string; data?: SearchResult }) {
  return (
    <div className={s.header}>
      <div className={s.pillsArea}>
        <div className={s.pills} data-test="search-pills" role="tablist">
          {pillTabs(data, tab).map((t) => (
            <Link key={t.id} to={searchUrl(query, t.id)} replace role="tab" aria-selected={t.id === tab} className={`${s.pill} ${t.id === tab ? s.pillActive : ''}`} data-test={`search-pill-${t.id}`}>
              <span>{t.label}</span>
            </Link>
          ))}
        </div>
      </div>
      <div className={s.divider} />
    </div>
  );
}

function Empty() {
  return (
    <div className={s.empty} data-test="search-no-results">
      <h2 className={s.emptyTitle}>No Results Found</h2>
      <p className={s.emptyText}>Please try again</p>
    </div>
  );
}

function Results({ tab, query, data }: { tab: SearchTab; query: string; data: SearchResult }) {
  if (tab === 'top') {
    if (!data.topHits.length) return <Empty />;
    return (
      <div className={s.topHits} data-test="search-results-top-hits">
        {data.topHits.map((it) => (
          <TopHit key={itemKey(it)} item={it} query={query} />
        ))}
      </div>
    );
  }
  if (tab === 'tracks' || tab === 'uploads') {
    const items = data[tab].items.filter((t): t is Track | Video => t.kind === 'track' || t.kind === 'video');
    if (!items.length) return <Empty />;
    return (
      <div data-test="search-results-media-table">
        <MediaTable items={items} columns={['index', 'cover', 'title', 'artist', 'album', 'time']} source={{ type: 'search', id: query, title: query, path: searchUrl(query, tab) }} />
      </div>
    );
  }
  const items = data[tab].items;
  if (!items.length) return <Empty />;
  return (
    <div data-test="search-results-list-module">
      <div>
        <section className={s.grid} data-test="grid">
          {items.map((it) => (
            <div key={itemKey(it)} className={`${s.cell} ${tab === 'videos' ? s.videoCell : tab === 'artists' ? s.artistCell : ''}`}>
              <div>
                <GridItem item={it} query={query} onOpen={() => recent.addItem(it)} />
              </div>
            </div>
          ))}
          {/* end-of-list sentinel row (TIDAL keeps one for paging; it adds a trailing grid gap) */}
          <div className={s.sentinel} aria-hidden="true" />
        </section>
      </div>
    </div>
  );
}

export default function Search() {
  const { tab: rawTab } = useParams();
  const [params] = useSearchParams();
  const query = (params.get('q') ?? '').trim();
  const tab: SearchTab = SEARCH_TABS.some((t) => t.id === rawTab) ? (rawTab as SearchTab) : 'top';
  const { data, error, loading, refetch } = useQuery(query ? `search:${query}` : null, () => search(query));

  return (
    <div className={s.page} data-test="search-results">
      <div data-test={tab === 'top' ? 'search-results-top' : 'search-results-normal'}>
        <Pills tab={tab} query={query} data={data} />
        <div className={s.results}>
          {!query ? null : error && !data ? (
            <LoadError error={error} onRetry={() => void refetch()} />
          ) : loading || !data ? (
            <div className={s.loading} data-test="search-loading" />
          ) : (
            <Results tab={tab} query={query} data={data} />
          )}
        </div>
      </div>
    </div>
  );
}
