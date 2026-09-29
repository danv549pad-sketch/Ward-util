import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { getGetWardStaffStatusQueryKey, getListStaffRequestsQueryKey, getListWardItemsQueryKey } from '@workspace/api-client-react';

export type DeviceMode = 'personal' | 'shared';
const modeKey = 'wardspace-device-mode';
const pendingSharedKey = 'wardspace-pending-shared-cleanup';
const personalStuffKey = 'wardspace-my-stay';
let pendingSelection = false;
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

export function hasPersonalNotes(): boolean | null {
  try {
    const raw = localStorage.getItem(personalStuffKey);
    if (!raw) return false;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return true;
      const item = parsed as { tasks?: Record<string, unknown>; notes?: unknown };
      return (typeof item.notes === 'string' && item.notes.trim().length > 0)
        || Object.values(item.tasks ?? {}).some(list => Array.isArray(list) && list.length > 0);
    } catch { return true; }
  } catch { return null; }
}

function pendingSharedSetup() {
  try { return pendingSelection || localStorage.getItem(pendingSharedKey) === '1'; }
  catch { return pendingSelection; }
}

function initialMode(): DeviceMode {
  const selected = new URLSearchParams(window.location.search).get('mode');
  let previous: string | null = null;
  try { previous = localStorage.getItem(modeKey); } catch { /* use the safe default */ }
  if (selected === 'shared' && hasPersonalNotes() !== false) {
    // Do not expose existing Personal notes or persist a new mode until someone
    // explicitly removes the notes or cancels the switch.
    pendingSelection = true;
    try { localStorage.setItem(pendingSharedKey, '1'); } catch { /* overlay still blocks this page */ }
    clearSharedStorage();
  }
  const pending = pendingSharedSetup();
  // A shared tablet cannot be switched back to persistent personal storage with a public URL.
  // Changing it back requires the authenticated staff setting.
  const mode: DeviceMode = pending || selected === 'shared' || previous === 'shared' ? 'shared' : 'personal';
  if (selected === 'personal' || selected === 'shared') {
    if (previous !== mode) clearSharedStorage();
    if (!pending) {
      try { localStorage.setItem(modeKey, mode); } catch { /* remains set for this page only */ }
    }
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
  configurationNotice: string;
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
  const [needsPersonalCleanup, setNeedsPersonalCleanup] = useState(pendingSharedSetup);
  const [cleanupError, setCleanupError] = useState('');
  const [sessionActive, setSessionActive] = useState(() => initialSession(mode));
  const [resetVersion, setResetVersion] = useState(0);
  const [clearedNotice, setClearedNotice] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const [configurationNotice, setConfigurationNotice] = useState('');
  const setMode = useCallback((next: DeviceMode) => {
    if (next === mode) return true;
    if (next === 'shared' && hasPersonalNotes() !== false) return false;
    try { localStorage.setItem(modeKey, next); }
    catch { return false; }
    clearSharedStorage();
    setCurrentMode(next);
    setSessionActive(false);
    setClearedNotice(false);
    setLogoutError(false);
    setConfigurationNotice(`This browser is now set as a ${next} device.`);
    setResetVersion(v => v + 1);
    return true;
  }, [mode]);
  const confirmPendingShared = useCallback(() => {
    try {
      localStorage.removeItem(personalStuffKey);
      if (localStorage.getItem(personalStuffKey) !== null) throw new Error('Notes remain');
      localStorage.setItem(modeKey, 'shared');
      localStorage.removeItem(pendingSharedKey);
      if (localStorage.getItem(pendingSharedKey) !== null) throw new Error('Pending setting remains');
      pendingSelection = false;
      clearSharedStorage();
      setCurrentMode('shared');
      setSessionActive(false);
      setResetVersion(v => v + 1);
      setConfigurationNotice('This browser is now set as a shared device.');
      setNeedsPersonalCleanup(false);
      navigate('/');
    } catch {
      setCleanupError('Could not finish switching this browser. Please ask a member of staff for help.');
    }
  }, [navigate]);
  const cancelPendingShared = useCallback(() => {
    try {
      localStorage.removeItem(pendingSharedKey);
      if (localStorage.getItem(pendingSharedKey) !== null) throw new Error('Pending setting remains');
      pendingSelection = false;
      const previous = localStorage.getItem(modeKey) === 'shared' ? 'shared' : 'personal';
      setCurrentMode(previous);
      setNeedsPersonalCleanup(false);
      navigate('/noticeboard');
    } catch {
      setCleanupError('Could not cancel the switch. Please ask a member of staff for help.');
    }
  }, [navigate]);
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
        setConfigurationNotice(`This browser is now set as a ${event.newValue} device.`);
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
    mode, sessionActive, resetVersion, clearedNotice, logoutError, configurationNotice, setMode, startSession, clearSession, setLogoutError,
    dismissNotice: () => setClearedNotice(false),
  }), [mode, sessionActive, resetVersion, clearedNotice, logoutError, configurationNotice, setMode, startSession, clearSession]);
  return <DeviceContext.Provider value={value}>{needsPersonalCleanup
    ? <main className="min-h-dvh bg-[#F5F8FA] px-5 py-14 flex justify-center items-start">
      <section role="alertdialog" aria-modal="true" aria-labelledby="pending-shared-title" aria-describedby="pending-shared-description" className="surface max-w-xl w-full p-7 md:p-10" data-testid="warning-pending-shared-notes">
        <p className="eyebrow">Device privacy</p>
        <h1 id="pending-shared-title" className="display text-2xl md:text-3xl mt-2">Personal notes are stored on this browser</h1>
        <p id="pending-shared-description" className="mt-4">Before this browser can be used as a shared ward device, its saved My Stuff notes must be removed. Deleting them cannot be undone. Until you choose, the rest of the app is hidden so those notes cannot be displayed by accident.</p>
        <div className="flex flex-wrap gap-3 mt-6">
          <button type="button" className="btn btn-danger" onClick={confirmPendingShared} data-testid="button-confirm-pending-shared">Delete notes and switch to Shared</button>
          <button type="button" className="btn btn-outline" onClick={cancelPendingShared} data-testid="button-cancel-pending-shared">Cancel</button>
        </div>
        {cleanupError && <p role="alert" className="mt-4 text-[#9B2C2C]">{cleanupError}</p>}
      </section>
    </main>
    : children}</DeviceContext.Provider>;
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