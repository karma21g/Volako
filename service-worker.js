// Service worker Volako — met en cache l'app elle-même (le "coquille" de l'app),
// pour qu'elle s'ouvre même sans connexion. Les données, elles, passent par
// Firestore qui gère son propre cache et sa synchro (voir index.html).

const CACHE_NAME = "volako-shell-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // On ne touche jamais aux appels vers Firebase/Google : ils doivent
  // passer par le réseau (ou être gérés par le cache propre de Firestore).
  if (url.hostname.includes("googleapis.com") || url.hostname.includes("firebaseio.com") || url.hostname.includes("gstatic.com")) {
    return;
  }

  // Pour le reste (le fichier app lui-même, les polices, Chart.js...) :
  // on sert le cache en priorité, et on retombe sur le réseau sinon.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (event.request.method === "GET" && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
