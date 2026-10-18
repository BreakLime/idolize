// The app was called tidal-idol before Idolize: its stored preferences (player, prefs, recent searches, sidebar
// order…) move to the new keys once, before anything reads them. Imported first by main.tsx.
const OLD = 'tidal-idol:';

try {
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith(OLD)) continue;
    const renamed = `idolize:${key.slice(OLD.length)}`;
    if (localStorage.getItem(renamed) === null) localStorage.setItem(renamed, localStorage.getItem(key) ?? '');
    localStorage.removeItem(key);
  }
} catch {
  /* no storage: nothing to move */
}

export {};
