import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { idbAll, idbDelete, idbGet, idbPut, STORES } from "./idb";
import { pageWorksOffline } from "./offlineScope";
import { setOfflineState, getOfflineState } from "./offlineState";

/**
 * What a "works offline" page loaded, kept so the page can show it again when
 * the network drops (with "showing data as of ..." in the top bar).
 *
 * Only reads made while such a page is open are kept, per user and branch, for
 * a day, at most MAX of them; signing out removes the user's. Patient data on
 * the desk computer is kept no longer and no wider than the screen needs.
 */
const KEEP_MS = 24 * 3_600_000;
const MAX = 400;

interface Saved { key: string; userId: string; savedAt: number; status: number; data: unknown }

export function currentUserId(): string | null {
  try {
    return (JSON.parse(sessionStorage.getItem("hospitalUser") ?? "null") as { id?: string } | null)?.id ?? null;
  } catch {
    return null;
  }
}

function keyOf(config: InternalAxiosRequestConfig): string | null {
  const userId = currentUserId();
  if (!userId || (config.method ?? "get").toLowerCase() !== "get" || !config.url) return null;
  const params = config.params ? JSON.stringify(config.params, Object.keys(config.params).sort()) : "";
  const branch = (config.headers?.["X-Branch-Id"] as string | undefined) ?? "";
  return `${userId}|${branch}|${config.url}|${params}`;
}

/** Keep a read made on a "works offline" page. */
export async function keepRead(response: AxiosResponse): Promise<void> {
  const key = keyOf(response.config);
  if (!key || typeof window === "undefined" || !pageWorksOffline(window.location.pathname)) return;
  await idbPut(STORES.cache, { key, userId: currentUserId()!, savedAt: Date.now(), status: response.status, data: response.data } satisfies Saved);
  if (Math.random() < 0.05) void prune();
}

/** The kept answer to this read, as a response, or null. */
export async function savedRead(config: InternalAxiosRequestConfig): Promise<AxiosResponse | null> {
  const key = keyOf(config);
  if (!key) return null;
  const hit = await idbGet<Saved>(STORES.cache, key);
  if (!hit || Date.now() - hit.savedAt > KEEP_MS) return null;
  const from = getOfflineState().showingSavedFrom;
  setOfflineState({ online: false, showingSavedFrom: from == null ? hit.savedAt : Math.min(from, hit.savedAt) });
  return { data: hit.data, status: hit.status, statusText: "OK (saved)", headers: { "x-offline-saved-at": String(hit.savedAt) }, config } as AxiosResponse;
}

async function prune(): Promise<void> {
  const all = await idbAll<Saved>(STORES.cache);
  const now = Date.now();
  const old = all.filter((s) => now - s.savedAt > KEEP_MS);
  const rest = all.filter((s) => now - s.savedAt <= KEEP_MS).sort((a, b) => b.savedAt - a.savedAt).slice(MAX);
  await Promise.all([...old, ...rest].map((s) => idbDelete(STORES.cache, s.key)));
}

/** Sign-out: this user's kept data goes. */
export async function forgetReads(userId: string | null): Promise<void> {
  if (!userId) return;
  const all = await idbAll<Saved>(STORES.cache);
  await Promise.all(all.filter((s) => s.userId === userId).map((s) => idbDelete(STORES.cache, s.key)));
}
