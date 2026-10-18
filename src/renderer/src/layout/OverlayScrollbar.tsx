// Overlay scrollbar for the main area: TIDAL's scrollbar floats over the content (no layout width),
// 10px hit area, 6px handle, auto-hides after scrolling. The native scrollbar of the target is hidden in CSS.
import { useCallback, useEffect, useRef, useState } from 'react';
import s from './OverlayScrollbar.module.css';

const MIN_HANDLE = 24;
const HIDE_AFTER_MS = 900;

export function OverlayScrollbar({ target }: { target: React.RefObject<HTMLElement | null> }) {
  const track = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState({ top: 0, height: 0, usable: false });
  const [visible, setVisible] = useState(false);
  const [dragging, setDragging] = useState(false);
  const hideTimer = useRef<number | undefined>(undefined);

  const update = useCallback(() => {
    const el = target.current;
    const tr = track.current;
    if (!el || !tr) return;
    const trackH = tr.clientHeight;
    const { scrollHeight, clientHeight, scrollTop } = el;
    const usable = scrollHeight > clientHeight + 1;
    const height = usable ? Math.max(MIN_HANDLE, (clientHeight / scrollHeight) * trackH) : 0;
    const top = usable ? (scrollTop / (scrollHeight - clientHeight)) * (trackH - height) : 0;
    setGeo({ top, height, usable });
  }, [target]);

  const flash = useCallback(() => {
    setVisible(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setVisible(false), HIDE_AFTER_MS);
  }, []);

  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const onScroll = () => {
      update();
      flash();
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    // content height changes (pages loading) don't resize the scroller itself
    const mo = new MutationObserver(() => requestAnimationFrame(update));
    mo.observe(el, { childList: true, subtree: true });
    update();
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
      mo.disconnect();
    };
  }, [target, update, flash]);

  const onHandleDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = target.current!;
    const tr = track.current!;
    const startY = e.clientY;
    const startScroll = el.scrollTop;
    const ratio = (el.scrollHeight - el.clientHeight) / Math.max(1, tr.clientHeight - geo.height);
    setDragging(true);
    const move = (ev: PointerEvent) => {
      el.scrollTop = startScroll + (ev.clientY - startY) * ratio;
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onTrackDown = (e: React.PointerEvent) => {
    const el = target.current!;
    const r = track.current!.getBoundingClientRect();
    const dir = e.clientY < r.top + geo.top ? -1 : 1;
    el.scrollBy({ top: dir * el.clientHeight * 0.9, behavior: 'smooth' });
  };

  return (
    <div
      className={`${s.bar} ${geo.usable && (visible || dragging) ? s.visible : ''} ${geo.usable ? '' : s.unusable}`}
      data-test="main-scrollbar"
      onPointerEnter={() => geo.usable && setVisible(true)}
      onPointerLeave={() => !dragging && flash()}
    >
      <div className={s.track} ref={track} onPointerDown={onTrackDown}>
        <div className={`${s.handle} ${dragging ? s.active : ''}`} style={{ height: geo.height, transform: `translateY(${geo.top}px)` }} onPointerDown={onHandleDown} />
      </div>
    </div>
  );
}
