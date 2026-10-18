// TIDAL bios embed link markup like [wimpLink artistId="1"]Name[/wimpLink] and <br/> breaks; reduce to plain paragraphs.
export function bioParagraphs(raw: string): string[] {
  return raw
    .replace(/\[wimpLink[^\]]*\]/g, '')
    .replace(/\[\/wimpLink\]/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}
