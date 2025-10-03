// sw.js

// --- CONFIGURATION ---

// Le nom du cache. Il est important de le versionner.
// Si vous modifiez des fichiers (CSS, JS, images), incrémentez la version (ex: 'v2').
const CACHE_NAME = 'alexiaflix-cache-v2';

// Liste des fichiers essentiels de l'application (l' "App Shell").
// Ces fichiers seront mis en cache dès l'installation du Service Worker.
const URLS_TO_CACHE = [
  '.', // Alias pour index.html
  'index.html',
  'manifest.json',
  // -- Fichiers de l'interface --
  'Web/Images/AlexiaFlix - Logo/AlexiaFlix - Logo 2.png',
  'Web/Images/AlexiaFlix - Logo/AlexiaFlix - Logo 2.ico',
  'Web/Images/AlexiaFlix - Logo/CatGPT.jpg',
  'Audios/Musiques/Launch.mp3',
  // -- Dépendances externes (optionnel mais recommandé pour le hors-ligne) --
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@700&family=Poppins:wght@300;400;500;600;700&display=swap'
];


// --- CYCLE DE VIE DU SERVICE WORKER ---

/**
 * 1. Installation du Service Worker
 * Cet événement est déclenché lorsque le navigateur installe le service worker.
 * On en profite pour ouvrir notre cache et y ajouter tous les fichiers de l'App Shell.
 */
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installation...');
  // waitUntil attend que la promesse soit résolue avant de considérer l'installation comme terminée.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Mise en cache de l\'App Shell');
        return cache.addAll(URLS_TO_CACHE);
      })
      .catch(err => {
        console.error('[Service Worker] Échec de la mise en cache de l\'App Shell :', err);
      })
  );
});

/**
 * 2. Activation du Service Worker
 * Cet événement est déclenché après l'installation et lorsque le SW prend le contrôle de la page.
 * C'est le moment idéal pour nettoyer les anciens caches qui ne sont plus utilisés.
 */
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activation...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Si un nom de cache ne correspond pas au nom actuel, on le supprime.
          if (cacheName !== CACHE_NAME) {
            console.log(`[Service Worker] Nettoyage de l'ancien cache : ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Force le service worker à devenir le contrôleur actif immédiatement.
  return self.clients.claim();
});

/**
 * 3. Interception des requêtes (Fetch)
 * Cet événement est déclenché pour chaque requête réseau effectuée par la page.
 * C'est ici que la magie du hors-ligne opère.
 */
self.addEventListener('fetch', (event) => {
  // On ne met pas en cache les requêtes de l'API Gemini ou les vidéos OneDrive
  if (event.request.url.includes('generativelanguage.googleapis.com') || event.request.url.includes('1drv.ms')) {
    // On laisse la requête se faire normalement sans l'intercepter
    return;
  }

  event.respondWith(
    // On cherche d'abord une correspondance dans le cache.
    caches.match(event.request)
      .then((cachedResponse) => {
        // Si une réponse est trouvée dans le cache, on la retourne directement.
        if (cachedResponse) {
          // console.log('[Service Worker] Ressource trouvée dans le cache :', event.request.url);
          return cachedResponse;
        }

        // Si la ressource n'est pas dans le cache, on la récupère sur le réseau.
        // console.log('[Service Worker] Ressource non trouvée, fetch sur le réseau :', event.request.url);
        return fetch(event.request).then(
          (networkResponse) => {
            // Si la requête réseau réussit, on met la nouvelle ressource en cache pour plus tard.
            // On doit cloner la réponse car elle ne peut être consommée qu'une seule fois.
            return caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
              // On retourne la réponse du réseau à la page.
              return networkResponse;
            });
          }
        ).catch(error => {
            console.error('[Service Worker] Erreur de fetch :', error);
            // Optionnel: retourner une page/image de fallback en cas d'erreur réseau
        });
      })
  );
});