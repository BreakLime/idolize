// Header "Share" popover and the "Report" action.
import { openMenu } from '../Menu';
import { shareItems } from '../menus';
import { openModal } from './Modal';

/** Share popover anchored to the header button (same content as the context-menu Share submenu). */
export function shareMenu(at: HTMLElement, kind: string, id: string | number) {
  openMenu(at, shareItems(kind, id), { align: 'end', width: 300 });
}

/** TIDAL opens a "Report Incorrect Content" form; we can't submit reports, so explain where to do it. */
export function reportContent(artistName?: string) {
  openModal('Report Incorrect Content', () => (
    <p style={{ color: 'var(--c-text-muted)', paddingBottom: 8 }}>
      {artistName ? `This music is currently on ${artistName}'s profile. ` : ''}
      Reporting incorrect content isn&apos;t available in Idolize. Please use the official TIDAL app or tidal.com to send a report.
    </p>
  ));
}
