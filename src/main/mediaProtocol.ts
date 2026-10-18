// idol-media://track/<id>?q=<quality> — serves decrypted audio to <audio> with full Range support.
import { protocol } from 'electron';
import { Readable } from 'node:stream';
import { MEDIA_SCHEME, type AudioQuality, type StreamMeta } from '../shared/ipc';
import type { TidalHttp } from './tidal/http';
import { getStreamInfo, openAudio, type StreamInfo } from './tidal/stream';

// CDN URLs are signed and expire; re-resolve after this long (and on any CDN error).
const TTL_MS = 10 * 60_000;
const cache = new Map<string, { info: StreamInfo; at: number }>();

async function resolve(http: TidalHttp, trackId: number, quality: AudioQuality, fresh = false): Promise<StreamInfo> {
  const k = `${trackId}:${quality}`;
  const hit = cache.get(k);
  if (!fresh && hit && Date.now() - hit.at < TTL_MS) return hit.info;
  const info = await getStreamInfo(http, trackId, quality);
  cache.set(k, { info, at: Date.now() });
  if (cache.size > 64) cache.delete(cache.keys().next().value!);
  return info;
}

export async function prepareStream(http: TidalHttp, trackId: number, quality: AudioQuality): Promise<StreamMeta> {
  const info = await resolve(http, trackId, quality);
  return {
    trackId,
    url: `${MEDIA_SCHEME}://track/${trackId}?q=${quality}`,
    audioQuality: info.audioQuality,
    codec: info.codec,
    bitDepth: info.bitDepth,
    sampleRate: info.sampleRate,
    trackReplayGain: info.trackReplayGain,
    albumReplayGain: info.albumReplayGain,
    trackPeakAmplitude: info.trackPeakAmplitude,
    albumPeakAmplitude: info.albumPeakAmplitude,
  };
}

export const mediaSchemePrivileges = {
  scheme: MEDIA_SCHEME,
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true, corsEnabled: true },
};

export function registerMediaProtocol(http: TidalHttp) {
  protocol.handle(MEDIA_SCHEME, async (req) => {
    const u = new URL(req.url);
    const trackId = Number(u.pathname.replace(/^\//, ''));
    const quality = (u.searchParams.get('q') ?? 'LOSSLESS') as AudioQuality;
    if (u.hostname !== 'track' || !Number.isFinite(trackId)) return new Response('bad media url', { status: 400 });

    const m = req.headers.get('range')?.match(/bytes=(\d*)-(\d*)/);
    const start = m?.[1] ? Number(m[1]) : 0;
    const end = m?.[2] ? Number(m[2]) : undefined;
    try {
      let audio;
      try {
        audio = await openAudio(await resolve(http, trackId, quality), start, end);
      } catch {
        audio = await openAudio(await resolve(http, trackId, quality, true), start, end);
      }
      const body = Readable.toWeb(audio.body) as unknown as ReadableStream<Uint8Array>;
      return new Response(body, {
        status: req.headers.has('range') ? 206 : 200,
        headers: {
          'Content-Type': audio.mimeType,
          'Content-Length': String(audio.end - audio.start + 1),
          'Content-Range': `bytes ${audio.start}-${audio.end}/${audio.total}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-store',
          // the renderer routes audio through WebAudio (normalization), which needs CORS-clean media
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (e) {
      return new Response(String(e), { status: 502 });
    }
  });
}
