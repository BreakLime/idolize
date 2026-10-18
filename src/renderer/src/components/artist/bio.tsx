// Artist biography rendering. Bios come from the API at runtime and are only rendered, never stored.
import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router';

const decoder = typeof document !== 'undefined' ? document.createElement('textarea') : null;
function decode(s: string): string {
  if (!decoder) return s;
  decoder.innerHTML = s.replace(/</g, '&lt;');
  return decoder.value;
}

/** Splits API bio markup (`<br />`, `[wimpLink artistId="1"]Name[/wimpLink]`, entities) into paragraphs. */
export function bioParagraphs(raw: string): string[] {
  return raw
    .replace(/\r/g, '')
    .split(/(?:<br\s*\/?>\s*){2,}|\n{2,}/i)
    .map((p) =>
      p
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .trim(),
    )
    .filter(Boolean);
}

const LINK = /\[wimpLink\s+(artistId|albumId|trackId|playlistId)="([^"]+)"\]([\s\S]*?)\[\/wimpLink\]/g;

/** One paragraph with in-app links for [wimpLink] references. */
export function BioText({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK)) {
    if (m.index! > last) out.push(decode(text.slice(last, m.index)));
    const [, kind, id, label] = m;
    const to = kind === 'artistId' ? `/artist/${id}` : kind === 'albumId' ? `/album/${id}` : kind === 'trackId' ? `/track/${id}` : `/playlist/${id}`;
    out.push(
      <Link key={m.index} to={to} className="link">
        {decode(label)}
      </Link>,
    );
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(decode(text.slice(last)));
  return (
    <>
      {out.map((n, i) => (
        <Fragment key={i}>{n}</Fragment>
      ))}
    </>
  );
}

/** Plain-text excerpt (links flattened) for the 2-line header clamp. */
export function bioExcerpt(raw: string): string {
  return bioParagraphs(raw)
    .map((p) => decode(p.replace(LINK, '$3')))
    .join(' ');
}
