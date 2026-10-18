// The crowd on the stage: when the song's top YouTube comments (main/youtube.ts) come up, one card at a time whenever
// the show leaves room (it says when), the most liked first, a few seconds apart. Timed by the song's position:
// paused, a card waits; a jump back past it takes it down.
import type { CrowdComment } from '@shared/ipc';

export interface CrowdCard {
  key: number;
  comment: CrowdComment;
  side: 'left' | 'right';
  /** % from the stage's top */
  top: number;
  /** seconds it stays up */
  life: number;
}

const GAP_S = 3; // between cards
const FIRST_S = 4; // not in the song's first seconds

/** how long a card stays: long enough to read it */
export const lifeOf = (text: string) => Math.min(9, Math.max(4.5, 3.5 + 0.05 * text.length));

export class CrowdShow {
  private next = 0;
  private lastEnd = -Infinity;
  private from = 0;
  private count = 0;
  card: CrowdCard | null = null;

  constructor(private comments: CrowdComment[]) {}

  get size() {
    return this.comments.length;
  }

  /** The card up at `pos` (`room`: the show leaves room for one). */
  update(pos: number, room: boolean): CrowdCard | null {
    if (this.card && (pos >= this.from + this.card.life || pos < this.from - 0.5)) {
      this.card = null;
      this.lastEnd = pos;
    }
    if (!this.card && room && pos > FIRST_S && pos - this.lastEnd >= GAP_S && this.next < this.comments.length) {
      const c = this.comments[this.next++];
      const k = ++this.count;
      this.from = pos;
      // left and right in turn beside the wall (the lyrics are under it, no wider), higher or lower
      const top = k % 4 < 2 ? 11 + ((k * 7) % 9) : 59 + ((k * 5) % 6);
      this.card = { key: k, comment: c, side: k % 2 ? 'left' : 'right', top, life: lifeOf(c.text) };
    }
    return this.card;
  }
}
