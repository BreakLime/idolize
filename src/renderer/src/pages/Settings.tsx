// /settings/:tab — TIDAL's General / Account / About tabs and the Blocked page.
import { Navigate, useParams } from 'react-router';
import { AboutTab } from '@/components/settings/AboutTab';
import { AccountTab } from '@/components/settings/AccountTab';
import { BlocksTab } from '@/components/settings/BlocksTab';
import { GeneralTab } from '@/components/settings/GeneralTab';
import { settingsStyles as s, TextTabs } from '@/components/settings/SettingsUi';
import { useSettings } from '@/state/settings';

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'account', label: 'Account' },
  { id: 'about', label: 'About' },
] as const;

export default function Settings() {
  const { tab = 'general' } = useParams();
  const st = useSettings((x) => x.settings);
  if (tab === 'blocks') return <BlocksTab />;
  if (!TABS.some((t) => t.id === tab)) return <Navigate to="/settings/general" replace />;

  return (
    <div className={s.page} data-test="settings-page">
      <div className={s.header}>
        <h1 className={s.title}>Settings</h1>
      </div>
      <TextTabs active={tab} tabs={TABS.map((t) => ({ id: t.id, label: t.label, to: `/settings/${t.id}`, testId: `settings-tab--${t.id}` }))} />
      {tab === 'general' && st && <GeneralTab st={st} />}
      {tab === 'account' && <AccountTab />}
      {tab === 'about' && <AboutTab />}
    </div>
  );
}
