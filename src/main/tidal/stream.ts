// Playback info → manifest → (optionally decrypted) audio byte stream. Mirrors lumitide's stream_url().
import { pipeline, Readable, Transform } from 'node:stream';
import { TIDAL_UA } from './auth';
import { ctrDecipherAt, unwrapSecurityToken, type TrackKey } from './crypto';
import type { TidalHttp } from './http';

export type AudioQuality = 'LOW' | 'HIGH' | 'LOSSLESS' | 'HI_RES_LOSSLESS';

export interface StreamInfo {
  trackId: number;
  url: string;
  key: TrackKey | null;
  mimeType: string;
  codec: string;
  audioQuality: string;
  bitDepth?: number;
  sampleRate?: number;
  trackReplayGain?: number;
  albumReplayGain?: number;
  trackPeakAmplitude?: number;
  albumPeakAmplitude?: number;
}

interface PlaybackInfo {
  trackId: number;
  audioQuality: string;
  manifestMimeType: string;
  manifest: string;
  bitDepth?: number;
  sampleRate?: number;
  trackReplayGain?: number;
  albumReplayGain?: number;
  trackPeakAmplitude?: number;
  albumPeakAmplitude?: number;
}

interface BtsManifest {
  mimeType: string;
  codecs: string;
  encryptionType: string;
  keyId?: string;
  urls: string[];
}

export async function getStreamInfo(http: TidalHttp, trackId: number, quality: AudioQuality = 'LOSSLESS'): Promise<StreamInfo> {
  const session = await http.ensureSession();
  const info = await http.request<PlaybackInfo>({
    host: 'v1',
    path: `tracks/${trackId}/playbackinfopostpaywall`,
    query: {
      audioquality: quality,
      playbackmode: 'STREAM',
      assetpresentation: 'FULL',
      prefetchlevel: 'NONE',
      countryCode: session.countryCode,
    },
  });
  const decoded = Buffer.from(info.manifest, 'base64').toString('utf8');
  const common = {
    trackId,
    audioQuality: info.audioQuality,
    bitDepth: info.bitDepth,
    sampleRate: info.sampleRate,
    trackReplayGain: info.trackReplayGain,
    albumReplayGain: info.albumReplayGain,
    trackPeakAmplitude: info.trackPeakAmplitude,
    albumPeakAmplitude: info.albumPeakAmplitude,
  };

  if (info.manifestMimeType.includes('bts')) {
    const bts = JSON.parse(decoded) as BtsManifest;
    const url = bts.urls[0];
    if (!url) throw new Error('Empty URL list in manifest');
    let key: TrackKey | null = null;
    if (bts.encryptionType === 'OLD_AES') {
      if (!bts.keyId) throw new Error('Missing keyId for encrypted track');
      key = unwrapSecurityToken(bts.keyId);
    } else if (bts.encryptionType !== 'NONE') {
      throw new Error(`Unsupported encryption ${bts.encryptionType}`);
    }
    return { ...common, url, key, mimeType: bts.mimeType, codec: bts.codecs };
  }
  if (info.manifestMimeType.includes('dash')) {
    // only single-file DASH is handled (the desktop token gets BTS for every quality we request);
    // segmented manifests would need init + media segment assembly
    if (/<Segment(Template|List)/i.test(decoded)) throw new Error('Segmented DASH streams are not supported');
    const base = decoded.match(/<BaseURL>\s*([^<]+?)\s*<\/BaseURL>/)?.[1];
    if (!base) throw new Error('Could not extract BaseURL from DASH manifest');
    const codec = decoded.match(/codecs="([^"]+)"/)?.[1] ?? 'unknown';
    // DASH audio is always an MP4 container, even with FLAC inside (→ .m4a, never tagged as native FLAC)
    return { ...common, url: base.replace(/&amp;/g, '&'), key: null, mimeType: 'audio/mp4', codec };
  }
  throw new Error(`Unknown manifest type: ${info.manifestMimeType}`);
}

export interface AudioResponse {
  status: number; // 200 or 206
  total: number; // full file size
  start: number;
  end: number; // inclusive
  mimeType: string;
  body: Readable;
}

/** Fetch [start, end] of the track from the CDN and decrypt on the fly. */
export async function openAudio(info: StreamInfo, start = 0, end?: number, signal?: AbortSignal): Promise<AudioResponse> {
  const range = `bytes=${start}-${end ?? ''}`;
  const res = await fetch(info.url, { headers: { Range: range, 'User-Agent': TIDAL_UA }, signal });
  if (!res.ok || !res.body) throw new Error(`CDN returned ${res.status}`);
  const cr = res.headers.get('content-range'); // "bytes 0-1023/123456"
  const len = Number(res.headers.get('content-length') ?? 0);
  let total = len;
  let first = 0;
  let last = len - 1;
  if (cr) {
    const m = cr.match(/bytes (\d+)-(\d+)\/(\d+|\*)/);
    if (m) {
      first = Number(m[1]);
      last = Number(m[2]);
      total = m[3] === '*' ? last + 1 : Number(m[3]);
    }
  }
  let body: Readable = Readable.fromWeb(res.body as import('node:stream/web').ReadableStream<Uint8Array>);
  if (info.key) {
    const decipher = ctrDecipherAt(info.key, first);
    const decrypt = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        cb(null, decipher.update(chunk));
      },
      flush(cb) {
        cb(null, decipher.final());
      },
    });
    // pipeline (not .pipe) links both streams: aborting/destroying the consumer cancels the CDN fetch,
    // and source errors reach the consumer instead of becoming uncaught main-process exceptions
    body = pipeline(body, decrypt, () => {});
  }
  return { status: cr ? 206 : 200, total, start: first, end: last, mimeType: info.mimeType, body };
}
