const VERSION = 'v2';
const SHELL = `shell-${VERSION}`;
const DATA = `data-${VERSION}`;
const PAGES = `pages-${VERSION}`;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(['/', '/learn/', '/quiz/', '/review/', '/progress/', '/settings/', '/manifest.webmanifest'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => !k.endsWith(VERSION) && !k.startsWith('webllm'))
      .map(k => caches.delete(k)),
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  if (request.mode === 'navigate') {
    e.respondWith(fetch(request).then(response => {
      caches.open(PAGES).then(cache => cache.put(request, response.clone())).catch(() => {});
      return response;
    }).catch(() => caches.match(request).then(r => r || caches.match('/'))));
    return;
  }
  const bucket = url.pathname.startsWith('/data/') ? DATA : SHELL;
  e.respondWith(caches.open(bucket).then(async cache => {
    const hit = await cache.match(request);
    const net = fetch(request).then(response => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    }).catch(() => hit);
    return hit || net;
  }));
});

self.addEventListener('message', e => {
  if (e.data?.type !== 'PRECACHE_CONTENT') return;
  e.waitUntil((async () => {
    try {
      const concepts = await fetch('/data/concepts.json').then(r => r.json());
      const pages = await caches.open(PAGES);
      const data = await caches.open(DATA);
      await data.addAll(['/data/concepts.json', '/data/search-index.json']);
      for (const concept of concepts) {
        try { await pages.add(concept.href); } catch {}
        if (concept.hasQuiz) {
          try { await data.add(`/data/quiz/${concept.id.replace(/\//g, '__')}.json`); } catch {}
        }
        try { await data.add(`/data/concept-sections/${concept.id.replace(/\//g, '__')}.json`); } catch {}
      }
      (await self.clients.matchAll()).forEach(client => client.postMessage({ type: 'PRECACHE_DONE' }));
    } catch (error) {
      (await self.clients.matchAll()).forEach(client => client.postMessage({ type: 'PRECACHE_ERROR', error: String(error?.message ?? error) }));
    }
  })());
});
