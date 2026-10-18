import { useEffect, useLayoutEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router';
import { ArtistBioHost } from '@/components/artist/bioHost';
import { DialogHost } from '@/components/Dialog';
import { MenuHost } from '@/components/Menu';
import { Toast } from '@/components/Toast';
import { PlayerBar } from '@/player/PlayerBar';
import { NowPlaying } from '@/player/NowPlaying';
import { PlayQueue } from '@/player/PlayQueue';
import { useUi } from '@/state/ui';
import { Header } from './Header';
import { OverlayScrollbar } from './OverlayScrollbar';
import { Sidebar } from './Sidebar';
import { TitleBar } from './TitleBar';
import s from './AppLayout.module.css';

const scrollPositions = new Map<string, number>();

/** Restores the main scroll position per history entry (back/forward), top for new pages. */
function useScrollMemory(ref: React.RefObject<HTMLElement | null>) {
  const loc = useLocation();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const saved = scrollPositions.get(loc.key);
    el.scrollTop = saved ?? 0;
    // content may still be loading; retry restoring for a moment
    if (saved) {
      const t = setInterval(() => {
        if (el.scrollHeight - el.clientHeight >= saved) {
          el.scrollTop = saved;
          clearInterval(t);
        }
      }, 50);
      setTimeout(() => clearInterval(t), 1500);
      return () => clearInterval(t);
    }
  }, [loc.key, ref]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => scrollPositions.set(loc.key, el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [loc.key, ref]);
}

export function AppLayout() {
  const main = useRef<HTMLElement>(null);
  const queueOpen = useUi((st) => st.queueOpen);
  useScrollMemory(main);

  return (
    <div className={s.app}>
      <TitleBar />
      <div className={s.body}>
        <Sidebar />
        <div className={s.content}>
          <Header />
          <main ref={main} className={s.main} data-test="main" id="main-scroll">
            <Outlet />
          </main>
          <OverlayScrollbar target={main} />
        </div>
        {queueOpen && <PlayQueue />}
        {/* always mounted: it animates in/out and keeps TIDAL's backdrop layer */}
        <NowPlaying />
        <PlayerBar />
      </div>
      <MenuHost />
      <DialogHost />
      <ArtistBioHost />
      <Toast />
    </div>
  );
}
