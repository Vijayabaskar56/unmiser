import { useLiveQuery } from "@tanstack/react-db";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, type AppStateStatus } from "react-native";

import { appSettingsCollection } from "@/db/collections";
import { parseAppLockPrefs, shouldRelock, type AppLockPrefs } from "@/lib/security/app-lock";

interface AppLockContextValue extends AppLockPrefs {
  /** Whether the lock overlay should currently be shown. */
  locked: boolean;
  /** Release the lock (called by the lock screen on success). */
  unlock: () => void;
}

const AppLockContext = createContext<AppLockContextValue | null>(null);

/**
 * App-lock runtime: reads prefs reactively from app_settings, holds the
 * (in-memory) locked state, and drives the foreground re-lock gate via
 * AppState. The unlocked state is intentionally NOT persisted — every cold
 * start re-locks when App-lock is enabled; the timeout only governs the
 * background→foreground grace within a running session.
 */
export function AppLockProvider({ children }: { children: ReactNode }) {
  const { data: settings, isReady } = useLiveQuery((q) =>
    q.from({ setting: appSettingsCollection }),
  );

  const prefs = useMemo<AppLockPrefs>(() => {
    const map: Record<string, string | null> = {};
    for (const row of settings ?? []) map[row.key] = row.value ?? null;
    return parseAppLockPrefs(map);
  }, [settings]);

  const [locked, setLocked] = useState(false);
  const didInit = useRef(false);
  const backgroundedAt = useRef<number | null>(null);

  // Keep the latest prefs in a ref so the AppState listener (registered once)
  // always reads current values without re-subscribing.
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  // Cold-start lock: the first time prefs load, lock if App-lock is enabled.
  useEffect(() => {
    if (!isReady || didInit.current) return;
    didInit.current = true;
    if (prefs.enabled) setLocked(true);
  }, [isReady, prefs.enabled]);

  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next === "active") {
        const { enabled, timeoutMinutes } = prefsRef.current;
        if (enabled && shouldRelock(timeoutMinutes, backgroundedAt.current, Date.now())) {
          setLocked(true);
        }
        backgroundedAt.current = null;
      } else if (next === "background" || next === "inactive") {
        if (backgroundedAt.current == null) backgroundedAt.current = Date.now();
      }
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, []);

  const value = useMemo<AppLockContextValue>(
    () => ({ ...prefs, locked: locked && prefs.enabled, unlock: () => setLocked(false) }),
    [prefs, locked],
  );

  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>;
}

export function useAppLock(): AppLockContextValue {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error("useAppLock must be used within an AppLockProvider");
  return ctx;
}
