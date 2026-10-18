// Home ("Music"): v2 home feed with the For you / Staff Picks / Uploads vibe tabs.
// The feed is cursor-paged: more modules load when the end of the page scrolls into view (like TIDAL).
import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_VIBES, homeFeedPage, type HomeFeedPage } from '@/components/home/api';
import { HomeModule, ModuleBoundary, VibeSwitcher } from '@/components/home/HomeModules';
import s from '@/components/home/Home.module.css';
import { useQuery, type QueryState } from '@/lib/query';

// the selected tab survives navigating away and back (like TIDAL)
let lastVibe = 'STATIC';
// pages loaded beyond the first, per vibe (valid while the first page is the same cached object)
const extraPages = new Map<string, { first: HomeFeedPage; pages: HomeFeedPage[] }>();
const cachedExtra = (vibe: string, first?: HomeFeedPage) => {
  const c = extraPages.get(vibe);
  return c && first && c.first === first ? c.pages : [];
};

export default function Home() {
  const [vibe, setVibeState] = useState(lastVibe);
  const setVibe = (v: string) => {
    lastVibe = v;
    setVibeState(v);
  };
  const q = useQuery(`home:feed:${vibe}`, () => homeFeedPage(vibe));
  const vibes = q.data?.vibes.length ? q.data.vibes : DEFAULT_VIBES;

  return (
    <div className={s.bleed}>
      <div className={s.feed} data-test="home-page-feed">
        <VibeSwitcher vibes={vibes} value={vibe} onChange={setVibe} />
        <FeedBody key={vibe} vibe={vibe} q={q} />
      </div>
    </div>
  );
}

function FeedBody({ vibe, q }: { vibe: string; q: QueryState<HomeFeedPage> }) {
  const first = q.data;
  const [ext, setExt] = useState(() => ({ first, pages: cachedExtra(vibe, first) }));
  const extra = ext.first === first ? ext.pages : cachedExtra(vibe, first);
  const cursor = first ? (extra.length ? extra[extra.length - 1].cursor : first.cursor) : null;

  const busy = useRef(false);
  const loadMore = useCallback(async () => {
    if (!cursor || !first || busy.current) return;
    busy.current = true;
    try {
      const next = await homeFeedPage(vibe, cursor);
      const pages = [...extra, next];
      extraPages.set(vibe, { first, pages });
      setExt({ first, pages });
    } catch {
      /* keep what we have; scrolling again retries */
    } finally {
      busy.current = false;
    }
  }, [cursor, first, vibe, extra]);

  // sentinel at the end of the feed; re-observed per cursor so short pages chain-load
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !cursor) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && void loadMore(), { root: document.getElementById('main-scroll'), rootMargin: '0px 0px 800px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, loadMore]);

  if (!first) {
    return q.error ? (
      <div className={s.empty} data-test="home-error">
        <span className={s.emptyTitle}>Couldn’t load this page</span>
        <span>Check your connection and try again.</span>
        <button type="button" className={s.retry} onClick={() => void q.refetch().catch(() => {})}>
          Try again
        </button>
      </div>
    ) : (
      <HomeSkeleton />
    );
  }
  const modules = [first, ...extra].flatMap((p) => p.modules);
  return (
    <>
      {modules.map((m, i) => (
        <ModuleBoundary key={`${m.moduleId}:${m.type}:${i}`}>
          <HomeModule module={m} />
        </ModuleBoundary>
      ))}
      <div ref={sentinel} data-test="intersection-observer-component" />
    </>
  );
}

function HomeSkeleton() {
  return (
    <>
      <div className={s.skeletonShortcuts} aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={s.skeleton} />
        ))}
      </div>
      {[0, 1].map((k) => (
        <div key={k} aria-hidden="true">
          <div className={`${s.skeleton} ${s.skeletonTitle}`} />
          <div className={s.skeletonCards}>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className={s.skeleton} />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
