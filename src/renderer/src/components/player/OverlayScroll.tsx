// Scroll area with an overlay scrollbar (no layout width), shown while hovering or scrolling — like TIDAL's panels.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import s from './OverlayScroll.module.css';

interface Props {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  testId?: string;
  ariaLabel?: string;
  onScroll?: () => void;
}

export const OverlayScroll = forwardRef<HTMLDivElement | null, Props>(function OverlayScroll(
  { children, className, innerClassName, testId, ariaLabel, onScroll },
  ref,
) {
  const inner = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => inner.current as HTMLDivElement);
  const [thumb, setThumb] = useState({ top: 0, height: 0, show: false });
  const [active, setActive] = useState(false);
  const hideTimer = useRef<number | undefined>(undefined);
  const dragging = useRef<{ y: number; top: number } | null>(null);

  const measure = useCallback(() => {
    const el = inner.current;
    if (!el) return;
    const track = el.clientHeight - 4;
    const ratio = el.scrollHeight > 0 ? el.clientHeight / el.scrollHeight : 1;
    const height = Math.max(24, track * ratio);
    const max = el.scrollHeight - el.clientHeight;
    const top = max > 0 ? (el.scrollTop / max) * (track - height) : 0;
    setThumb({ top, height, show: ratio < 0.999 });
  }, []);

  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [measure]);
  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  const flash = () => {
    setActive(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => !dragging.current && setActive(false), 900);
  };

  return (
    <div className={`${s.outer} ${className ?? ''}`} data-test={testId} aria-label={ariaLabel}>
      <div
        ref={inner}
        className={`${s.inner} ${innerClassName ?? ''}`}
        onScroll={() => {
          measure();
          flash();
          onScroll?.();
        }}
      >
        {children}
      </div>
      {thumb.show && (
        <div className={`${s.track} ${active ? s.active : ''}`}>
          <div
            className={s.thumb}
            style={{ height: thumb.height, transform: `translateY(${thumb.top}px)` }}
            onPointerDown={(e) => {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              dragging.current = { y: e.clientY, top: inner.current?.scrollTop ?? 0 };
              setActive(true);
            }}
            onPointerMove={(e) => {
              const el = inner.current;
              if (!dragging.current || !el) return;
              const track = el.clientHeight - 4;
              const scale = (el.scrollHeight - el.clientHeight) / Math.max(1, track - thumb.height);
              el.scrollTop = dragging.current.top + (e.clientY - dragging.current.y) * scale;
            }}
            onPointerUp={() => {
              dragging.current = null;
              flash();
            }}
          />
        </div>
      )}
    </div>
  );
});
