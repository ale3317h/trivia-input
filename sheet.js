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
  var ruletaDef = null, extrasDef = [];
  var sheet = { manana: null, tarde: null }, okAt = 0, listeners = [], timer = null, seq = 0, started = false;
  try { var c0 = JSON.parse(localStorage.getItem("st3_stock") || "null"); if (c0) sheet = c0; } catch (e) {}
  try { ruletaDef = JSON.parse(localStorage.getItem("st3_ruleta") || "null"); } catch (e) {}
  try { extrasDef = JSON.parse(localStorage.getItem("st3_extras") || "[]") || []; } catch (e) {}

  function fkey(k) { return String(k).replace(/ñ/g, "n").replace(/\s+/g, "_"); }
  function safe(s) { return String(s).replace(/[.#$\[\]\/]/g, "_"); }
  function cfgStk() {
    var c = window.FB && FB.cfg && FB.cfg(), s = (c && c.stk) || {};
    if (!Object.keys(s).length) { try { s = JSON.parse(localStorage.getItem("st3_stk") || "{}") || {}; } catch (e) { s = {}; } }   // sin internet: las entregas de la última vez que hubo conexión
    return s;
  }
  function emit() { listeners.forEach(function (f) { try { f(); } catch (e) {} }); }

  /* ---- lectura de la planilla (JSONP: no hace falta CORS ni cuenta) ---- */
  function gv(tab, range, headers) {
    return new Promise(function (res, rej) {
      var id = window.ST3_SHEET_ID, cb = "__st3gv" + (++seq), s = document.createElement("script"), t;
      if (!id) return rej(new Error("sin planilla"));
      function done() { clearTimeout(t); delete window[cb]; if (s.parentNode) s.parentNode.removeChild(s); }
      window[cb] = function (r) { done(); res(r); };
      s.onerror = function () { done(); rej(new Error("no se pudo leer la planilla")); };
      t = setTimeout(function () { done(); rej(new Error("la planilla no respondió")); }, 9000);
      s.src = "https://docs.google.com/spreadsheets/d/" + id + "/gviz/tq?tqx=out:json;responseHandler:" + cb +
        "&sheet=" + encodeURIComponent(tab) + "&range=" + (range || "A4:C40") + "&headers=" + (headers === undefined ? 1 : headers) + "&_=" + Date.now();
      document.head.appendChild(s);
    });
  }
  function parse(r) {
    var o = {}, ex = [], inEx = false;
    if (!r || r.status !== "ok" || !r.table) return null;
    r.table.rows.forEach(function (row) {
      var c = row.c || [], k = c[0] && c[0].v, v = c[2] && c[2].v;
      if (typeof k === "string" && typeof v !== "number") inEx = /^extras/i.test(k);   // encabezados de cada bloque
      if (typeof k === "string" && typeof v === "number") { o[k] = v; if (inEx) ex.push(k); }
    });
    if (ex.length || /extras/i.test(JSON.stringify(r.table.rows.slice(0, 40).map(function (x) { return x.c && x.c[0] && x.c[0].v; })))) {
      extrasDef = ex; try { localStorage.setItem("st3_extras", JSON.stringify(ex)); } catch (e) {}
    }
    return o;
  }
  /* Hoja "Ruleta": un premio por fila (nombre, material, cantidad por giro, porciones, stock por turno) */
  function parseRuleta(r) {
    if (!r || r.status !== "ok" || !r.table) return null;
    var out = [];
    r.table.rows.forEach(function (row) {
      var c = row.c || [], n = c[0] && c[0].v, g = c[2] && c[2].v;
      if (typeof n !== "string" || !n || /^(total|ok:|stock total)/i.test(n) || typeof g !== "number") return;
      out.push({ name: n, material: (c[1] && c[1].v) || n, porGiro: g > 0 ? g : 1,
        porciones: Math.max(0, Math.round((c[3] && typeof c[3].v === "number" && c[3].v) || 0)),
        stockTurno: (c[5] && typeof c[5].v === "number") ? c[5].v : null });
    });
    return out.length ? out : null;
  }
  function load() {
    var tabs = window.ST3_TABS || {}, ks = ["manana", "tarde"];
    var rt = window.ST3_RULETA_TAB ? gv(window.ST3_RULETA_TAB, "A8:G30", 0).then(parseRuleta).catch(function () { return null; }) : Promise.resolve(null);
    return Promise.all(ks.map(function (k) {
      return gv(tabs[k]).then(parse).catch(function () { return null; });
    }).concat([rt])).then(function (rs) {
      var any = false, def = rs[2];
      if (def) { ruletaDef = def; try { localStorage.setItem("st3_ruleta", JSON.stringify(def)); } catch (e) {} }
      ks.forEach(function (k, i) { if (rs[i] && Object.keys(rs[i]).length) { sheet[k] = rs[i]; any = true; } });
      // si un premio de la ruleta no está en la hoja en vivo del turno, usa el "stock por turno" de la hoja Ruleta
      if (ruletaDef) ks.forEach(function (k) { if (!sheet[k]) return; ruletaDef.forEach(function (p) { if (typeof sheet[k][p.name] !== "number" && typeof p.stockTurno === "number") sheet[k][p.name] = p.stockTurno; }); });
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
    // entregas ya subidas + las guardadas en este dispositivo que todavía no se subieron (sin internet)
    var us = {}; if (p && p.used) Object.keys(p.used).forEach(function (c) { us[c] = 1; });
    qLoad().forEach(function (x) { if (x.t === turno && fkey(x.k) === fkey(key)) { if (x.op === "c") us[safe(x.c)] = 1; else delete us[safe(x.c)]; } });
    var used = Object.keys(us).length;
    return { stock: base, entregados: used, quedan: base - used, manual: manual };
  }
  function quedan(turno, key) { var i = info(turno, key); return i ? i.quedan : null; }
  /* true solo si sabemos que no queda: si no hay dato, no se bloquea nada */
  function agotado(turno, key) { var q = quedan(turno, key); return q !== null && q <= 0; }

  /* ---- escritura en Firebase (entregas y ajustes) ---- */
  function dbx() { return (window.firebase && window.FB && FB.shared && FB.shared()) ? firebase.database() : null; }
  function ref(turno, key, extra) { var d = dbx(); return d ? d.ref("cfg/stk/" + turno + "/" + fkey(key) + (extra || "")) : null; }
  /* Sin internet las entregas (y las que se deshacen) se guardan en este dispositivo y se suben solas al volver la conexión. */
  var QKEY = "st3_q", connected = null, flushing = false, qRaw = null, qVal = [];
  function qLoad() {
    var s = "[]"; try { s = localStorage.getItem(QKEY) || "[]"; } catch (e) {}
    if (s !== qRaw) { qRaw = s; try { qVal = JSON.parse(s) || []; } catch (e) { qVal = []; } }
    return qVal;
  }
  function qSave(q) { try { localStorage.setItem(QKEY, JSON.stringify(q)); } catch (e) {} qRaw = null; }
  function enLinea() { return connected === true && navigator.onLine !== false; }
  function conTope(p, ms) {
    return new Promise(function (res, rej) {
      var t = setTimeout(function () { rej(new Error("sin respuesta")); }, ms);
      p.then(function (v) { clearTimeout(t); res(v); }, function (e) { clearTimeout(t); rej(e); });
    });
  }
  function enviar(op, turno, key, code, ts) {
    var r = ref(turno, key, "/used/" + safe(code)); if (!r) return Promise.reject(new Error("sin conexión"));
    return op === "c" ? r.set(ts || firebase.database.ServerValue.TIMESTAMP) : r.remove();
  }
  function encolar(op, turno, key, code) {
    var q = qLoad().slice();
    if (op === "r") {   // deshacer algo que todavía no se subió: se cancelan entre sí
      var i = -1; q.forEach(function (x, n) { if (x.op === "c" && x.t === turno && fkey(x.k) === fkey(key) && x.c === code) i = n; });
      if (i >= 0) { q.splice(i, 1); qSave(q); emit(); return; }
    }
    q.push({ op: op, t: turno, k: key, c: code, ts: Date.now() }); qSave(q); emit();
  }
  function flush() {
    if (flushing || !enLinea() || !qLoad().length) return;
    flushing = true;
    (function next() {
      var q = qLoad(); if (!q.length) { flushing = false; emit(); return; }
      var x = q[0];
      conTope(enviar(x.op, x.t, x.k, x.c, x.ts), 8000).then(function () {
        qSave(qLoad().filter(function (y) { return !(y.op === x.op && y.t === x.t && y.k === x.k && y.c === x.c && y.ts === x.ts); }));
        emit(); next();
      }, function () { flushing = false; });
    })();
  }
  function hacer(op, turno, key, code) {
    if (!enLinea() || qLoad().length) { encolar(op, turno, key, code); flush(); return Promise.resolve({ queued: true }); }
    return conTope(enviar(op, turno, key, code), 5000).catch(function () { encolar(op, turno, key, code); return { queued: true }; });
  }
  function consume(turno, key, code) { return hacer("c", turno, key, code); }
  function release(turno, key, code) { return hacer("r", turno, key, code); }
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
    if (window.FB && FB.watchCfg) FB.watchCfg(function () {
      try { var s = FB.cfg().stk; if (s && Object.keys(s).length) localStorage.setItem("st3_stk", JSON.stringify(s)); } catch (e) {}
      emit();
    });
    var d0 = dbx();
    if (d0) d0.ref(".info/connected").on("value", function (s) { connected = !!s.val(); if (connected) flush(); emit(); });
    addEventListener("online", function () { flush(); emit(); });
    addEventListener("offline", function () { emit(); });
    setInterval(flush, 10000);
  }

  window.ST3Sheet = {
    PREMIOS: PREMIOS, RULETA: RULETA,
    start: start, load: load, info: info, quedan: quedan, agotado: agotado,
    consume: consume, release: release, pendientes: function () { return qLoad().length; }, enLinea: enLinea, setManual: setManual,
    onChange: function (f) { listeners.push(f); },
    ruleta: function () { return ruletaDef; },
    EXTRAS: function () { return extrasDef.slice(); },
    leyo: function () { return okAt; },
    sheetValue: function (turno, key) { return sheet[turno] && typeof sheet[turno][key] === "number" ? sheet[turno][key] : null; },
    // nombre para mostrar (el de la planilla no cambia: es la clave del stock)
    nombre: function (k) { return /^llavero +grande$/i.test(String(k)) ? "Logo grande" : k; },
    texto: function () { return null }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else setTimeout(start, 0);
})();
