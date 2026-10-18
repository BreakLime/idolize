// Self-contained modal layer for the detail pages (edit playlist, playlist picker). It renders into its own
// body-level root, so it works from menus and pages alike without touching the shared DialogHost.
import { useEffect, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { create } from 'zustand';
import { Icon } from '../Icon';
import s from './Modal.module.css';

type Render = (close: () => void) => ReactNode;
const useModal = create<{ render: Render | null; title: string; testId?: string }>(() => ({ render: null, title: '' }));

let root: Root | null = null;
const close = () => useModal.setState({ render: null });

function ModalHost() {
  const { render, title, testId } = useModal();
  useEffect(() => {
    if (!render) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [render]);
  if (!render) return null;
  return (
    <div className={s.backdrop} onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className={s.dialog} role="dialog" aria-modal="true" data-test={testId ?? 'dialog'}>
        <header className={s.header}>
          <span className={s.title} data-test="dialog-header">
            {title}
          </span>
          <button type="button" className={s.close} data-test="dialog-close" aria-label="Close" onClick={close}>
            <Icon name="close" size={16} />
          </button>
        </header>
        {render(close)}
      </div>
    </div>
  );
}

export function openModal(title: string, render: Render, testId?: string) {
  if (!root) {
    const el = document.createElement('div');
    el.id = 'detail-modal-root';
    document.body.appendChild(el);
    root = createRoot(el);
    root.render(<ModalHost />);
  }
  useModal.setState({ render, title, testId });
}

export const closeModal = close;
