import { Link } from 'react-router';

export interface Credit {
  type: string;
  contributors: { name: string; id?: number }[];
}

export function CreditsList({ credits }: { credits: Credit[] }) {
  if (!credits.length) return <p>No credits available.</p>;
  return (
    <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '8px 24px', margin: 0 }} data-test="credits-list">
      {credits.map((c) => (
        <div key={c.type} style={{ display: 'contents' }}>
          <dt style={{ color: 'var(--c-text-2)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{c.type}</dt>
          <dd style={{ margin: 0, color: 'var(--c-text)' }}>
            {c.contributors.map((p, i) => (
              <span key={`${p.name}-${i}`}>
                {i > 0 && ', '}
                {p.id ? (
                  <Link to={`/artist/${p.id}`} className="link">
                    {p.name}
                  </Link>
                ) : (
                  p.name
                )}
              </span>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}
