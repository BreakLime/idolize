// Modal dialogs (confirm / prompt / custom content) rendered by <DialogHost/>.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { create } from 'zustand';
import s from './Dialog.module.css';

interface DialogState {
  title: string;
  body?: ReactNode;
  input?: { placeholder: string; value: string };
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  resolve: (v: string | boolean | null) => void;
}

const useDialog = create<{ dialog: DialogState | null }>(() => ({ dialog: null }));

export function promptText(title: string, placeholder: string, value = ''): Promise<string | null> {
  return new Promise((resolve) =>
    useDialog.setState({ dialog: { title, input: { placeholder, value }, confirmLabel: 'Save', resolve: (v) => resolve(typeof v === 'string' ? v.trim() || null : null) } }),
  );
}

export function confirmDialog(title: string, body: ReactNode, confirmLabel = 'OK', danger = false): Promise<boolean> {
  return new Promise((resolve) => useDialog.setState({ dialog: { title, body, confirmLabel, danger, resolve: (v) => resolve(v === true) } }));
}

export function showDialog(title: string, body: ReactNode): Promise<void> {
  return new Promise((resolve) => useDialog.setState({ dialog: { title, body, confirmLabel: 'Close', cancelLabel: '', resolve: () => resolve() } }));
}

export function DialogHost() {
  const d = useDialog((st) => st.dialog);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!d) return;
    setValue(d.input?.value ?? '');
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [d]);
  if (!d) return null;
  const close = (v: string | boolean | null) => {
    useDialog.setState({ dialog: null });
    d.resolve(v);
  };
  return (
    <div className={s.backdrop} onMouseDown={(e) => e.target === e.currentTarget && close(null)}>
      <div className={s.dialog} role="dialog" aria-modal="true" data-test="dialog-open" onKeyDown={(e) => e.key === 'Escape' && close(null)}>
        <h2 className={s.title}>{d.title}</h2>
        {d.body && <div className={s.body}>{d.body}</div>}
        {d.input && (
          <input
            ref={inputRef}
            className={s.input}
            placeholder={d.input.placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && value.trim() && close(value)}
            data-test="dialog-input"
          />
        )}
        <div className={s.actions}>
          {d.cancelLabel !== '' && (
            <button type="button" className={s.secondary} onClick={() => close(null)}>
              {d.cancelLabel ?? 'Cancel'}
            </button>
          )}
          <button
            type="button"
            className={`${s.primary} ${d.danger ? s.danger : ''}`}
            disabled={!!d.input && !value.trim()}
            data-test="dialog-confirm"
            onClick={() => close(d.input ? value : true)}
          >
            {d.confirmLabel ?? 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}
