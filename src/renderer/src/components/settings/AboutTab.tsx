// Settings → About: Idolize's version and the open-source software it is built with.
import pkg from '../../../../../package.json';
import { IdolLogo } from '@/components/Icon';
import { toast } from '@/state/ui';
import { Group, Section, settingsStyles as s } from './SettingsUi';
import a from './AboutTab.module.css';

const ua = navigator.userAgent;
const electron = /Electron\/([\d.]+)/.exec(ua)?.[1];
const chrome = /Chrome\/([\d.]+)/.exec(ua)?.[1];
const VERSION = `${pkg.version} (Electron ${electron ?? '?'}, Chromium ${chrome?.split('.')[0] ?? '?'})`;

const CREDITS: { name: string; license: string; note: string }[] = [
  { name: 'Electron', license: 'MIT', note: 'Desktop shell (Chromium + Node.js)' },
  { name: 'React / React DOM', license: 'MIT', note: 'User interface' },
  { name: 'React Router', license: 'MIT', note: 'Navigation' },
  { name: 'Zustand', license: 'MIT', note: 'State management' },
  { name: 'TanStack Virtual', license: 'MIT', note: 'Virtualized lists' },
  { name: 'Koffi', license: 'MIT', note: 'Windows calls for the clear window' },
  { name: 'Vite / electron-vite', license: 'MIT', note: 'Build tooling' },
  { name: 'TypeScript', license: 'Apache-2.0', note: 'Language' },
  { name: 'Playwright, Vitest, pixelmatch, pngjs', license: 'Apache-2.0 / MIT / ISC / MIT', note: 'Testing and visual comparison' },
];

export function AboutTab() {
  const copy = () =>
    void navigator.clipboard
      .writeText(`Idolize ${VERSION}\n${ua}`)
      .then(() => toast('Version info copied'))
      .catch(() => toast('Could not copy'));
  return (
    <div data-test="settings-page-about">
      <Section>
        <Group>
          <div className={`${s.row} ${a.aboutRow}`}>
            <section className={a.versionRow}>
              <div className={a.logo} aria-hidden="true">
                <IdolLogo size={56} />
              </div>
              <div className={a.info}>
                <div className={a.version}>
                  <span className={a.versionTitle}>Version</span>
                  <span className={a.versionText} data-test="text-app-version">
                    {VERSION}
                  </span>
                </div>
                <div className={a.buttons}>
                  <button type="button" className={a.button} data-test="button-copy-version" onClick={copy}>
                    <span>Copy version info</span>
                  </button>
                </div>
              </div>
            </section>
          </div>
        </Group>
      </Section>
      <span className={a.licenseTitle}>Idolize is built using the following:</span>
      <div className={a.licenses} data-test="licenses">
        <p className={a.disclaimer}>
          Idolize is an independent desktop client. It is not made, endorsed or supported by TIDAL; “TIDAL” is a trademark of its owner. Music, artwork and
          texts are streamed from TIDAL at runtime for your own account and are never bundled with the app.
        </p>
        <table className={a.table}>
          <tbody>
            {CREDITS.map((c) => (
              <tr key={c.name}>
                <td className={a.pkg}>{c.name}</td>
                <td className={a.note}>{c.note}</td>
                <td className={a.license}>{c.license}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
