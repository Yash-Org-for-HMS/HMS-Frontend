/*
 * The app itself, kept in the browser, so a desk computer can open or refresh
 * Dolphin while the network is down (the "works offline" pages then run on
 * what they last loaded, and their saves wait - see src/offline/).
 *
 * The build writes this build's files over __OFFLINE_ASSETS__ and its id over
 * __OFFLINE_VERSION__ (vite.config.ts), so every deploy is a new worker that
 * keeps the new files and drops the old.
 *
 * Matched ignoring Vary: a file kept at install (no Origin header) must still
 * answer a module import (which sends one) - otherwise a page's code is "not
 * there" offline although it is kept.
 *
 * Only the app's own files: pages are network first (the latest deploy when
 * there is a network, the kept page when not), built files cache first (their
 * names change with their content). API calls are never touched here - the
 * request layer handles those.
 */
const VERSION = "__OFFLINE_VERSION__";
const ASSETS = "__OFFLINE_ASSETS__";
const CACHE = `dolphin-app-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(["/", ...(Array.isArray(ASSETS) ? ASSETS : [])]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("dolphin-app-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/uploads/")) return;

  // A page: the latest from the network; the kept app when there is none.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("/", { cacheName: CACHE, ignoreVary: true }).then((hit) => hit || Response.error())),
    );
    return;
  }
  // A built file: kept copy first, else fetched and kept.
  event.respondWith(
    caches.match(req, { cacheName: CACHE, ignoreVary: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok && res.type === "basic") {
        const copy = res.clone();
        void caches.open(CACHE).then((cache) => cache.put(req, copy));
      }
      return res;
    })),
  );
});
