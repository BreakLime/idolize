// Inline error state with retry for the artist and search pages.
export function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const msg = error instanceof Error ? error.message : String(error ?? '');
  const notFound = /404|not found/i.test(msg);
  return (
    <div style={{ padding: '96px 64px', color: 'var(--c-text-2)' }} data-test="page-error">
      <h1 style={{ color: 'var(--c-text)', fontSize: 32, lineHeight: '40px', fontWeight: 700, marginBottom: 12 }}>{notFound ? 'Page not found' : 'Something went wrong'}</h1>
      {!notFound && <p style={{ marginBottom: 24 }}>{msg}</p>}
      {!notFound && (
        <button type="button" onClick={onRetry} style={{ height: 40, padding: '0 20px', borderRadius: 1000, background: 'var(--c-text)', color: 'rgb(16,16,16)', fontWeight: 600 }}>
          Try again
        </button>
      )}
    </div>
  );
}
