const VERSION = "__BUILD_VERSION__";
const CORE_ASSETS = /*__CORE_ASSETS__*/ [];
const BASE = new URL("./", self.location.href);
const PREFIX = `beauty-app:${BASE.pathname}:`;
const CORE_CACHE = `${PREFIX}core-${VERSION}`;
const MEDIA_CACHE = `${PREFIX}media`;
const CORE_PATHS = new Set(
  CORE_ASSETS.map((file) => new URL(file, BASE).pathname),
);
const INDEX = new URL("index.html", BASE).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CORE_CACHE);
      await cache.addAll(
        CORE_ASSETS.map(
          (file) => new Request(new URL(file, BASE), { cache: "reload" }),
        ),
      );
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (name) => name.startsWith(`${PREFIX}core-`) && name !== CORE_CACHE,
          )
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") event.waitUntil(self.skipWaiting());
});

async function resource(request, name, networkFirst = false) {
  const cache = await caches.open(name).catch(() => null);
  const cached = cache ? await cache.match(request).catch(() => null) : null;
  if (cached && !networkFirst) return cached;
  try {
    const response = await fetch(request);
    if (response.ok && cache)
      await cache.put(request, response.clone()).catch(() => {});
    return response.ok ? response : cached || response;
  } catch {
    return cached || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== BASE.origin ||
    !url.pathname.startsWith(BASE.pathname)
  )
    return;
  if (
    request.mode === "navigate" &&
    (url.pathname === BASE.pathname || url.pathname === new URL(INDEX).pathname)
  ) {
    event.respondWith(resource(INDEX, CORE_CACHE));
  } else if (CORE_PATHS.has(url.pathname)) {
    event.respondWith(resource(new URL(url.pathname, BASE).href, CORE_CACHE));
  } else if (/\.(?:png|jpe?g|webp|svg)$/i.test(url.pathname)) {
    event.respondWith(resource(request, MEDIA_CACHE, true));
  }
});
