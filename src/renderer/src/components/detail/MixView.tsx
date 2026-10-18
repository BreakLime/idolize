// Mix / radio page: MIX_HEADER (artwork, colored title, "Track radio · Artist") + TRACK_LIST (cover column, Block).
import { useMemo } from 'react';
import { toMix, type Mix, type Track, type Video } from '@/api/models';
import { mixes, pageModuleItems, type Page } from '@/api/tidal';
import { useIsPlayingSource } from '@/lib/play';
import { useQuery } from '@/lib/query';
import { toggleFavorite, useIsFavorite } from '@/state/favorites';
import { player, usePlayer, type PlaySource } from '@/state/player';
import { HeaderAction, PillButton } from '../Buttons';
import { MediaTable, type Column } from '../MediaTable';
import { mixMenu } from '../menus';
import { PageHeader } from '../PageHeader';
import { DetailError, DetailLoading } from './DetailStates';
import { CompactAction, actionGroup, naturalAction } from './HeaderParts';
import { shareMenu } from './shareReport';
import s from './MixView.module.css';

const COLUMNS: Column[] = ['cover', 'title', 'artist', 'album', 'time'];

const KIND: Record<string, string> = { TRACK_MIX: 'Track radio', ARTIST_MIX: 'Artist radio', VIDEO_MIX: 'Video mix' };

interface MixData {
  mix: Mix;
  raw: Record<string, unknown> & { titleColor?: string; subTitle?: string; mixType?: string };
  items: (Track | Video)[];
}

function fromPage(page: Page): MixData | null {
  const header = page.modules.find((m) => m.type === 'MIX_HEADER');
  const list = page.modules.find((m) => m.type === 'TRACK_LIST' || m.type === 'VIDEO_LIST');
  if (!header?.raw.mix) return null;
  return { mix: toMix(header.raw.mix), raw: header.raw.mix, items: list ? (pageModuleItems(list) as (Track | Video)[]) : [] };
}

const pickImage = (imgs: Mix['images'] | undefined, order: string[]) => {
  for (const k of order) if (imgs?.[k]?.url) return imgs[k].url;
  return undefined;
};

export function MixView({ id }: { id: string }) {
  const q = useQuery(`mix:${id}`, () => mixes.page(id).then(fromPage));
  if (q.error && !q.data) return <DetailError error={q.error} onRetry={() => void q.refetch()} />;
  if (q.data === undefined) return <DetailLoading />;
  if (q.data === null) return <DetailError notFound />;
  return <MixContent data={q.data} />;
}

function MixContent({ data }: { data: MixData }) {
  const { mix, raw, items } = data;
  const fav = useIsFavorite(mix);
  const playingThis = useIsPlayingSource(mix);
  const source: PlaySource = useMemo(() => ({ type: 'mix', id: mix.id, title: mix.title, path: `/mix/${mix.id}` }), [mix.id, mix.title]);
  const imgs = Object.keys(mix.images ?? {}).length ? mix.images : mix.detailImages;
  const kind = KIND[mix.mixType];
  const subtitle = kind && mix.subTitle ? `${kind} · ${mix.subTitle}` : mix.subTitle || kind || '';
  const titleStyle = raw.titleColor ? { color: raw.titleColor } : undefined;

  const play = (shuffle = false) => {
    const st = usePlayer.getState();
    if (!shuffle && st.source?.type === 'mix' && st.source.id === mix.id) return player.toggle();
    if (items.length) player.playList(items, 0, source, { shuffle });
  };
  const share = (e: React.MouseEvent<HTMLElement>) => shareMenu(e.currentTarget, 'mix', mix.id);
  const more = (e: React.MouseEvent<HTMLElement>) => void mixMenu(e.currentTarget, mix);

  return (
    <div className={s.page}>
      <PageHeader
        staticTitle
        image={pickImage(imgs, ['MEDIUM', 'LARGE', 'SMALL'])}
        imageSmall={pickImage(imgs, ['SMALL', 'MEDIUM'])}
        backdrop={pickImage(imgs, ['LARGE', 'MEDIUM'])}
        backdropBlur
        coverStyle={{ background: 'transparent' }}
        title={mix.title}
        titleStyle={titleStyle}
        subtitle={
          <span className={`${s.subtitleWrap} ellipsis`} title={subtitle}>
            <span className={s.subtitle} data-test="subtitle">
              {subtitle}
            </span>
          </span>
        }
        smallSubtitle={null}
        primary={
          <>
            <PillButton icon={playingThis ? 'pause' : 'play'} testId="play-all" onClick={() => play()} disabled={!items.length}>
              {playingThis ? 'Pause' : 'Play'}
            </PillButton>
            <PillButton icon="shuffle" variant="secondary" testId="shuffle-all" onClick={() => play(true)} disabled={!items.length}>
              Shuffle
            </PillButton>
          </>
        }
        actions={
          <>
            <div className={actionGroup}>
              <HeaderAction icon={fav ? 'heart-filled' : 'heart'} label={fav ? 'Added' : 'Add'} testId="favorite-button" role="switch" aria-checked={fav} onClick={() => void toggleFavorite(mix)} />
              <HeaderAction icon="share" label="Share" testId="share-button" onClick={share} />
            </div>
            <HeaderAction icon="more" label="More" testId="show-context-menu-button" className={naturalAction} onClick={more} />
          </>
        }
        compact={
          <>
            <div className={actionGroup}>
              <CompactAction icon={playingThis ? 'pause' : 'play'} label={playingThis ? 'Pause' : 'Play'} testId="play-all" dim onClick={() => play()} />
              <CompactAction icon="shuffle" label="Shuffle" testId="shuffle-all" dim onClick={() => play(true)} />
              <CompactAction icon={fav ? 'heart-filled' : 'heart'} label={fav ? 'Added' : 'Add'} testId="favorite-button" onClick={() => void toggleFavorite(mix)} />
              <CompactAction icon="share" label="Share" testId="share-button" onClick={share} />
            </div>
            <CompactAction icon="more" label="More" testId="show-context-menu-button" natural onClick={more} />
          </>
        }
      />
      <div className={s.module} data-test="occluded-module">
        {items.length ? <MediaTable items={items} columns={COLUMNS} source={source} rowActions="radio" /> : <p className={s.empty}>This mix has no tracks right now.</p>}
      </div>
    </div>
  );
}
