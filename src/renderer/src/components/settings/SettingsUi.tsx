// Building blocks of TIDAL's settings pages: section, grouped rows, toggles, selects and tabs.
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Icon } from '@/components/Icon';
import s from './Settings.module.css';

export { s as settingsStyles };

export function Section({ title, children, offset = true }: { title?: ReactNode; children: ReactNode; offset?: boolean }) {
  return (
    <div className={`${s.section} ${offset ? s.offset : s.compact}`}>
      {title && <h2 className={s.sectionTitle}>{title}</h2>}
      {children}
    </div>
  );
}

export function Group({ children, spaced, noFill }: { children: ReactNode; spaced?: boolean; noFill?: boolean }) {
  return <div className={`${s.group} ${spaced ? s.spaced : ''} ${noFill ? s.noFill : ''}`}>{children}</div>;
}

export function Row({
  title,
  description,
  children,
  testId,
  descTestId,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  testId?: string;
  descTestId?: string;
  className?: string;
}) {
  return (
    <div className={`${s.row} ${className ?? ''}`} data-test={testId}>
      <div className={s.rowText}>
        <span className={s.rowTitle}>{title}</span>
        {description !== undefined && (
          <span className={s.rowDesc} data-test={descTestId}>
            {description}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

/** A whole row that navigates (internal route) or opens an external page. */
export function LinkRow({ title, description, to, href, testId }: { title: ReactNode; description?: ReactNode; to?: string; href?: string; testId?: string }) {
  const inner = (
    <>
      <div className={s.rowText}>
        <span className={s.rowTitle}>{title}</span>
        {description && <span className={s.rowDesc}>{description}</span>}
      </div>
      <Icon name={href ? 'external-link' : 'chevron-right'} size={16} className={s.rowIcon} />
    </>
  );
  return (
    <div className={s.row}>
      {to ? (
        <Link to={to} className={s.rowLink} data-test={testId}>
          {inner}
        </Link>
      ) : (
        <a
          href={href}
          className={s.rowLink}
          data-test={testId}
          onClick={(e) => {
            e.preventDefault();
            if (href) window.open(href, '_blank');
          }}
        >
          {inner}
        </a>
      )}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  testId,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  testId?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`${s.switch} ${checked ? s.switchOn : ''} ${disabled ? s.switchDisabled : ''}`} aria-label={label}>
      <input type="checkbox" data-test={testId} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  testId,
  label,
  width,
  block,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  testId?: string;
  label?: string;
  width?: number;
  block?: boolean;
}) {
  return (
    <div className={s.selectWrap} style={{ width }}>
      <select
        className={s.select}
        style={block ? { display: 'block' } : undefined}
        data-test={testId}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon name="chevron-down" size={14} className={s.selectIcon} />
    </div>
  );
}

export function SmallButton({
  children,
  onClick,
  testId,
  disabled,
  icon,
}: {
  children: ReactNode;
  onClick?: () => void;
  testId?: string;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button type="button" className={s.smallBtn} data-test={testId} disabled={disabled} onClick={onClick}>
      <span>{children}</span>
      {icon}
    </button>
  );
}

/** Underlined text tabs (Settings: General / Account / About …). */
export function TextTabs({ tabs, active }: { tabs: { id: string; label: string; to?: string; onClick?: () => void; testId: string }[]; active: string }) {
  return (
    <div className={s.tabs} role="tablist">
      {tabs.map((t) =>
        t.to ? (
          <Link
            key={t.id}
            to={t.to}
            className={`${s.tab} ${active === t.id ? s.tabActive : ''}`}
            data-test={t.testId}
            role="tab"
            aria-selected={active === t.id}
          >
            <span>{t.label}</span>
          </Link>
        ) : (
          <button
            key={t.id}
            type="button"
            className={`${s.tab} ${active === t.id ? s.tabActive : ''}`}
            data-test={t.testId}
            role="tab"
            aria-selected={active === t.id}
            onClick={t.onClick}
          >
            <span>{t.label}</span>
          </button>
        ),
      )}
    </div>
  );
}
