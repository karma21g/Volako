// Service worker Volako.
// Stratégie : pour la page elle-même (index.html), on va TOUJOURS vérifier
// le réseau en premier, et on ne retombe sur le cache que si on est hors
// ligne. Ça évite qu'une ancienne version reste bloquée en cache après une
// mise à jour. Pour le reste (icônes, manifeste...), cache simple suffit.

const CACHE_NAME = "volako-shell-v2"; // changer ce nom force un cache neuf
const APP_SHELL = [
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
  const req = event.request;
  const url = new URL(req.url);

  // Jamais toucher aux appels Firebase/Google : ils passent par le réseau.
  if (url.hostname.includes("googleapis.com") || url.hostname.includes("firebaseio.com") || url.hostname.includes("gstatic.com")) {
    return;
  }

  // La page HTML elle-même (navigation, ou index.html) : réseau d'abord,
  // cache seulement en secours si hors ligne.
  const isPage = req.mode === "navigate" || url.pathname.endsWith("index.html") || url.pathname.endsWith("/");
  if (isPage) {
    event.respondWith(
      fetch(req).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        return response;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Le reste (icônes, manifeste, polices, Chart.js...) : cache d'abord,
  // et on met à jour le cache en arrière-plan à chaque fois.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((response) => {
        if (req.method === "GET" && response.ok){
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
