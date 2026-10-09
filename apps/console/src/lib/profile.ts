import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { Profile } from "@octa/contracts";
import { getProfile } from "./api";

/**
 * The signed-in staff member's own profile (PROFILES, 9 Oct 2026), shared by the
 * shell's account block and `/profile`, so a new picture shows in both at
 * once. One fetch per session; `reload()` after a change, `set()` with what
 * the API answered to a change (it returns the fresh profile).
 *
 * A signed picture link lasts an hour, so the store is read again when the
 * page comes back to the foreground after a long while.
 */

interface State {
  profile: Profile | null;
  loading: boolean;
  failed: boolean;
  at: number;
}

let state: State = { profile: null, loading: false, failed: false, at: 0 };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const put = (next: Partial<State>) => {
  state = { ...state, ...next };
  emit();
};

const STALE_MS = 45 * 60 * 1000;

export function loadProfile(force = false): void {
  if (state.loading) return;
  if (!force && state.profile && Date.now() - state.at < STALE_MS) return;
  put({ loading: true, failed: false });
  getProfile()
    .then((profile) => put({ profile, loading: false, at: Date.now() }))
    .catch(() => put({ loading: false, failed: true }));
}

export function setProfile(profile: Profile): void {
  put({ profile, loading: false, failed: false, at: Date.now() });
}

/** Forget it (signing out): the next person must not see the last one's picture. */
export function clearProfile(): void {
  put({ profile: null, loading: false, failed: false, at: 0 });
}

export function useProfile(): { profile: Profile | null; loading: boolean; failed: boolean; reload: () => void } {
  const snap = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
  useEffect(() => loadProfile(), []);
  useEffect(() => {
    const back = () => {
      if (document.visibilityState === "visible") loadProfile();
    };
    document.addEventListener("visibilitychange", back);
    return () => document.removeEventListener("visibilitychange", back);
  }, []);
  const reload = useCallback(() => loadProfile(true), []);
  return { profile: snap.profile, loading: snap.loading, failed: snap.failed, reload };
}
