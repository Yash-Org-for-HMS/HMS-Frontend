import { useSyncExternalStore } from "react";

/**
 * What the top bar shows about the network, kept outside React so the request
 * layer (api/axios.ts) can update it: whether the server is reachable, what is
 * waiting to be sent, what the server refused on arrival, and the oldest saved
 * data being shown in place of a live answer.
 *
 * "Offline" is the browser's own flag OR the last request failing for want of
 * a network; the next request that gets an answer clears it.
 */
export interface OfflineState {
  online: boolean;
  /** Saves waiting on this computer for the signed-in user. */
  waiting: number;
  /** Saves the server refused when they arrived - the "needs attention" tray. */
  failed: number;
  /** A send is in progress. */
  syncing: boolean;
  /** Saved data was shown instead of a live answer: when the oldest of it was loaded. */
  showingSavedFrom: number | null;
}

let state: OfflineState = {
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  waiting: 0, failed: 0, syncing: false, showingSavedFrom: null,
};
const listeners = new Set<() => void>();

export function getOfflineState(): OfflineState {
  return state;
}

export function setOfflineState(patch: Partial<OfflineState>): void {
  const next = { ...state, ...patch };
  if (Object.keys(patch).every((k) => next[k as keyof OfflineState] === state[k as keyof OfflineState])) return;
  const cameBack = !state.online && next.online;
  state = next;
  if (next.online) state.showingSavedFrom = cameBack ? null : state.showingSavedFrom;
  listeners.forEach((l) => l());
}

export function subscribeOffline(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useOfflineState(): OfflineState {
  return useSyncExternalStore(subscribeOffline, getOfflineState, getOfflineState);
}

/** The request failed for want of a network (no answer at all, or the gateway said the server is unreachable). */
export function isNetworkFailure(err: unknown): boolean {
  const e = err as { response?: { status?: number }; code?: string; message?: string } | null;
  if (!e) return false;
  if (!e.response) return e.code !== "ERR_CANCELED";
  return [502, 503, 504].includes(e.response.status ?? 0);
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => setOfflineState({ online: true }));
  window.addEventListener("offline", () => setOfflineState({ online: false }));
}
