import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import s from './Buttons.module.css';

type Btn = ButtonHTMLAttributes<HTMLButtonElement> & { testId?: string };

/** 160×48 pill: "Play" (primary, white) / "Shuffle" (secondary, translucent). */
export function PillButton({ icon, children, variant = 'primary', testId, className, ...rest }: Btn & { icon?: IconName; variant?: 'primary' | 'secondary' }) {
  return (
    <button type="button" className={`${s.pill} ${s[variant]} ${className ?? ''}`} data-test={testId} {...rest}>
      {icon && (
        <span className={s.pillIcon}>
          <Icon name={icon} size={18} />
        </span>
      )}
      <span>{children}</span>
    </button>
  );
}

/** 80×48 icon-over-label header action (Added / Credits / Share / Report / More). */
export function HeaderAction({ icon, label, active, testId, className, ...rest }: Btn & { icon: IconName; label: ReactNode; active?: boolean }) {
  return (
    <button type="button" className={`${s.action} ${active ? s.actionActive : ''} ${className ?? ''}`} data-test={testId} {...rest}>
      <span className={s.actionInner}>
        <Icon name={icon} size={20} />
        <span className={s.actionLabel}>{label}</span>
      </span>
    </button>
  );
}

/** Round icon button used on cards (36px) and rows (24px). */
export function IconButton({ icon, size = 24, iconSize, label, testId, className, ...rest }: Btn & { icon: IconName; size?: number; iconSize?: number; label: string }) {
  return (
    <button type="button" aria-label={label} title={label} className={`${s.iconBtn} ${className ?? ''}`} style={{ width: size, height: size }} data-test={testId} {...rest}>
      <Icon name={icon} size={iconSize ?? Math.round(size * 0.6)} />
    </button>
  );
}

/** White circular play button on cards / shortcuts. */
export function PlayCircle({ size = 36, playing, testId, onClick, label = 'Play' }: { size?: number; playing?: boolean; testId?: string; onClick: (e: React.MouseEvent) => void; label?: string }) {
  return (
    <button
      type="button"
      className={s.playCircle}
      style={{ width: size, height: size }}
      aria-label={playing ? 'Pause' : label}
      data-test={testId}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick(e);
      }}
    >
      <span className={s.playDisc}>
        <Icon name={playing ? 'pause' : 'play'} size={Math.round(size * 0.44)} />
      </span>
    </button>
  );
}
