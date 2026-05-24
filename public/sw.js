const SW_VERSION = "noxo-pwa-v2";
const STATIC_CACHE = `${SW_VERSION}-static`;
const PAGE_CACHE = `${SW_VERSION}-pages`;
const API_CACHE = `${SW_VERSION}-api`;
const OFFLINE_PAGE_URLS = new Set([
  "/dashboard/service-forms/new",
]);

const PRECACHE_URLS = [
  "/offline",
  "/login",
  "/noxo-logo.png",
  "/noxo-icon-192.png",
  "/noxo-icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  const expectedCaches = new Set([STATIC_CACHE, PAGE_CACHE, API_CACHE]);

  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("noxo-pwa-") && !expectedCaches.has(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, PAGE_CACHE, OFFLINE_PAGE_URLS.has(url.pathname) ? url.pathname : "/offline"));
    return;
  }

  if (OFFLINE_PAGE_URLS.has(url.pathname)) {
    event.respondWith(networkFirst(request, PAGE_CACHE, url.pathname));
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".woff") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".ttf")
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  }
});

self.addEventListener("push", (event) => {
  if (!event.data) {
    return;
  }

  const data = event.data.json();
  const title = data.title || "noxo";

  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body,
      icon: data.icon || "/noxo-icon-192.png",
      badge: "/noxo-icon-192.png",
      data: {
        url: data.url || "/dashboard",
      },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }

        return clients.openWindow(targetUrl);
      })
  );
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  await putCache(cacheName, request, response);
  return response;
}

async function networkFirst(request, cacheName, fallbackUrl) {
  try {
    const response = await fetch(request);
    await putCache(cacheName, request, response);
    return response;
  } catch {
    const cached = await caches.match(request);

    if (cached) {
      return cached;
    }

    if (fallbackUrl) {
      return caches.match(fallbackUrl);
    }

    return new Response(
      JSON.stringify({
        error: "offline",
        message: "Bu veri cevrimdisi kullanilamiyor.",
      }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
      }
    );
  }
}

async function putCache(cacheName, request, response) {
  if (!response || !response.ok || response.type === "opaque") {
    return;
  }

  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
}
