// Tiny stale-while-revalidate cache for API reads. Navigating back to a page renders instantly from cache.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

interface Entry<T> {
  data?: T;
  error?: unknown;
  at: number;
  promise?: Promise<T>;
}

const cache = new Map<string, Entry<unknown>>();
const listeners = new Map<string, Set<() => void>>();
const STALE_MS = 60_000;

function notify(key: string) {
  listeners.get(key)?.forEach((l) => l());
}

/** bumped by invalidate(): a response that was already in flight is then stored as stale, not fresh */
const generations = new Map<string, number>();

export function fetchQuery<T>(key: string, fn: () => Promise<T>, force = false): Promise<T> {
  const e = cache.get(key) as Entry<T> | undefined;
  if (e?.promise) return e.promise;
  if (!force && e?.data !== undefined && Date.now() - e.at < STALE_MS) return Promise.resolve(e.data);
  const gen = generations.get(key) ?? 0;
  const promise = fn().then(
    (data) => {
      const invalidatedMeanwhile = (generations.get(key) ?? 0) !== gen;
      cache.set(key, { data, at: invalidatedMeanwhile ? 0 : Date.now() });
      notify(key);
      return data;
    },
    (error: unknown) => {
      cache.set(key, { ...cache.get(key), error, at: Date.now(), promise: undefined });
      notify(key);
      throw error;
    },
  );
  cache.set(key, { ...(e ?? { at: 0 }), promise });
  return promise;
}

export function setQueryData<T>(key: string, update: T | ((prev: T | undefined) => T)) {
  const prev = cache.get(key) as Entry<T> | undefined;
  const data = typeof update === 'function' ? (update as (p: T | undefined) => T)(prev?.data) : update;
  cache.set(key, { data, at: Date.now() });
  notify(key);
}

/** Shows the first part of a list while its full fetch is still running; readers keep deduping onto that fetch. */
export function setQueryPartial<T>(key: string, data: T) {
  const e = cache.get(key);
  if (!e?.promise) return;
  cache.set(key, { ...e, data });
  notify(key);
}

export function invalidate(prefix: string) {
  for (const k of cache.keys())
    if (k.startsWith(prefix)) {
      generations.set(k, (generations.get(k) ?? 0) + 1);
      cache.set(k, { ...cache.get(k)!, at: 0 });
    }
  for (const k of listeners.keys()) if (k.startsWith(prefix)) notify(k);
}

export interface QueryState<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  /** a fetch is running (first load, a partial list being completed, or revalidation) */
  pending: boolean;
  refetch: () => Promise<T>;
}

/** `key` null disables the query. */
export function useQuery<T>(key: string | null, fn: () => Promise<T>): QueryState<T> {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const subscribe = useCallback(
    (cb: () => void) => {
      if (!key) return () => {};
      let set = listeners.get(key);
      if (!set) listeners.set(key, (set = new Set()));
      set.add(cb);
      return () => set!.delete(cb);
    },
    [key],
  );
  const entry = useSyncExternalStore(subscribe, () => (key ? (cache.get(key) as Entry<T> | undefined) : undefined));
  const [, force] = useState(0);
  // invalidate() zeroes `at`; mounted readers refetch right away instead of on their next mount
  const invalidated = !!entry && entry.at === 0 && !entry.promise;

  useEffect(() => {
    if (!key) return;
    const e = cache.get(key);
    if (!e || (Date.now() - e.at > STALE_MS && !e.promise)) fetchQuery(key, () => fnRef.current()).catch(() => force((n) => n + 1));
  }, [key, invalidated]);

  return {
    data: entry?.data,
    error: entry?.error,
    loading: !!key && entry?.data === undefined && !entry?.error,
    pending: !!entry?.promise,
    refetch: () => fetchQuery(key!, () => fnRef.current(), true),
  };
}
