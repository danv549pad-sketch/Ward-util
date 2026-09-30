import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useDevice } from '@/lib/device-mode';

export const gameStoragePrefix = 'wardspace-game:';

/** A calendar date, not a UTC date: every visitor sees the same daily puzzle on the ward. */
export function londonDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Reproducible local randomness for date-based puzzles; not used for security. */
export function seededRandom(seed: string): () => number {
  let value = 2166136261;
  for (let index = 0; index < seed.length; index++) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return () => {
    value += 0x6D2B79F5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

/** Personal games stay in this browser; shared games last for this session only. */
export function useGameStorage<T>(key: string, initial: () => T): [T, Dispatch<SetStateAction<T>>] {
  const { mode, sessionActive } = useDevice();
  const storageKey = `${gameStoragePrefix}${key}`;
  const scopeKey = `${mode}:${sessionActive}:${storageKey}`;
  const previousScope = useRef(scopeKey);
  const read = (): T => {
    if (mode === 'shared' && !sessionActive) return initial();
    try {
      const saved = (mode === 'shared' ? sessionStorage : localStorage).getItem(storageKey);
      if (saved !== null) return JSON.parse(saved) as T;
    } catch { /* Storage may be unavailable; gameplay still works in memory. */ }
    return initial();
  };
  const [value, setValue] = useState<T>(read);
  useEffect(() => {
    if (previousScope.current !== scopeKey) {
      previousScope.current = scopeKey;
      setValue(read());
      return;
    }
    if (mode === 'shared' && !sessionActive) return;
    try {
      (mode === 'shared' ? sessionStorage : localStorage).setItem(storageKey, JSON.stringify(value));
    } catch { /* Keep the current game playable without persistent storage. */ }
  }, [mode, sessionActive, scopeKey, storageKey, value]);
  return [value, setValue];
}