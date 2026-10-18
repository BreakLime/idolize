import { useRouteError } from 'react-router';

export function PageError({ notFound }: { notFound?: boolean }) {
  const err = useRouteError() as Error | undefined;
  return (
    <div style={{ padding: '96px 64px', color: 'var(--c-text-2)' }} data-test="page-error">
      <h1 style={{ color: 'var(--c-text)', fontFamily: 'var(--font-display)', fontSize: 32, lineHeight: '40px', marginBottom: 12 }}>
        {notFound ? 'Page not found' : 'Something went wrong'}
      </h1>
      {!notFound && <p>{err?.message ?? String(err)}</p>}
    </div>
  );
}
