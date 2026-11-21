/* Base de datos global del stock (la usan todas las páginas).

   - STOCK del turno: lo escribe producción en la planilla de Google (pestañas "Hoja en vivo turno ...").
     Se lee en vivo, sin iniciar sesión (gviz/JSONP), cada pocos segundos.
   - AJUSTE manual (opcional): cfg/stk/<turno>/<clave>/n en Firebase. Si existe, manda sobre la planilla.
   - ENTREGAS: cfg/stk/<turno>/<clave>/used/<código> en Firebase. Cada entrega descuenta 1.
   quedan = (ajuste o planilla) - entregas

   Si no se puede leer nada (sin internet o planilla sin compartir), devuelve null y las páginas
   siguen sin bloquear el juego. */
(function () {
  var PREMIOS = ["Normal", "Grande", "Especial", "Pequeño"];
  var RULETA = ["Stickers", "Llavero 3D", "Lapicera", "Cuaderno", "Vaso", "Llavero plano", "Llavero grande", "Lapicera personalizada"];
  var POLL_MS = 15000;
  var sheet = { manana: null, tarde: null }, okAt = 0, listeners = [], timer = null, seq = 0, started = false;
  try { var c0 = JSON.parse(localStorage.getItem("st3_stock") || "null"); if (c0) sheet = c0; } catch (e) {}

  function fkey(k) { return String(k).replace(/ñ/g, "n").replace(/\s+/g, "_"); }
  function safe(s) { return String(s).replace(/[.#$\[\]\/]/g, "_"); }
  function cfgStk() { var c = window.FB && FB.cfg && FB.cfg(); return (c && c.stk) || {}; }
  function emit() { listeners.forEach(function (f) { try { f(); } catch (e) {} }); }

  /* ---- lectura de la planilla (JSONP: no hace falta CORS ni cuenta) ---- */
  function gv(tab) {
    return new Promise(function (res, rej) {
      var id = window.ST3_SHEET_ID, cb = "__st3gv" + (++seq), s = document.createElement("script"), t;
      if (!id) return rej(new Error("sin planilla"));
      function done() { clearTimeout(t); delete window[cb]; if (s.parentNode) s.parentNode.removeChild(s); }
      window[cb] = function (r) { done(); res(r); };
      s.onerror = function () { done(); rej(new Error("no se pudo leer la planilla")); };
      t = setTimeout(function () { done(); rej(new Error("la planilla no respondió")); }, 9000);
      s.src = "https://docs.google.com/spreadsheets/d/" + id + "/gviz/tq?tqx=out:json;responseHandler:" + cb +
        "&sheet=" + encodeURIComponent(tab) + "&range=A4:C18&headers=1&_=" + Date.now();
      document.head.appendChild(s);
    });
  }
  function parse(r) {
    var o = {};
    if (!r || r.status !== "ok" || !r.table) return null;
    r.table.rows.forEach(function (row) {
      var c = row.c || [], k = c[0] && c[0].v, v = c[2] && c[2].v;
      if (typeof k === "string" && typeof v === "number") o[k] = v;
    });
    return o;
  }
  function load() {
    var tabs = window.ST3_TABS || {}, ks = ["manana", "tarde"];
    return Promise.all(ks.map(function (k) {
      return gv(tabs[k]).then(parse).catch(function () { return null; });
    })).then(function (rs) {
      var any = false;
      ks.forEach(function (k, i) { if (rs[i] && Object.keys(rs[i]).length) { sheet[k] = rs[i]; any = true; } });
      if (any) { okAt = Date.now(); try { localStorage.setItem("st3_stock", JSON.stringify(sheet)); } catch (e) {} }
      emit();
      return any;
    });
  }

  /* ---- cálculo ---- */
  function info(turno, key) {
    var f = cfgStk()[turno], p = f && f[fkey(key)], base = null, manual = false;
    if (p && typeof p.n === "number") { base = p.n; manual = true; }
    else if (sheet[turno] && typeof sheet[turno][key] === "number") base = sheet[turno][key];
    if (base === null) return null;
    var used = p && p.used ? Object.keys(p.used).length : 0;
    return { stock: base, entregados: used, quedan: base - used, manual: manual };
  }
  function quedan(turno, key) { var i = info(turno, key); return i ? i.quedan : null; }
  /* true solo si sabemos que no queda: si no hay dato, no se bloquea nada */
  function agotado(turno, key) { var q = quedan(turno, key); return q !== null && q <= 0; }

  /* ---- escritura en Firebase (entregas y ajustes) ---- */
  function dbx() { return (window.firebase && window.FB && FB.shared && FB.shared()) ? firebase.database() : null; }
  function ref(turno, key, extra) { var d = dbx(); return d ? d.ref("cfg/stk/" + turno + "/" + fkey(key) + (extra || "")) : null; }
  function consume(turno, key, code) {
    var r = ref(turno, key, "/used/" + safe(code)); if (!r) return Promise.reject(new Error("sin conexión"));
    return r.set(firebase.database.ServerValue.TIMESTAMP);
  }
  function release(turno, key, code) {
    var r = ref(turno, key, "/used/" + safe(code)); if (!r) return Promise.reject(new Error("sin conexión"));
    return r.remove();
  }
  function setManual(turno, key, n) {
    var r = ref(turno, key, "/n"); if (!r) return Promise.reject(new Error("sin conexión"));
    return n === null ? r.remove() : r.set(Math.max(0, n | 0));
  }

  /* ---- arranque: lee la planilla y avisa cuando cambia algo (planilla o Firebase) ---- */
  function start() {
    if (started) return; started = true;
    load();
    timer = setInterval(function () { if (!document.hidden) load(); }, POLL_MS);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) load(); });
    if (window.FB && FB.watchCfg) FB.watchCfg(function () { emit(); });
  }

  window.ST3Sheet = {
    PREMIOS: PREMIOS, RULETA: RULETA,
    start: start, load: load, info: info, quedan: quedan, agotado: agotado,
    consume: consume, release: release, setManual: setManual,
    onChange: function (f) { listeners.push(f); },
    leyo: function () { return okAt; },
    sheetValue: function (turno, key) { return sheet[turno] && typeof sheet[turno][key] === "number" ? sheet[turno][key] : null; },
    texto: function () { return null }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else setTimeout(start, 0);
})();
