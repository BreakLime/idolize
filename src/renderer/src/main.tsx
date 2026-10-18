// (first: preferences stored under the app's old name move to the new one before anything reads them)
import '@/lib/renamed';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { initCommands, onCommand } from '@/lib/commands';
import { navigate } from '@/lib/navigation';
import { idol } from '@/lib/bridge';
import { Login } from '@/pages/Login';
import { engineDebug, startEngine } from '@/player/engine';
import { bandLevels, GrooveDetector } from '@/player/groove';
import { danceDebug } from '@/player/logoDance';
import { findPeak } from '@/stage/peak';
import { songMap } from '@/stage/songmap';
import { stageDebug } from '@/stage/Stage';
import * as tidalApi from '@/api/tidal';
import { router } from '@/router';
import { loadFavorites } from '@/state/favorites';
import { player, usePlayer } from '@/state/player';
import { initSession, useSession } from '@/state/session';
import { initSettings, useSettings } from '@/state/settings';
import { initWindowState, useWindowState } from '@/state/window';
import '@/styles/global.css';

function wireCommands() {
  initCommands();
  onCommand('navigate:home', () => navigate('/'));
  onCommand('navigate:explore', () => navigate('/view/pages/explore'));
  onCommand('navigate:back', () => navigate(-1));
  onCommand('navigate:forward', () => navigate(1));
  onCommand('navigate:settings', () => navigate('/settings/general'));
  onCommand('playback:toggle', player.toggle);
  onCommand('playback:next', () => player.next());
  onCommand('playback:previous', player.previous);
  onCommand('playback:shuffle', player.toggleShuffle);
  onCommand('playback:repeat', player.cycleRepeat);
  onCommand('playback:repeat-off', () => usePlayer.setState({ repeat: 'off' }));
  onCommand('playback:repeat-all', () => usePlayer.setState({ repeat: 'all' }));
  onCommand('playback:repeat-one', () => usePlayer.setState({ repeat: 'one' }));
  onCommand('playback:seek-forward', () => player.seek(Math.min(usePlayer.getState().duration, usePlayer.getState().currentTime + 10)));
  onCommand('playback:seek-backward', () => player.seek(Math.max(0, usePlayer.getState().currentTime - 10)));
  onCommand('playback:volume-up', () => player.setVolume(usePlayer.getState().volume + 0.05));
  onCommand('playback:volume-down', () => player.setVolume(usePlayer.getState().volume - 0.05));
  onCommand('app:logout', () => void idol.auth.logout());
  // Help → About: TIDAL opens its About view (Settings → About)
  onCommand('app:about', () => navigate('/settings/about'));
}

/** Mirrors the window's transparency (the backdrop is set by main) on the document. */
function useTransparency() {
  const tint = useSettings((st) => st.settings?.transparencyTint ?? 0.75);
  const transparency = useWindowState((w) => w.transparency);
  useEffect(() => {
    document.documentElement.dataset.transparent = String(transparency !== 'off');
    document.documentElement.style.setProperty('--tint', String(tint));
  }, [tint, transparency]);
}

function App() {
  const auth = useSession((st) => st.auth);
  const [ready, setReady] = useState(false);
  useTransparency();
  useEffect(() => {
    if (!auth?.loggedIn || ready) return;
    startEngine();
    void loadFavorites().catch(() => {});
    setReady(true);
  }, [auth, ready]);
  if (!auth) return null;
  if (!auth.loggedIn) return <Login />;
  return <RouterProvider router={router} />;
}

/** Debug/test handle (used by tools/compare and tests/e2e to drive and observe the app). */
function exposeDebug() {
  Object.assign(window, { __idol: { player, usePlayer, engineDebug, api: tidalApi, navigate, groove: { GrooveDetector, bandLevels }, danceDebug, stageDebug, stage: { songMap, findPeak } } });
}

async function boot() {
  exposeDebug();
  await Promise.all([initSettings(), initSession(), initWindowState()]);
  wireCommands();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
