import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router';
import { Icon } from '@/components/Icon';
import { SearchPopover } from '@/components/search/SearchPopover';
import { openProfileMenu, ProfileMenuHost } from '@/components/settings/ProfileMenu';
import { useSession } from '@/state/session';
import s from './Header.module.css';

/** history.state.idx is maintained by react-router; used to enable/disable the arrows */
function useHistoryEdges() {
  const loc = useLocation();
  const type = useNavigationType();
  const [max, setMax] = useState(0);
  const idx = (window.history.state?.idx as number | undefined) ?? 0;
  useEffect(() => {
    // a push truncates forward history; back/forward (POP) and replace keep it
    setMax((m) => (type === 'PUSH' ? idx : Math.max(m, idx)));
  }, [loc.key, type, idx]);
  return { canBack: idx > 0, canForward: idx < max };
}

/** The header search field + popover lives in the search area (components/search/SearchPopover). */
const SearchField = SearchPopover;

export function Header() {
  const nav = useNavigate();
  const { canBack, canForward } = useHistoryEdges();
  const profile = useSession((st) => st.profile);

  // TIDAL's account menu (Profile, Manage subscription, Settings, Help, Legal, Log out)
  const profileMenu = (e: React.MouseEvent<HTMLButtonElement>) => openProfileMenu(e.currentTarget);

  return (
    <div className={s.layoutHeader} data-test="main-layout-header">
      <div className={s.header} data-test="header">
        <div className={s.arrows} data-test="navigation-arrows">
          <button type="button" className={s.arrow} disabled={!canBack} aria-label="Back" onClick={() => nav(-1)}>
            <Icon name="chevron-left" size={20} />
          </button>
          <button type="button" className={s.arrow} disabled={!canForward} aria-label="Forward" onClick={() => nav(1)}>
            <Icon name="chevron-right" size={20} />
          </button>
        </div>
        <div className={s.spacer} />
        <SearchField />
        <button type="button" className={s.profile} data-test="header-profile-menu-button" aria-label="Profile" onClick={profileMenu}>
          {profile?.picture ? (
            <img src={profile.picture} alt="" />
          ) : (
            <span className={s.fallback} data-test="profile-picture-fallback">
              <Icon name="user" size={32} testId="icon-general-user" style={{ padding: 6.4 }} />
            </span>
          )}
        </button>
        <ProfileMenuHost />
      </div>
    </div>
  );
}
