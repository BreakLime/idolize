// Exposes the content area's width as `--main-w` on a page root. Fixed-position layers that must span
// exactly the content area (the artist page's compact bar) use it, whatever the sidebar/queue state.
import { useEffect, useLayoutEffect, type RefObject } from 'react';

const apply = (el: HTMLElement | null) => {
  const main = document.getElementById('main-scroll');
  if (el && main) el.style.setProperty('--main-w', `${main.getBoundingClientRect().width}px`);
};

export function useMainWidth(ref: RefObject<HTMLElement | null>) {
  // the root element can change (loading → loaded); re-apply after every render
  useLayoutEffect(() => apply(ref.current));
  useEffect(() => {
    const main = document.getElementById('main-scroll');
    if (!main) return;
    const ro = new ResizeObserver(() => apply(ref.current));
    ro.observe(main);
    return () => ro.disconnect();
  }, [ref]);
}
