// Settings → General: TIDAL's audio quality / playback / display / preferences, plus Idolize's window appearance.
import type { AudioQuality, Settings, Transparency } from '@shared/ipc';
import { useEffect, useState } from 'react';
import { setPrefs, usePrefs, type PlayerBackground } from '@/components/player/prefs';
import { idol } from '@/lib/bridge';
import { outputDevice, relaunchApp, setOutputDevice } from '@/player/engine';
import { updateSettings } from '@/state/settings';
import { useWindowState } from '@/state/window';
import { Group, LinkRow, Row, Section, Select, settingsStyles as s, SmallButton, Toggle } from './SettingsUi';

type Patch = (p: Partial<Settings>) => void;

function QualityRow({
  title,
  desc,
  selected,
  onSelect,
  test,
  extra,
}: {
  title: string;
  desc: string;
  selected: boolean;
  onSelect: () => void;
  test: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className={`${s.row} ${s.qualityRow} ${selected ? s.qualitySelected : ''}`}>
      <button type="button" className={s.qualityButton} data-test={test} aria-label={title} aria-pressed={selected} onClick={onSelect}>
        <span className={s.radio}>
          <span className={s.radioDot} />
        </span>
        <span className={s.qualityText}>
          <span className={s.qualityTitle}>{title}</span>
          <span className={s.qualityDesc}>{desc}</span>
        </span>
      </button>
      {extra && <div className={s.qualityExtra}>{extra}</div>}
    </div>
  );
}

function AudioQualitySection({ q, set }: { q: AudioQuality; set: Patch }) {
  const low = q === 'LOW' || q === 'HIGH';
  return (
    <Section title="Audio quality">
      <Group>
        <QualityRow
          title="Low"
          desc="Balance audio quality and data consumption"
          test="audio-quality-low"
          selected={low}
          onSelect={() => !low && set({ streamingQuality: 'HIGH' })}
          extra={
            <Select<AudioQuality>
              testId="audio-quality-low-select"
              label="Selected bitrate for Low quality"
              width={86.67}
              value={q === 'LOW' ? 'LOW' : 'HIGH'}
              options={[
                { value: 'LOW', label: '96 kbps' },
                { value: 'HIGH', label: '320 kbps' },
              ]}
              onChange={(v) => set({ streamingQuality: v })}
            />
          }
        />
        <QualityRow
          title="High"
          desc="16-bit, 44.1 kHz"
          test="audio-quality-high"
          selected={q === 'LOSSLESS'}
          onSelect={() => set({ streamingQuality: 'LOSSLESS' })}
        />
        <QualityRow
          title="Max"
          desc="Up to 24-bit, 192 kHz"
          test="audio-quality-max"
          selected={q === 'HI_RES_LOSSLESS'}
          onSelect={() => set({ streamingQuality: 'HI_RES_LOSSLESS' })}
        />
      </Group>
    </Section>
  );
}

function useOutputDevices() {
  const [devices, setDevices] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    const load = () =>
      navigator.mediaDevices
        ?.enumerateDevices()
        .then((list) =>
          setDevices(
            list
              .filter((d) => d.kind === 'audiooutput' && d.deviceId !== 'default' && d.deviceId !== 'communications')
              .map((d, i) => ({ value: d.deviceId, label: d.label || `Output ${i + 1}` })),
          ),
        )
        .catch(() => {});
    void load();
    navigator.mediaDevices?.addEventListener('devicechange', load);
    return () => navigator.mediaDevices?.removeEventListener('devicechange', load);
  }, []);
  return devices;
}

function PlaybackSection({ st, set }: { st: Settings; set: Patch }) {
  const devices = useOutputDevices();
  const [sink, setSink] = useState(outputDevice());
  return (
    <Section title="Playback">
      <Group>
        <Row title="Normalize volume" description="Set the same volume level for all tracks.">
          <Toggle
            label="Normalize volume"
            testId="switch-volume-normalization"
            checked={st.loudnessNormalization}
            onChange={(v) => set({ loudnessNormalization: v })}
          />
        </Row>
        {st.loudnessNormalization && (
          <Row title="Normalization mode" description="Track: every track at the same loudness. Album: keep the album's own dynamics.">
            <Select<Settings['normalizationMode']>
              testId="select-normalization-mode"
              label="Normalization mode"
              width={140}
              value={st.normalizationMode}
              options={[
                { value: 'track', label: 'Track' },
                { value: 'album', label: 'Album' },
              ]}
              onChange={(v) => set({ normalizationMode: v })}
            />
          </Row>
        )}
        <Row title="Sound output">
          <Select<string>
            testId="select-sound-output"
            label="Sound output"
            width={326.67}
            block
            value={devices.some((d) => d.value === sink) ? sink : ''}
            options={[{ value: '', label: 'System Default' }, ...devices]}
            onChange={(v) => {
              setSink(v);
              void setOutputDevice(v);
            }}
          />
        </Row>
      </Group>
      <Group spaced>
        <Row title="Autoplay" description="Keep playing similar content when your queue ends.">
          <Toggle label="Autoplay" testId="switch-autoplay" checked={st.autoplay} onChange={(v) => set({ autoplay: v })} />
        </Row>
        <Row
          title="Allow explicit content"
          description="When on, music labeled with the E badge will be playable. To prevent explicit music from playing, switch this off. Videos aren't included. (Tracks will appear greyed out.)"
        >
          <Toggle label="Allow explicit content" testId="switch-explicit-content" checked={st.explicitContent} onChange={(v) => set({ explicitContent: v })} />
        </Row>
        <Row
          title="Allow AI content"
          description="When on, music labeled with the AI badge will be playable. To prevent AI-labeled music from playing, switch this off. (Tracks will appear greyed out.)"
        >
          <Toggle label="Allow AI content" testId="switch-ai-content" checked={st.aiContent} onChange={(v) => set({ aiContent: v })} />
        </Row>
      </Group>
      <Group spaced>
        <LinkRow title="Blocked" description="View and edit your blocked content." to="/settings/blocks" testId="link-blocked-content" />
      </Group>
    </Section>
  );
}

interface CardOption<T extends string> {
  value: T;
  label: string;
  preview: React.CSSProperties;
  test: string;
  disabled?: boolean;
}

function CardChoice<T extends string>({
  title,
  desc,
  options,
  value,
  onChange,
  testId,
  label,
}: {
  title: string;
  desc: string;
  options: CardOption<T>[];
  value: T;
  onChange: (v: T) => void;
  testId: string;
  label: string;
}) {
  return (
    <div className={`${s.cardsRow}`} data-test={testId}>
      <div className={s.cardsInfo}>
        <span className={s.cardsTitle}>{title}</span>
        <span className={s.cardsDesc}>{desc}</span>
      </div>
      <div className={s.cards} role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className={`${s.card} ${o.disabled ? s.cardDisabled : ''}`}
            data-test={o.test}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
          >
            <span className={`${s.preview} ${value === o.value ? s.previewSelected : ''}`}>
              <span className={s.previewInner} style={o.preview} />
            </span>
            <span className={`${s.cardLabel} ${value === o.value ? s.cardLabelOn : ''}`}>{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const BACKGROUNDS: CardOption<PlayerBackground>[] = [
  { value: 'color', label: 'Color', test: 'appearance-color', preview: { backgroundImage: 'linear-gradient(rgb(188, 74, 60) 0%, rgb(146, 52, 46) 100%)' } },
  {
    value: 'blur',
    label: 'Blur',
    test: 'appearance-blur',
    preview: {
      backgroundImage: 'linear-gradient(165deg, rgb(64, 104, 156) 0%, rgb(150, 84, 86) 52%, rgb(170, 66, 52) 80%, rgb(118, 42, 42) 100%)',
      transform: 'scale(1.4)',
      filter: 'blur(6px)',
    },
  },
];

const TRANSPARENCY: CardOption<Transparency>[] = [
  { value: 'off', label: 'Off', test: 'transparency-off', preview: { background: '#000' } },
  {
    value: 'acrylic',
    label: 'Acrylic',
    test: 'transparency-acrylic',
    preview: { backgroundImage: 'linear-gradient(135deg, rgba(90, 120, 170, 0.75), rgba(40, 40, 48, 0.85))', backdropFilter: 'blur(4px)' },
  },
  { value: 'mica', label: 'Mica', test: 'transparency-mica', preview: { backgroundImage: 'linear-gradient(135deg, rgb(52, 56, 70), rgb(30, 30, 36))' } },
  // no blur: the desktop stays sharp behind the tint
  {
    value: 'clear',
    label: 'Clear',
    test: 'transparency-clear',
    preview: { backgroundImage: 'linear-gradient(135deg, rgba(90, 120, 170, 0.6) 50%, rgba(150, 80, 110, 0.6) 50%)' },
  },
];

// the desktop behind the window, sharp (or as the window's acrylic / mica shows it) or acrylic
const DESKTOP_BACKGROUNDS: CardOption<PlayerBackground>[] = [
  {
    value: 'transparent',
    label: 'Transparent',
    test: 'appearance-transparent',
    preview: { backgroundImage: 'linear-gradient(135deg, rgba(90, 120, 170, 0.6) 50%, rgba(150, 80, 110, 0.6) 50%)' },
  },
  {
    value: 'acrylic',
    label: 'Acrylic',
    test: 'appearance-acrylic',
    preview: { backgroundImage: 'linear-gradient(135deg, rgba(90, 120, 170, 0.75), rgba(40, 40, 48, 0.85))' },
  },
];

function DisplaySection({ st, set }: { st: Settings; set: Patch }) {
  const playerBackground = usePrefs((p) => p.playerBackground);
  const dancingLogo = usePrefs((p) => p.dancingLogo);
  const stageComments = usePrefs((p) => p.stageComments);
  // Transparent shows what the window shows behind the app: nothing while the window is opaque
  const opaqueWindow = useWindowState((w) => w.transparency === 'off');
  const backgrounds = [...BACKGROUNDS, ...DESKTOP_BACKGROUNDS.map((o) => ({ ...o, disabled: o.value === 'transparent' && opaqueWindow }))];
  // live preview while dragging; persisted on release
  const [tint, setTint] = useState(st.transparencyTint);
  useEffect(() => setTint(st.transparencyTint), [st.transparencyTint]);
  const applyTint = (v: number) => document.documentElement.style.setProperty('--tint', String(v));
  // Clear is a different kind of window, so switching to or from it takes a restart
  const clearWindow = useWindowState((w) => w.clearWindow);
  const needsRestart = idol.platform === 'win32' && (st.transparency === 'clear') !== clearWindow;
  return (
    <Section title="Display">
      <Group>
        <CardChoice
          title="Player background"
          desc={`Choose your preferred look for the Now Playing view.${opaqueWindow ? ' Transparent needs a window transparency (below).' : ''}`}
          testId="appearance-settings"
          label="Player background"
          options={backgrounds}
          value={playerBackground}
          onChange={(v) => setPrefs({ playerBackground: v })}
        />
        <Row title="Dancing logo" description="The idol in the top left moves with the music: a nod on the beat, a jump when the drop hits.">
          <Toggle label="Dancing logo" testId="switch-dancing-logo" checked={dancingLogo} onChange={(v) => setPrefs({ dancingLogo: v })} />
        </Row>
        <Row title="Comments on the stage" description="In the calm parts of a song, the stage shows its top YouTube comments. The song's artist and title are searched on YouTube.">
          <Toggle label="Comments on the stage" testId="switch-stage-comments" checked={stageComments} onChange={(v) => setPrefs({ stageComments: v })} />
        </Row>
      </Group>
      <Group spaced>
        <CardChoice
          title="Window transparency"
          desc="Let the Windows desktop shine through the app (Windows 11)."
          testId="transparency-settings"
          label="Window transparency"
          options={TRANSPARENCY}
          value={st.transparency}
          onChange={(v) => set({ transparency: v })}
        />
        <Row title="Tint" description="How dark the glass is. Lower shows more of the desktop.">
          <div className={s.rowControls}>
            <input
              type="range"
              className={s.range}
              data-test="range-transparency-tint"
              aria-label="Transparency tint"
              min={0.2}
              max={0.95}
              step={0.01}
              value={tint}
              disabled={st.transparency === 'off'}
              onChange={(e) => {
                const v = Number(e.target.value);
                setTint(v);
                applyTint(v);
              }}
              onPointerUp={() => set({ transparencyTint: tint })}
              onKeyUp={() => set({ transparencyTint: tint })}
            />
            <span className={s.rangeValue}>{Math.round(tint * 100)}%</span>
          </div>
        </Row>
        {needsRestart && (
          <Row
            title="Restart to apply"
            testId="transparency-restart"
            description={
              st.transparency === 'clear'
                ? 'Clear switches to a see-through window, which takes a restart.'
                : 'Leaving Clear switches back to the standard window, which takes a restart.'
            }
          >
            <SmallButton testId="button-restart" onClick={relaunchApp}>
              Restart now
            </SmallButton>
          </Row>
        )}
      </Group>
    </Section>
  );
}

const ZOOMS = [-2, -1, -0.5, 0, 0.5, 1, 2];
const zoomLabel = (z: number) => `${Math.round(Math.pow(1.2, z) * 100)}%`;

function PreferencesSection({ st, set }: { st: Settings; set: Patch }) {
  return (
    <Section title="Preferences">
      <Group>
        <Row title="Zoom" description="Interface scale (Ctrl + / Ctrl − / Ctrl 0).">
          <Select<string>
            testId="select-zoom"
            label="Zoom"
            width={120}
            value={String(st.zoom)}
            // the shortcuts reach ±5 in half steps: show such a level too instead of pretending 100%
            options={[...new Set([...ZOOMS, st.zoom])].sort((a, b) => a - b).map((z) => ({ value: String(z), label: zoomLabel(z) }))}
            onChange={(v) => set({ zoom: Number(v) })}
          />
        </Row>
        <Row title="Close to tray" description="Close button should minimize the app to the system tray.">
          <Toggle label="Close to tray" testId="switch-close-to-tray" checked={st.closeToTray} onChange={(v) => set({ closeToTray: v })} />
        </Row>
      </Group>
      <Group spaced>
        <LinkRow title="Terms & Conditions" href="https://tidal.com/terms" testId="link-terms-and-conditions" />
        <LinkRow title="Privacy Notice" href="https://tidal.com/privacy" testId="link-privacy-policy" />
      </Group>
    </Section>
  );
}

export function GeneralTab({ st }: { st: Settings }) {
  const set: Patch = (p) => void updateSettings(p);
  return (
    <div data-test="settings-page-general">
      <AudioQualitySection q={st.streamingQuality} set={set} />
      <PlaybackSection st={st} set={set} />
      <DisplaySection st={st} set={set} />
      <PreferencesSection st={st} set={set} />
    </div>
  );
}
