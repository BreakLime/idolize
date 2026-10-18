// Explore and every other v1 page reachable from it: /view/pages/<path> (genres, moods, decades, "View all" lists …).
import { useParams } from 'react-router';
import { page } from '@/api/tidal';
import { PageModules, PageTitle } from '@/components/pageModules';
import s from '@/components/pageModules.module.css';
import { useQuery } from '@/lib/query';

export default function Explore() {
  const path = `pages/${(useParams()['*'] ?? 'explore').replace(/^\/+|\/+$/g, '') || 'explore'}`;
  const q = useQuery(`page:${path}`, () => page(path));

  return (
    <div className={s.page}>
      {q.data ? (
        <>
          <PageTitle title={q.data.title} />
          <PageModules key={path} modules={q.data.modules} />
        </>
      ) : q.error ? (
        <div className={s.pageTitle}>
          <div className={s.state} data-test="page-error">
            <span className={s.stateTitle}>Couldn’t load this page</span>
            <span>Check your connection and try again.</span>
            <button type="button" className={s.retry} onClick={() => void q.refetch().catch(() => {})}>
              Try again
            </button>
          </div>
        </div>
      ) : (
        <div className={s.pageTitle} aria-hidden="true">
          <div className={s.skeletonTitle} />
        </div>
      )}
    </div>
  );
}
