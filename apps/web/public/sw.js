/* eslint-env serviceworker */
/**
 * Icthus service worker.
 *
 * Deliberately small and hand-written. It caches the app shell so the capture
 * screen opens offline, and it never caches anything user-authored — drafts
 * live in IndexedDB and private entries go to Supabase over the network only.
 */

const VERSION = 'icthus-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;

const scopeUrl = new URL(self.registration.scope);
const SHELL_URL = new URL('./index.html', scopeUrl).toString();

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll([scopeUrl.toString(), SHELL_URL]))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Navigations: network first, so a deployed update is picked up promptly. */
async function handleNavigate(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(SHELL_CACHE);
    cache.put(SHELL_URL, response.clone());
    return response;
  } catch {
    const cached = (await caches.match(SHELL_URL)) ?? (await caches.match(scopeUrl.toString()));
    if (cached) return cached;
    return new Response(
      '<!doctype html><meta charset="utf-8"><title>Offline</title>' +
        '<p style="font-family:Georgia,serif;padding:24px">Icthus is offline. ' +
        'Anything you have written is still saved on this device.</p>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 },
    );
  }
}

/** Build assets are content-hashed, so cache-first is safe and fast. */
async function handleAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') {
    const cache = await caches.open(ASSET_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API traffic — it carries private content and auth state.
  if (url.pathname.includes('/rest/v1/') || url.pathname.includes('/auth/v1/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigate(request));
    return;
  }

  if (/\.(?:js|css|woff2?|png|svg|webmanifest)$/.test(url.pathname)) {
    event.respondWith(handleAsset(request));
  }
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});
