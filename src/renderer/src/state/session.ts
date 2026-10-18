import type { AuthState } from '@shared/ipc';
import { create } from 'zustand';
import { session, user } from '@/api/tidal';
import { idol } from '@/lib/bridge';

export interface Profile {
  name: string;
  picture: string | null;
  email?: string;
  subscription?: string;
  highestSoundQuality?: string;
}

export const useSession = create<{ auth: AuthState | null; profile: Profile | null }>(() => ({ auth: null, profile: null }));

function apply(auth: AuthState) {
  if (auth.loggedIn) {
    session.userId = auth.userId ?? 0;
    session.countryCode = auth.countryCode ?? 'US';
  }
  useSession.setState({ auth });
  if (auth.loggedIn) void loadProfile();
}

async function loadProfile() {
  try {
    const [p, sub] = await Promise.all([user.profile(), user.subscription().catch(() => null)]);
    useSession.setState({
      profile: {
        name: p.profileName || [p.firstName, p.lastName].filter(Boolean).join(' ') || p.username || 'Profile',
        picture: p.picture ?? null,
        email: p.email,
        subscription: sub?.subscription?.type,
        highestSoundQuality: sub?.highestSoundQuality,
      },
    });
  } catch {
    /* profile is cosmetic */
  }
}

export async function initSession() {
  apply(await idol.auth.state());
  idol.on('auth:changed', apply);
}
