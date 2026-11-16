/*
 * FREAK צוות — service worker. The page opens with no signal, showing the buttons it had last time.
 *
 * SCOPE: this worker sits in the page's own folder and controls only that folder. The schedule, the till and every
 * other page on this origin keep their own workers.
 *
 * CACHE: every app on epic-pita.github.io shares one Cache Storage. This worker reads, writes and deletes only caches
 * whose name starts with PREFIX (the 13/10 lesson: a cleanup that deletes "everything that is not mine" wipes the
 * other apps). Bump VERSION on every release; the name is the invalidation.
 *
 * STRATEGY: network first with a short fuse for every file of the page (they are a few KB and change at release);
 * the saved copy answers when the network fails or is slow. Nothing but this page's own GET requests is touched.
 */
const PREFIX = 'freak-app-';
const VERSION = 'b1-8';
const CACHE = PREFIX + VERSION;
const FUSE_MS = 3500;
const SHELL = [
  './',
  './index.html',
  './privacy.html',
  './app.css',
  './app.js',
  './config.js',
  './logic.js',
  './pages.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];
const BASE = new URL('./', self.location).pathname;
const OWN = new Set(SHELL.map(u => new URL(u, self.location).pathname));

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE) || !OWN.has(url.pathname)) return;
  e.respondWith(networkFirst(e, req, url));
});

async function networkFirst(e, req, url) {
  const cache = await caches.open(CACHE);
  const key = url.pathname === BASE ? BASE + 'index.html' : url.pathname;   // "./" and "./index.html" are one page
  const ctl = new AbortController();
  const fuse = setTimeout(() => ctl.abort(), FUSE_MS);
  try {
    const res = await fetch(req, { signal: ctl.signal, cache: 'no-cache' });
    // The fresh answer goes out at once; its copy is saved in the background, and the worker is kept awake for that.
    if (res && res.ok) e.waitUntil(cache.put(key, res.clone()).catch(() => {}));
    return res;
  } catch (err) {
    const hit = await cache.match(key);
    if (hit) return hit;
    throw err;
  } finally {
    clearTimeout(fuse);
  }
}
