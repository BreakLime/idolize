// Settings → Account: profile, personal info and subscription (managed on TIDAL's website), plus Log out.
import { user } from '@/api/tidal';
import { confirmDialog } from '@/components/Dialog';
import { Icon } from '@/components/Icon';
import { idol } from '@/lib/bridge';
import { useQuery } from '@/lib/query';
import { useSession } from '@/state/session';
import { Group, LinkRow, Row, Section, settingsStyles as s, SmallButton } from './SettingsUi';
import a from './AccountTab.module.css';

const open = (url: string) => () => window.open(url, '_blank');

function ManageLink({ href, testId }: { href: string; testId: string }) {
  return (
    <a
      href={href}
      className={a.manage}
      data-test={testId}
      onClick={(e) => {
        e.preventDefault();
        window.open(href, '_blank');
      }}
    >
      <span>Manage</span>
      <Icon name="external-link" size={12} />
    </a>
  );
}

const planName = (type?: string) => {
  if (!type) return '—';
  if (/PREMIUM|HIFI/i.test(type)) return 'TIDAL';
  return type.charAt(0) + type.slice(1).toLowerCase().replace(/_/g, ' ');
};

export function AccountTab() {
  const profile = useSession((st) => st.profile);
  const { data: me } = useQuery(
    'settings:user',
    () => user.profile() as Promise<{ firstName?: string | null; username?: string; email?: string; profileName?: string | null }>,
  );
  const name = me?.profileName || [me?.firstName].filter(Boolean).join(' ');
  return (
    <div data-test="settings-page-account">
      <section>
        <Section offset={false}>
          <Group noFill>
            <div className={`${s.row} ${a.profileRow}`}>
              <div className={a.pictureWithName}>
                <div className={a.picture} data-test="profile-picture-fallback">
                  {profile?.picture ? <img src={profile.picture} alt="" /> : <Icon name="user" size={38} testId="icon-general-user" />}
                </div>
                <span className={a.name} data-test="profile-name">
                  {name}
                </span>
              </div>
              <button type="button" className={a.editProfile} data-test="edit-profile-button" onClick={open('https://account.tidal.com/profile/edit')}>
                <span>Edit profile</span>
              </button>
            </div>
          </Group>
        </Section>
      </section>
      <Section title="Personal info">
        <Group>
          <Row title="First name" description={me?.firstName ?? ''} descTestId="text-first-name">
            <ManageLink href="https://account.tidal.com/profile/edit" testId="button-manage-profile" />
          </Row>
          <Row title="Email" description={me?.email ?? profile?.email ?? ''} descTestId="text-email" />
        </Group>
      </Section>
      <Section title="Account">
        <Group>
          <Row title="Current subscription" description={planName(profile?.subscription)}>
            <ManageLink href="https://account.tidal.com/subscription" testId="button-manage-subscription" />
          </Row>
          <Row title="Username" description={me?.username ?? ''} descTestId="text-username" />
        </Group>
        <Group spaced>
          <LinkRow title="Notification settings" href="https://account.tidal.com/notifications" testId="link-manage-notifications" />
          <LinkRow title="Change password" href="https://account.tidal.com/profile/change-password" testId="link-change-password" />
        </Group>
        <Group spaced>
          <Row title="Log out" description="Sign out of Idolize on this computer.">
            <SmallButton
              testId="button-logout"
              onClick={async () => {
                if (await confirmDialog('Log out', 'Are you sure you want to log out of Idolize?', 'Log out', true)) await idol.auth.logout();
              }}
            >
              Log out
            </SmallButton>
          </Row>
        </Group>
      </Section>
    </div>
  );
}
