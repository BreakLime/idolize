import { useRef } from 'react';
import { Icon } from '@/components/Icon';
import { idol } from '@/lib/bridge';
import { useWindowState } from '@/state/window';
import s from './TitleBar.module.css';

export function TitleBar() {
  const w = useWindowState();
  const menuBtn = useRef<HTMLButtonElement>(null);
  if (w.fullscreen) return null;

  const openMenu = () => {
    const r = menuBtn.current!.getBoundingClientRect();
    idol.window.openMenu(r.left, r.bottom);
  };

  return (
    <div className={`${s.bar} ${w.focused ? '' : s.inactive}`} data-test="title-bar" onDoubleClick={(e) => e.target === e.currentTarget && idol.window.toggleMaximize()}>
      {!w.maximized && <div className={s.resize} />}
      <button ref={menuBtn} className={s.button} type="button" aria-label="Menu" onClick={openMenu}>
        <Icon name="menu" size={16} />
      </button>
      <div className={s.title}>Idolize</div>
      <div className={s.spacer} />
      <div className={s.controls}>
        <button className={s.button} type="button" aria-label="Minimize" onClick={() => idol.window.minimize()}>
          <Icon name="win-minimize" size={24} />
        </button>
        <button className={s.button} type="button" aria-label={w.maximized ? 'Restore' : 'Maximize'} onClick={() => idol.window.toggleMaximize()}>
          <Icon name={w.maximized ? 'win-restore' : 'win-maximize'} size={24} />
        </button>
        <button className={`${s.button} ${s.close}`} type="button" aria-label="Close" onClick={() => idol.window.close()}>
          <Icon name="win-close" size={24} />
        </button>
      </div>
    </div>
  );
}
