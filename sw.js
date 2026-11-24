// Service worker de CESL Digital: guarda la "carcasa" de la app para que
// abra rápido en las tablets. Los datos (tareas, notas) siempre vienen del
// servidor; nunca se guardan aquí.
const VERSION = 'cesl-v1.0.0';
const ARCHIVOS = [
  './', 'index.html', 'config.js', 'manifest.webmanifest', 'css/app.css',
  'fonts/nunito-latin-600-normal.woff2', 'fonts/nunito-latin-800-normal.woff2', 'fonts/nunito-latin-900-normal.woff2',
  'img/lu.webp', 'img/lu-sm.webp', 'img/logo.webp', 'img/icon-192.png', 'img/favicon.png',
  'js/app.js', 'js/ui.js', 'js/store/index.js', 'js/store/demo.js', 'js/store/permisos.js', 'js/store/firebase.js',
  'js/calificar.js', 'js/drive.js', 'js/tema.js', 'js/semilla.js',
  'js/vistas/login.js', 'js/vistas/alumno.js', 'js/vistas/docente.js', 'js/vistas/admin.js',
  'js/vistas/editor.js', 'js/vistas/resolver.js', 'js/vistas/resultados.js', 'js/vistas/comun.js',
  'js/juegos/motor.js', 'js/juegos/bancos.js', 'js/juegos/catalogo.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Red primero (para recibir siempre la última versión); si no hay red, copia guardada.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then((r) => {
      if (r.ok) { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia)); }
      return r;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html')))
  );
});
