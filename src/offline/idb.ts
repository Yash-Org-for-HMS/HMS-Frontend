/**
 * The browser's own database (IndexedDB), as three promises: what the offline
 * save queue and the last-seen data live in. Survives a page refresh and a
 * closed tab; cleared per user at sign-out (readCache) or once sent (outbox).
 *
 * Fails soft: a browser with storage blocked (private window, policy) gets
 * `null` from `openDb`, and the app simply has no offline help there.
 */
const DB = "dolphin-offline";
const VERSION = 1;
export const STORES = { outbox: "outbox", cache: "cache" } as const;
type Store = (typeof STORES)[keyof typeof STORES];

let opening: Promise<IDBDatabase | null> | null = null;

export function openDb(): Promise<IDBDatabase | null> {
  if (opening) return opening;
  opening = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORES.outbox)) db.createObjectStore(STORES.outbox, { keyPath: "id" });
        if (!db.objectStoreNames.contains(STORES.cache)) db.createObjectStore(STORES.cache, { keyPath: "key" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return opening;
}

function run<T>(store: Store, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T | null> {
  return openDb().then((db) => new Promise<T | null>((resolve) => {
    if (!db) return resolve(null);
    try {
      const req = fn(db.transaction(store, mode).objectStore(store));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  }));
}

export const idbGet = <T>(store: Store, key: string) => run<T>(store, "readonly", (s) => s.get(key));
export const idbAll = <T>(store: Store) => run<T[]>(store, "readonly", (s) => s.getAll()).then((r) => r ?? []);
export const idbPut = (store: Store, value: unknown) => run(store, "readwrite", (s) => s.put(value));
export const idbDelete = (store: Store, key: string) => run(store, "readwrite", (s) => s.delete(key));
