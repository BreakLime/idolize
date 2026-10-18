// /credits/:id — every track an artist is credited on, filterable by role category.
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { artistUrl } from '@/api/images';
import { PillTabs } from '@/components/HorizontalList';
import { Icon } from '@/components/Icon';
import { openMenu } from '@/components/Menu';
import { useQuery } from '@/lib/query';
import { toast } from '@/state/ui';
import { ArtistTrackTable, type ExtraColumn } from './ArtistTrackTable';
import { contributorPage } from './artistApi';
import { LoadError } from './LoadError';
import s from './ArtistCredits.module.css';

export default function ArtistCredits() {
  const { id = '' } = useParams();
  const { data, error, refetch } = useQuery(id ? `artist:${id}:credits` : null, () => contributorPage(id));
  const [role, setRole] = useState('all');

  const rows = useMemo(() => (data ? (role === 'all' ? data.items : data.items.filter((c) => c.roles.some((r) => r.category === role))) : []), [data, role]);
  const extra = useMemo<ExtraColumn[]>(
    () => [
      { head: 'Role', cell: (_t, i) => <span className="ellipsis">{rows[i]?.roles.map((r) => r.name).join(', ')}</span> },
      { head: 'Year', cell: (t) => <span>{t.kind === 'track' ? t.album.releaseDate?.slice(0, 4) : ''}</span> },
    ],
    [rows],
  );

  if (error && !data) return <LoadError error={error} onRetry={() => void refetch()} />;
  const name = data?.artist.name ?? '';
  return (
    <div className={s.page} data-test="credits-page">
      <div className={s.header} data-test="page-title-container">
        <Link to={`/artist/${id}`} className={s.avatar}>
          {data?.artist.picture && <img src={artistUrl(data.artist.picture, 80)} alt="" />}
        </Link>
        <h1 className={s.title}>{data?.title ?? ''}</h1>
        <div className={s.actions} data-test="header-controls">
          <button
            type="button"
            className={s.round}
            aria-label="Share"
            data-test="share-button"
            onClick={(e) =>
              openMenu(
                e.currentTarget,
                [
                  {
                    label: 'Copy link',
                    icon: 'share',
                    onClick: () => {
                      void navigator.clipboard.writeText(`https://tidal.com/artist/${id}`);
                      toast('Link copied to clipboard');
                    },
                  },
                ],
                { align: 'end' },
              )
            }
          >
            <Icon name="share" size={20} />
          </button>
          <button type="button" className={s.round} aria-label="Report" data-test="report-button" onClick={() => window.open('https://support.tidal.com/hc/en-us/requests/new', '_blank')}>
            <Icon name="report" size={20} />
          </button>
        </div>
      </div>
      {data && data.categories.length > 0 && (
        <PillTabs tabs={[{ id: 'all', label: 'All' }, ...data.categories.map((c) => ({ id: c, label: c }))]} value={role} onChange={setRole} testId="credits-role-filter" />
      )}
      {data && (
        <div className={s.table} data-test="media-table">
          <ArtistTrackTable items={rows.map((r) => r.track)} extra={extra} source={{ type: 'artist', id: `${id}-credits`, title: `${name} credits`, path: `/credits/${id}` }} />
          {!rows.length && <p className={s.empty}>No credits.</p>}
        </div>
      )}
    </div>
  );
}
