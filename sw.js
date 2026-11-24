/* Service worker de Streaming Room T3: deja abrir las páginas sin internet.

   Con internet todo funciona igual que siempre: se pide primero a la red y se guarda una copia.
   La copia guardada solo se usa si la red falla o no responde. No toca la base de datos ni la planilla
   (esos pedidos pasan directo): para eso cada página tiene su propia copia de datos y su cola de pendientes.

   Subí el número de VERSION si se agrega un archivo nuevo a la lista de abajo. */
var VERSION = "st3-v2";
var PAGINAS = ["./", "index.html", "admin.html", "saluda.html", "ranking.html", "juego.html", "ruleta-pizarron.html",
  "ruleta-grande.html", "premio.html", "premios.html", "girar.html", "muestra.html"];
var ARCHIVOS = ["fb.js", "fb-config.js", "sheet.js", "sheet-config.js", "qr-lib.js", "questions.js",
  "favicon.png", "apple-touch-icon.png", "logo-st3.png", "fondo-pizarron.webp", "logo-pizarron.webp", "logo-tiza-chico.webp",
  "pizarra-chica.webp", "icono-aviso.webp", "ruleta-cara.webp", "mapa-muestra.webp", "bg-estudio.jpg"];
var EXTERNOS = ["https://www.gstatic.com/firebasejs/12.0.0/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/12.0.0/firebase-database-compat.js",
  "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js"];
var HOSTS = /^(www\.gstatic\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com)$/;

/* pide con CORS y, si no se puede, sin CORS (respuesta opaca: sirve para <script>) */
function buscar(url) {
  return fetch(url, { cache: "reload" }).catch(function () { return fetch(url, { mode: "no-cors", cache: "reload" }); });
}
function guardar(cache, url) {
  return buscar(url).then(function (res) {
    if (res && (res.ok || res.type === "opaque")) return cache.put(url, res.clone()).then(function () { return res; });
    return null;
  }).catch(function () { return null; });
}
/* En cada página busca las tipografías de Google y las guarda con sus archivos de fuente */
function tipografias(cache, html) {
  var urls = {}, m, re = /https:\/\/fonts\.googleapis\.com\/css2?\?[^"'<>\s)]+/g;
  while ((m = re.exec(html))) urls[m[0].replace(/&amp;/g, "&")] = 1;
  return Promise.all(Object.keys(urls).map(function (u) {
    return buscar(u).then(function (res) {
      if (!res || !res.ok) return null;
      var copia = res.clone();
      return cache.put(u, copia).then(function () { return res.text(); }).then(function (css) {
        var fs = {}, f, r2 = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g;
        while ((f = r2.exec(css))) fs[f[1]] = 1;
        return Promise.all(Object.keys(fs).map(function (x) { return guardar(cache, x); }));
      });
    }).catch(function () { return null; });
  }));
}

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (cache) {
    var locales = PAGINAS.concat(ARCHIVOS);
    return Promise.all(locales.map(function (u) {
      return fetch(new Request(u, { cache: "reload" })).then(function (res) {
        if (!res || !res.ok) return null;
        var esHtml = /html/i.test(res.headers.get("content-type") || "");
        return cache.put(u, res.clone()).then(function () { return esHtml ? res.text().then(function (t) { return tipografias(cache, t); }) : null; });
      }).catch(function () { return null; });
    }).concat(EXTERNOS.map(function (u) { return guardar(cache, u); })));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var r = e.request;
  if (r.method !== "GET") return;
  var u = new URL(r.url);
  var propio = u.origin === self.location.origin;
  if (!propio && !HOSTS.test(u.hostname)) return;       // la base de datos, la planilla, etc. pasan directo
  if (propio && /\/sw\.js$/.test(u.pathname)) return;
  var red = fetch(r).then(function (res) {
    if (res && (res.ok || res.type === "opaque")) {
      var c1 = res.clone(), c2 = u.search ? res.clone() : null;
      caches.open(VERSION).then(function (ca) {
        ca.put(r, c1);
        if (c2) ca.put(u.origin + u.pathname, c2);   // la copia sin "?v=" también queda al día
      });
    }
    return res;
  });
  red.catch(function () {});      // si se usa la copia guardada, que un fallo posterior de la red no genere errores
  var tope = new Promise(function (_, rej) { setTimeout(function () { rej(new Error("lenta")); }, 8000); });
  e.respondWith(
    Promise.race([red, tope]).catch(function () {
      return caches.match(r).then(function (ex) { return ex || caches.match(r, { ignoreSearch: true }); }).then(function (m) {
        if (m) return m;
        if (r.mode === "navigate") return caches.match("./", { ignoreSearch: true }).then(function (h) { return h || red; });
        return red;      // sin copia guardada: se sigue esperando a la red
      });
    })
  );
});
