// Normalized models used by the whole UI. Raw TIDAL payloads (v1, v2 home/artist/search) are mapped here once.
/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ArtistRef {
  id: number;
  name: string;
  picture?: string | null;
  main?: boolean;
}

export interface AlbumRef {
  id: number;
  title: string;
  cover: string | null;
  vibrantColor?: string | null;
  videoCover?: string | null;
  releaseDate?: string | null;
}

export interface Track {
  kind: 'track';
  id: number;
  title: string;
  version: string | null;
  duration: number;
  trackNumber: number;
  volumeNumber: number;
  explicit: boolean;
  audioQuality: string;
  mediaTags: string[];
  artists: ArtistRef[];
  album: AlbumRef;
  isrc?: string;
  copyright?: string;
  popularity?: number;
  streamable: boolean;
  mixId?: string;
  /** set for playlist items */
  dateAdded?: string;
  itemUuid?: string;
  upload?: boolean;
  /** independent upload picked by TIDAL editors (gold "Spotlighted track" badge) */
  spotlighted?: boolean;
  /** AI-labeled (openapi: track.ai, v1: album.ai) */
  ai?: boolean;
}

export interface Video {
  kind: 'video';
  id: number;
  title: string;
  version: string | null;
  duration: number;
  imageId: string | null;
  artists: ArtistRef[];
  explicit: boolean;
  releaseDate?: string;
}

export interface Album {
  kind: 'album';
  id: number;
  title: string;
  version: string | null;
  cover: string | null;
  vibrantColor: string | null;
  videoCover: string | null;
  artists: ArtistRef[];
  releaseDate: string | null;
  duration: number;
  numberOfTracks: number;
  numberOfVolumes: number;
  explicit: boolean;
  audioQuality: string;
  mediaTags: string[];
  type: string; // ALBUM | EP | SINGLE
  copyright?: string;
  upload?: boolean;
  payToStream?: boolean;
  /** AI-generated release ("AI" badge) */
  ai?: boolean;
}

export interface Artist {
  kind: 'artist';
  id: number;
  name: string;
  picture: string | null;
  popularity?: number;
  roles?: string[];
  mixId?: string;
}

export interface Playlist {
  kind: 'playlist';
  uuid: string;
  title: string;
  description: string;
  image: string | null; // wide
  squareImage: string | null;
  creatorId: number;
  creatorName: string | null;
  type: string; // USER | EDITORIAL | ARTIST
  numberOfTracks: number;
  numberOfVideos: number;
  duration: number;
  lastUpdated: string | null;
  created: string | null;
  isPublic?: boolean;
}

export interface MixImage {
  url: string;
  width: number;
  height: number;
}

export interface Mix {
  kind: 'mix';
  id: string;
  title: string;
  subTitle: string;
  shortSubtitle?: string;
  mixType: string;
  images: Record<string, MixImage>; // SMALL | MEDIUM | LARGE
  detailImages?: Record<string, MixImage>;
}

export interface Folder {
  kind: 'folder';
  id: string;
  name: string;
  numberOfItems: number;
  lastModifiedAt?: string;
}

export type MediaItem = Track | Video | Album | Artist | Playlist | Mix | Folder;

// ── normalizers ──────────────────────────────────────────────────────────────

const artistRefs = (raw: any): ArtistRef[] =>
  (raw?.artists ?? (raw?.artist ? [raw.artist] : [])).map((a: any) => ({
    id: a.id,
    name: a.name,
    picture: a.picture ?? null,
    main: a.main ?? a.type === 'MAIN',
  }));

export function toTrack(r: any): Track {
  return {
    kind: 'track',
    id: r.id,
    title: r.title,
    version: r.version ?? null,
    duration: r.duration ?? 0,
    trackNumber: r.trackNumber ?? 0,
    volumeNumber: r.volumeNumber ?? 1,
    explicit: !!r.explicit,
    audioQuality: r.audioQuality ?? 'LOSSLESS',
    mediaTags: r.mediaMetadata?.tags ?? [],
    artists: artistRefs(r),
    album: {
      id: r.album?.id ?? 0,
      title: r.album?.title ?? '',
      cover: r.album?.cover ?? null,
      vibrantColor: r.album?.vibrantColor ?? null,
      videoCover: r.album?.videoCover ?? null,
      releaseDate: r.album?.releaseDate ?? r.streamStartDate?.slice(0, 10) ?? null,
    },
    isrc: r.isrc,
    copyright: r.copyright,
    popularity: r.popularity,
    streamable: r.allowStreaming !== false && r.streamReady !== false,
    mixId: r.mixes?.TRACK_MIX,
    upload: !!r.upload,
    spotlighted: !!r.spotlighted,
    ai: !!(r.ai ?? r.album?.ai),
  };
}

export function toVideo(r: any): Video {
  return {
    kind: 'video',
    id: r.id,
    title: r.title,
    version: r.version ?? null,
    duration: r.duration ?? 0,
    imageId: r.imageId ?? r.image ?? null, // v1: imageId, v2 (artist/search modules): image
    artists: artistRefs(r),
    explicit: !!r.explicit,
    releaseDate: r.releaseDate,
  };
}

export function toAlbum(r: any): Album {
  return {
    kind: 'album',
    id: r.id,
    title: r.title,
    version: r.version ?? null,
    cover: r.cover ?? null,
    vibrantColor: r.vibrantColor ?? null,
    videoCover: r.videoCover ?? null,
    artists: artistRefs(r),
    releaseDate: r.releaseDate ?? null,
    duration: r.duration ?? 0,
    numberOfTracks: r.numberOfTracks ?? 0,
    numberOfVolumes: r.numberOfVolumes ?? 1,
    explicit: !!r.explicit,
    audioQuality: r.audioQuality ?? 'LOSSLESS',
    mediaTags: r.mediaMetadata?.tags ?? [],
    type: r.type ?? 'ALBUM',
    copyright: r.copyright,
    upload: !!r.upload,
    payToStream: !!r.payToStream,
    ai: !!r.ai,
  };
}

export function toArtist(r: any): Artist {
  return {
    kind: 'artist',
    id: r.id,
    name: r.name,
    picture: r.picture ?? r.selectedAlbumCoverFallback ?? null,
    popularity: r.popularity,
    roles: (r.artistRoles ?? []).map((x: any) => x.category),
    mixId: r.mixes?.ARTIST_MIX,
  };
}

export function toPlaylist(r: any): Playlist {
  return {
    kind: 'playlist',
    uuid: r.uuid,
    title: r.title,
    description: r.description ?? '',
    image: r.image ?? null,
    squareImage: r.squareImage ?? null,
    creatorId: r.creator?.id ?? r.userId ?? 0,
    creatorName: r.creator?.name ?? (r.creator?.id === 0 || r.creator?.type === 'TIDAL' || r.type === 'EDITORIAL' ? 'TIDAL' : r.promotedArtists?.[0]?.name || null),
    type: r.type ?? 'USER',
    numberOfTracks: r.numberOfTracks ?? 0,
    numberOfVideos: r.numberOfVideos ?? 0,
    duration: r.duration ?? 0,
    lastUpdated: r.lastUpdated ?? null,
    created: r.created ?? null,
    isPublic: r.publicPlaylist,
  };
}

/** v2 payloads list mix images as `[{ size: 'SMALL', url, … }]`; v1 keys them by size. */
const mixImages = (x: any): Record<string, MixImage> | undefined =>
  Array.isArray(x) ? Object.fromEntries(x.filter((i) => i?.size && i.url).map((i) => [i.size, i])) : (x ?? undefined);

export function toMix(r: any): Mix {
  return {
    kind: 'mix',
    id: r.id,
    title: r.title ?? r.titleTextInfo?.text ?? '',
    subTitle: r.subTitle ?? r.subtitleTextInfo?.text ?? r.subTitleTextInfo?.text ?? '',
    shortSubtitle: r.shortSubtitle ?? r.shortSubtitleTextInfo?.text,
    mixType: r.mixType ?? r.type ?? 'MIX',
    images: mixImages(r.images ?? r.mixImages) ?? {},
    detailImages: mixImages(r.detailImages ?? r.detailMixImages),
  };
}

/** v2 feed/artist/search items are `{ type, data }` envelopes. */
export function toMediaItem(type: string, data: any): MediaItem | null {
  switch (type) {
    case 'TRACK':
    case 'TRACKS':
    case 'UPLOADS':
      return toTrack(data);
    case 'VIDEO':
    case 'VIDEOS':
      return toVideo(data);
    case 'ALBUM':
    case 'ALBUMS':
      return toAlbum(data);
    case 'ARTIST':
    case 'ARTISTS':
      return toArtist(data);
    case 'PLAYLIST':
    case 'PLAYLISTS':
      return toPlaylist(data);
    case 'MIX':
      return toMix(data);
    default:
      return null;
  }
}

// ── display helpers ──────────────────────────────────────────────────────────

export const trackTitle = (t: { title: string; version: string | null }) =>
  t.version && !t.title.includes(t.version) ? `${t.title} (${t.version})` : t.title;

export const artistNames = (a: ArtistRef[]) => a.map((x) => x.name).join(', ');

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** "39:50" style album totals; "1 hr 12 min" for long ones (as TIDAL shows on headers). */
export function formatTotal(sec: number): string {
  if (sec < 3600) return formatDuration(sec);
  // round the total first so 1:59:30 becomes "2 hr 0 min", not "1 hr 60 min"
  const minutes = Math.round(sec / 60);
  return `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
}

export const itemKey = (i: MediaItem) => (i.kind === 'playlist' ? `playlist:${i.uuid}` : `${i.kind}:${i.id}`);

export function itemPath(i: MediaItem): string {
  switch (i.kind) {
    case 'track':
      return `/album/${i.album.id}/track/${i.id}`;
    case 'video':
      return `/video/${i.id}`;
    case 'album':
      return `/album/${i.id}`;
    case 'artist':
      return `/artist/${i.id}`;
    case 'playlist':
      return `/playlist/${i.uuid}`;
    case 'mix':
      return `/mix/${i.id}`;
    case 'folder':
      return `/folder/${i.id}`;
  }
}
