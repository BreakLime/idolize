import { useUi } from '@/state/ui';

export function Toast() {
  const t = useUi((st) => st.toast);
  if (!t) return null;
  return (
    <div
      key={t.id}
      role="status"
      data-test="toast"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 'calc(var(--player-h) + 24px)',
        transform: 'translateX(-50%)',
        zIndex: 'var(--z-dialog)' as unknown as number,
        padding: '12px 20px',
        borderRadius: 'var(--r-xl)',
        background: 'var(--c-text)',
        color: '#000',
        fontWeight: 600,
        boxShadow: 'var(--shadow-pop)',
        maxWidth: 'min(560px, 80vw)',
      }}
    >
      {t.text}
    </div>
  );
}
