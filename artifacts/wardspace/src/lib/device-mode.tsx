import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { getGetWardStaffStatusQueryKey, getListStaffRequestsQueryKey, getListWardItemsQueryKey } from '@workspace/api-client-react';

export type DeviceMode = 'personal' | 'shared';
const modeKey = 'wardspace-device-mode';
export const sharedStuffKey = 'wardspace-shared-my-stuff';
const activeKey = 'wardspace-shared-session-active';
const lastActivityKey = 'wardspace-shared-last-activity';
const resetSignalKey = 'wardspace-shared-reset-signal';
const configuredMinutes = Number(import.meta.env.VITE_SHARED_IDLE_MINUTES);
export const sharedIdleMs = Number.isFinite(configuredMinutes) && configuredMinutes > 0
  ? Math.max(1000, Math.min(configuredMinutes * 60000, 120 * 60000))
  : 10 * 60000;

function clearSharedStorage() {
  try {
    sessionStorage.removeItem(sharedStuffKey);
    sessionStorage.removeItem(activeKey);
    sessionStorage.removeItem(lastActivityKey);
  } catch { /* No shared data is ever read when storage is unavailable. */ }
}

function initialMode(): DeviceMode {
  const selected = new URLSearchParams(window.location.search).get('mode');
  let previous: string | null = null;
  try { previous = localStorage.getItem(modeKey); } catch { /* use the safe default */ }
  // A shared tablet cannot be switched back to persistent personal storage with a public URL.
  // Changing it back requires the authenticated staff setting.
  const mode: DeviceMode = selected === 'shared' ? 'shared' : previous === 'shared' ? 'shared' : 'personal';
  if (selected === 'personal' || selected === 'shared') {
    if (previous !== mode) clearSharedStorage();
    try { localStorage.setItem(modeKey, mode); } catch { /* remains set for this page only */ }
    const url = new URL(window.location.href);
    url.searchParams.delete('mode');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }
  return mode;
}

function initialSession(mode: DeviceMode) {
  if (mode !== 'shared') return false;
  try {
    const active = sessionStorage.getItem(activeKey) === '1';
    const last = Number(sessionStorage.getItem(lastActivityKey));
    if (active && last > 0 && Date.now() - last < sharedIdleMs) return true;
  } catch { /* fail closed */ }
  clearSharedStorage();
  return false;
}

type DeviceContextValue = {
  mode: DeviceMode;
  sessionActive: boolean;
  resetVersion: number;
  clearedNotice: boolean;
  logoutError: boolean;
  setMode: (mode: DeviceMode) => boolean;
  startSession: () => boolean;
  clearSession: () => void;
  dismissNotice: () => void;
  setLogoutError: (failed: boolean) => void;
};
const DeviceContext = createContext<DeviceContextValue | null>(null);

export function DeviceProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [,navigate] = useLocation();
  const [mode, setCurrentMode] = useState<DeviceMode>(initialMode);
  const [sessionActive, setSessionActive] = useState(() => initialSession(mode));
  const [resetVersion, setResetVersion] = useState(0);
  const [clearedNotice, setClearedNotice] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const setMode = useCallback((next: DeviceMode) => {
    if (next === mode) return true;
    try { localStorage.setItem(modeKey, next); }
    catch { return false; }
    clearSharedStorage();
    setCurrentMode(next);
    setSessionActive(false);
    setClearedNotice(false);
    setLogoutError(false);
    setResetVersion(v => v + 1);
    return true;
  }, [mode]);
  const startSession = useCallback(() => {
    try {
      sessionStorage.setItem(sharedStuffKey, '');
      sessionStorage.setItem(activeKey, '1');
      sessionStorage.setItem(lastActivityKey, String(Date.now()));
      setSessionActive(true);
      setClearedNotice(false);
      setLogoutError(false);
      setResetVersion(v => v + 1);
      return true;
    } catch {
      clearSharedStorage();
      return false;
    }
  }, []);
  const clearSession = useCallback(() => {
    clearSharedStorage();
    setSessionActive(false);
    setClearedNotice(true);
    setLogoutError(false);
    setResetVersion(v => v + 1);
    // sessionStorage is tab-scoped; also clear any open duplicate tabs.
    try { localStorage.setItem(resetSignalKey, crypto.randomUUID()); } catch { /* this tab is still cleared */ }
  }, []);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === modeKey && (event.newValue === 'personal' || event.newValue === 'shared')) {
        clearSharedStorage();
        setCurrentMode(event.newValue);
        setSessionActive(false);
        setClearedNotice(false);
        setResetVersion(v => v + 1);
        navigate('/');
        return;
      }
      if (event.key !== resetSignalKey) return;
      clearSharedStorage();
      setSessionActive(false);
      setClearedNotice(true);
      setResetVersion(v => v + 1);
      qc.removeQueries({ queryKey: getListStaffRequestsQueryKey() });
      qc.removeQueries({ queryKey: getGetWardStaffStatusQueryKey() });
      navigate('/');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [qc,navigate]);
  const value = useMemo(() => ({
    mode, sessionActive, resetVersion, clearedNotice, logoutError, setMode, startSession, clearSession, setLogoutError,
    dismissNotice: () => setClearedNotice(false),
  }), [mode, sessionActive, resetVersion, clearedNotice, logoutError, setMode, startSession, clearSession]);
  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>;
}

export function useDevice() {
  const context = useContext(DeviceContext);
  if (!context) throw new Error('DeviceProvider is missing');
  return context;
}

export function useFinishSharedSession() {
  const { clearSession, setLogoutError } = useDevice();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  return useCallback(async () => {
    clearSession();
    qc.removeQueries({ queryKey: getListWardItemsQueryKey('requests') });
    qc.removeQueries({ queryKey: getListStaffRequestsQueryKey() });
    qc.removeQueries({ queryKey: getGetWardStaffStatusQueryKey() });
    navigate('/');
    try {
      const response = await fetch('/api/wardspace/staff/logout', { method: 'POST', credentials: 'same-origin' });
      if (!response.ok) throw new Error('Could not sign out staff');
    } catch {
      setLogoutError(true);
    } finally {
      void qc.invalidateQueries({ queryKey: getGetWardStaffStatusQueryKey() });
    }
  }, [clearSession, navigate, qc, setLogoutError]);
}

/** Runs only in the patient/staff app, not on the always-on communal noticeboard. */
export function SharedActivityMonitor() {
  const { mode } = useDevice();
  const finish = useFinishSharedSession();
  const last = useRef(Date.now());
  useEffect(() => {
    if (mode !== 'shared') return;
    try {
      const stored = Number(sessionStorage.getItem(lastActivityKey));
      last.current = stored > 0 ? stored : Date.now();
    } catch { last.current = Date.now(); }
    let timer: ReturnType<typeof setTimeout>;
    let expired = false;
    const expire = () => {
      if (expired) return;
      expired = true;
      void finish();
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(expire, Math.max(0, sharedIdleMs - (Date.now() - last.current)));
    };
    const interact = () => {
      if (Date.now() - last.current >= sharedIdleMs) { expire(); return; }
      last.current = Date.now();
      try { sessionStorage.setItem(lastActivityKey, String(last.current)); } catch { /* timer still runs */ }
      schedule();
    };
    const resume = () => {
      if (document.visibilityState === 'visible') {
        if (Date.now() - last.current >= sharedIdleMs) expire();
        else schedule();
      }
    };
    for (const event of ['pointerdown', 'keydown', 'input', 'scroll', 'touchstart']) window.addEventListener(event, interact, { passive: true });
    document.addEventListener('visibilitychange', resume);
    resume();
    schedule();
    return () => {
      clearTimeout(timer);
      for (const event of ['pointerdown', 'keydown', 'input', 'scroll', 'touchstart']) window.removeEventListener(event, interact);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [mode, finish]);
  return null;
}