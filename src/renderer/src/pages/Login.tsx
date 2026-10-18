import { useState } from 'react';
import { IdolLogo } from '@/components/Icon';
import { idol } from '@/lib/bridge';
import { TitleBar } from '@/layout/TitleBar';

export function Login() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const login = async () => {
    setBusy(true);
    setError(null);
    try {
      await idol.auth.login();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TitleBar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }} data-test="login-page">
        <IdolLogo size={56} />
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, lineHeight: '40px', fontWeight: 700 }}>Welcome to Idolize</h1>
        <p style={{ color: 'var(--c-text-2)' }}>Log in with your TIDAL account to continue.</p>
        <button
          type="button"
          onClick={login}
          disabled={busy}
          data-test="login-button"
          style={{ height: 48, padding: '0 32px', borderRadius: 1000, background: '#fff', color: '#000', fontWeight: 600, fontSize: 16 }}
        >
          {busy ? 'Waiting for login…' : 'Log in'}
        </button>
        {error && <p style={{ color: 'var(--c-danger)' }}>{error}</p>}
      </div>
    </div>
  );
}
