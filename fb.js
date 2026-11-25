/* ============================================================
   fb.js — capa de datos compartida de la Trivia del Stream
   Usa Firebase Realtime Database si existe la config
   (fb-config.js). Si no hay config, o no hay internet, funciona
   igual pero guardando en el navegador (ranking local).
   ============================================================ */
var FB = (function () {
  var DEF = { t: 15000, n: [6, 5, 5], showRank: true, gen: 1 };
  var db = null, cfg = DEF, shared = false, lastError = "";

  try {
    if (window.FB_CONFIG && window.firebase) {
      var app;
      try { app = firebase.app(); } catch (e) { app = firebase.initializeApp(window.FB_CONFIG); }
      db = firebase.database();
      shared = true;
    }
  } catch (e) { lastError = e.message; }

  /* Celular con la pantalla apagada o la pestaña oculta: a los pocos minutos se libera su conexión con la base (se reconecta solo al volver). */
  try {
    if (db && window.FB_IDLE_MS && typeof document !== "undefined") {
      var idleT = 0;
      document.addEventListener("visibilitychange", function () {
        if (document.hidden) { idleT = setTimeout(function () { try { db.goOffline(); } catch (e) { } }, window.FB_IDLE_MS); }
        else { clearTimeout(idleT); try { db.goOnline(); } catch (e) { } }
      });
    }
  } catch (e) { }

  /* ---------- HORARIOS (hora de Argentina, con la hora del servidor) ----------
     · Turno: hasta las 12:00 es «mañana»; desde las 12:00 es «tarde». Producción puede forzar uno a mano (dura hasta el próximo cambio automático) o volver a «automático».
     · Ranking: cada turno tiene su propio ranking. Cierra a las 11:10 / 16:10 (después se puede jugar, pero ya no suma) y a las 11:10 / 16:10 se define el top 3. */
  var srvOff = 0;
  try { if (db) db.ref(".info/serverTimeOffset").on("value", function (s) { srvOff = +s.val() || 0; }); } catch (e) { }
  var HORARIOS = { cambio: 12 * 60, cierre: { manana: 11 * 60 + 10, tarde: 16 * 60 + 10 }, final: { manana: 11 * 60 + 10, tarde: 16 * 60 + 10 } };
  function ahoraAR() { var d = new Date(Date.now() + srvOff - 3 * 3600 * 1000); return { min: d.getUTCHours() * 60 + d.getUTCMinutes(), seg: d.getUTCSeconds(), dia: d.toISOString().slice(0, 10) }; }
  function turnoAuto() { return ahoraAR().min >= HORARIOS.cambio ? "tarde" : "manana"; }
  function turnoDe(m) {
    var a = ahoraAR(), auto = a.min >= HORARIOS.cambio ? "tarde" : "manana";
    if (m && (m.t === "tarde" || m.t === "manana") && m.d === a.dia && m.a === auto) return m.t;   // cambio manual: vale hasta que el automático cambie de turno
    return auto;
  }
  function nowMs() { return Date.now() + srvOff; }
  function horaAR(ms) { var d = new Date(ms - 3 * 3600 * 1000); return d.getUTCHours() + ":" + ("0" + d.getUTCMinutes()).slice(-2); }
  /* Estado del ranking de un turno: automático (cierra a las 11:10 / 16:10) o a mano (abierto, cerrado, o abierto un rato más) */
  function rankInfo(t) {
    t = t || cfg.turno; var a = ahoraAR(), m = cfg.rkm, c = HORARIOS.cierre[t];
    var o = { turno: t, modo: "auto", cerrado: a.min >= c, hora: hhmm(c), final: hhmm(c), seg: Math.max(0, c * 60 - (a.min * 60 + a.seg)) };
    if (m && m.t === t && m.d === a.dia) {
      if (m.m === "open") { o.modo = "open"; o.cerrado = false; o.seg = null; o.hora = ""; }
      else if (m.m === "closed") { o.modo = "closed"; o.cerrado = true; o.seg = 0; }
      else if (m.m === "until" && m.u) { o.modo = "until"; var r = Math.round((m.u - nowMs()) / 1000); o.cerrado = r <= 0; o.seg = Math.max(0, r); o.hora = horaAR(m.u); }
    }
    return o;
  }
  /* turno de un puntaje viejo que no lo tiene guardado: se deduce por la hora en que se jugó (desde las 12:00 = tarde) */
  function turnoDeTs(ts) { if (!ts) return "manana"; var d = new Date(ts - 3 * 3600 * 1000); return d.getUTCHours() * 60 + d.getUTCMinutes() >= HORARIOS.cambio ? "tarde" : "manana"; }
  function hhmm(min) { return Math.floor(min / 60) + ":" + ("0" + (min % 60)).slice(-2); }
  function norm(v) {
    v = v || {};
    var o = {
      t: typeof v.t === "number" ? v.t : DEF.t,
      n: (v.n && v.n.length === 3) ? v.n : DEF.n,
      showRank: v.showRank === undefined ? true : !!v.showRank,
      gen: typeof v.gen === "number" ? v.gen : DEF.gen,
      rg: (v.rs && typeof v.rs === "object" && +v.rs.allGen) || 0,   // ronda del último "Reiniciar todo" (vuelve a pedir seguir las redes)
      stk: (v.stk && typeof v.stk === "object") ? v.stk : {},   // stock en vivo por turno: stk/<turno>/<premio>/{n, used/<código>}
      tman: (v.tman && typeof v.tman === "object") ? v.tman : null,   // cambio manual de turno: {t, a (turno automático de ese momento), d (día)}
      px: (v.px && typeof v.px === "object") ? v.px : {},   // personas que producción reinició: uid -> hora
      pv: (v.pv && typeof v.pv === "object") ? v.pv : {},   // premios/QR anulados: id -> hora
      xw: (v.xw && typeof v.xw === "object") ? v.xw : {},   // en espera: terminó el experto y todavía no respondió la ventana (no aparece en el ranking)
      xs: (v.xs && typeof v.xs === "object") ? v.xs : {},   // quien rechazó el aviso al terminar el modo experto: uid -> puntos que tenía al ganar el nivel difícil (su ranking llega hasta ahí)
      rkm: (v.rkm && typeof v.rkm === "object") ? v.rkm : null,   // cierre del ranking a mano: {m: "open"|"closed"|"until", t (turno), d (día), u (hasta cuándo, ms)}
      xr: (v.xr && typeof v.xr === "object") ? v.xr : {}    // «no anotar al ranking final»: quien no va a estar o no quiere el premio (aparece en el ranking pero no entra al top 3 final)
    };
    // turno activo: se calcula con la hora (y el cambio manual si lo hay), así cambia solo a las 12:00 sin que nadie toque nada
    Object.defineProperty(o, "turno", { enumerable: true, get: function () { return turnoDe(o.tman); } });
    return o;
  }
  cfg = norm({});

  function uid() {
    var k = "trivia_uid", v = null;
    try { v = localStorage.getItem(k); } catch (e) { }
    if (!v) {
      v = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
        : "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      try { localStorage.setItem(k, v); } catch (e) { }
    }
    return v;
  }

  function lsGet(k, d) {
    try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; }
  }
  function lsSet(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { }
  }

  /* ---------- CONFIG ---------- */
  /* Copia de la configuración en el dispositivo: sirve para abrir el panel sin internet (nunca se usa si hay conexión). */
  var guardaT = 0;
  function guardarCfg(v) {
    clearTimeout(guardaT);
    guardaT = setTimeout(function () { try { localStorage.setItem("st3_cfg", JSON.stringify(v || {})); } catch (e) { } }, 800);
  }
  function loadCachedCfg() {
    try { var v = JSON.parse(localStorage.getItem("st3_cfg") || "null"); if (v) { cfg = norm(v); return v; } } catch (e) { }
    return null;
  }
  function readCfg() {
    if (!db) return Promise.resolve(cfg);
    return db.ref("cfg").once("value").then(function (s) {
      cfg = norm(s.val()); guardarCfg(s.val());
      return cfg;
    }).catch(function () { return cfg; });
  }

  var cfgWatchers = [], ultimoTurno = null;
  setInterval(function () { var t = cfg.turno; if (ultimoTurno !== null && t !== ultimoTurno) cfgWatchers.forEach(function (f) { try { f(cfg); } catch (e) { } }); ultimoTurno = t; }, 15000);
  function watchCfg(cb) {
    cfgWatchers.push(cb);
    if (!db) { cb(cfg); return; }
    db.ref("cfg").on("value", function (s) { cfg = norm(s.val()); ultimoTurno = cfg.turno; guardarCfg(s.val()); cb(cfg); },
      function (e) { lastError = e.message; });
  }

  function setCfg(patch) {
    var o = {}, k;
    for (k in patch) o[k] = patch[k];
    if (!db) { cfg = norm(Object.assign({}, cfg, o)); return Promise.resolve(cfg); }
    return db.ref("cfg").update(o).then(readCfg);
  }

  function resetRank() {
    return readCfg().then(function (c) { return setCfg({ gen: c.gen + 1 }); });
  }

  /* ---------- PREGUNTAS ---------- */
  function loadQuestions() {
    var fallback = (window.SEED || []).map(function (a, i) {
      return { id: "q" + (i + 1), q: a[0], ok: a[1], bad: a[2] || [] };
    });
    if (!db) return Promise.resolve(fallback);
    return db.ref("questions").once("value").then(function (s) {
      var v = s.val(), out = [];
      if (v) {
        Object.keys(v).sort().forEach(function (k) {
          var x = v[k];
          if (x && x.q && x.ok) out.push({ id: k, q: x.q, ok: x.ok, bad: x.bad || [] });
        });
      }
      return out.length ? out : fallback;
    }).catch(function () { return fallback; });
  }

  function saveQuestions(list) {
    if (!db) { lsSet("trivia_questions", list); return Promise.resolve(); }
    var obj = {};
    list.forEach(function (x, i) {
      var k = "q" + String(i + 1).padStart(3, "0");
      obj[k] = { q: x.q, ok: x.ok, bad: x.bad || [] };
    });
    return db.ref("questions").set(obj);
  }

  /* ---------- PUNTAJES ---------- */
  function query(gen) {
    return db.ref("scores/" + gen).orderByChild("score").limitToLast(400);
  }

  /* Quien tiene un premio con QR solo entra al ranking cuando un admin valida (reclama) ese QR en el stand.
     pend[uid] = true mientras ninguno de sus QR esté validado. Quien nunca generó un QR no se ve afectado. */
  var pend = {}, okc = {};
  function calcPend(s) {
    var tiene = {}, ok = {}, u;
    s.forEach(function (c) {
      var v = c.val() || {};
      if (!v.uid) return;
      tiene[v.uid] = 1;
      if (v.claimed === true) ok[v.uid] = 1;
    });
    okc = ok; pend = {};
    for (u in tiene) if (!ok[u]) pend[u] = true;
  }
  var pendAt = 0, pendGen = null;
  function loadPend(gen) {   // la lista de premios se baja como mucho una vez cada 30 s (antes, en cada refresco de cada celular)
    if (pendGen === gen && Date.now() - pendAt < 30000) return Promise.resolve();
    return db.ref("prizes/" + gen).once("value").then(function (s) { pendAt = Date.now(); pendGen = gen; calcPend(s); });
  }
  function isClaimed(u) { return !!okc[u || uid()]; }
  function isPending(u) { return !!pend[u || uid()]; }

  function fromSnap(s, todos) {
    var out = [];
    s.forEach(function (c) {
      if (cfg.px && cfg.px[c.key]) return;   // reiniciada por producción
      if (pend[c.key]) return;               // su QR todavía no fue validado en el stand
      if (cfg.xw && cfg.xw[c.key]) return;   // terminó el experto y no respondió todavía: en espera
      var v = c.val() || {};
      if (!todos && (v.t || turnoDeTs(v.ts)) !== cfg.turno) return;   // cada turno tiene su ranking: se ve solo el del turno activo
      var sc = (v.c !== undefined && v.c !== null) ? (v.c | 0) : (v.score | 0), lv = v.lvl || 1;   // c = lo que sumó antes del cierre del ranking
      if (cfg.xs && cfg.xs[c.key] != null) { sc = Math.min(sc, cfg.xs[c.key] | 0); lv = Math.min(lv, 3); }   // rechazó seguir: cuenta solo hasta el nivel difícil
      out.push({ id: c.key, uid: c.key, name: v.name || "?", score: sc, lvl: lv, ts: v.ts || 0, t: v.t || turnoDeTs(v.ts) });
    });
    out.sort(function (a, b) { return b.score - a.score || a.ts - b.ts; });
    return out;
  }

  function localScores() {
    return lsGet("trivia_scores", []).filter(function (x) { return x && (x.score | 0) > 0; })
      .sort(function (a, b) { return b.score - a.score; });
  }

  function listScores() {
    if (!db) return Promise.resolve(localScores());
    return readCfg().then(function (c) {
      return loadPend(c.gen).then(function () { return query(c.gen).once("value"); }).then(fromSnap);
    }).catch(function () { return localScores(); });
  }

  function watchScores(cb) {
    if (!db) { cb(localScores()); return; }
    readCfg().then(function (c) { return loadPend(c.gen).catch(function () {}).then(function () { return c; }); }).then(function (c) {
      var last = null, bound = c.gen, qRef = null, qH = null, pRef = null, pH = null;
      /* El ranking y los premios se miran de la ronda (gen) actual. Si el admin hace «Reiniciar todo», se vuelve a mirar la ronda nueva sin recargar */
      function bind(g) {
        if (qRef) qRef.off("value", qH); if (pRef) pRef.off("value", pH);
        bound = g; last = null; pend = {}; okc = {}; pendGen = null;
        qRef = query(g); qH = qRef.on("value", function (s) { last = s; cb(fromSnap(s)); }, function (e) { lastError = e.message; });
        pRef = db.ref("prizes/" + g); pH = pRef.on("value", function (s) { calcPend(s); if (last) cb(fromSnap(last)); });
        cb([]);
      }
      qRef = query(c.gen); qH = qRef.on("value", function (s) { last = s; cb(fromSnap(s)); }, function (e) { lastError = e.message; });
      db.ref("cfg/gen").on("value", function (s) { var g = s.val(); if (typeof g === "number" && g !== bound) { cfg.gen = g; bind(g); } });
      db.ref("cfg/px").on("value", function (s) { cfg.px = s.val() || {}; if (last) cb(fromSnap(last)); });
      db.ref("cfg/xs").on("value", function (s) { cfg.xs = s.val() || {}; if (last) cb(fromSnap(last)); });
      db.ref("cfg/xw").on("value", function (s) { cfg.xw = s.val() || {}; if (last) cb(fromSnap(last)); });
      setInterval(function () { if (last) cb(fromSnap(last)); }, 60000);   // si el turno cambia solo por la hora, el ranking cambia al del turno nuevo
      pRef = db.ref("prizes/" + c.gen); pH = pRef.on("value", function (s) { calcPend(s); if (last) cb(fromSnap(last)); });
    });
  }

  function saveScore(rec) {
    if (!db) {
      var l = lsGet("trivia_scores", []).filter(function (x) { return x.uid !== rec.uid; });
      l.push(rec); lsSet("trivia_scores", l);
      return Promise.resolve();
    }
    return readCfg().then(function (c) {
      var t = rec.t === "tarde" ? "tarde" : (rec.t === "manana" ? "manana" : c.turno), tarde = rankInfo(t).cerrado;
      var up = { name: rec.name, score: rec.score | 0, lvl: rec.lvl || 1, ts: rec.ts || Date.now(), t: t };
      if (!tarde) up.c = rec.score | 0;    // si ya cerró el ranking de su turno, el puntaje sigue creciendo pero lo que cuenta queda en el de antes del cierre
      return db.ref("scores/" + c.gen + "/" + rec.uid).update(up);
    });
  }

  return {
    shared: function () { return shared; },
    error: function () { return lastError; },
    uid: uid,
    readCfg: readCfg,
    loadCachedCfg: loadCachedCfg,
    watchCfg: watchCfg,
    setCfg: setCfg,
    resetRank: resetRank,
    cfg: function () { return cfg; },
    ahoraAR: ahoraAR, turnoAuto: turnoAuto, HORARIOS: HORARIOS, hhmm: hhmm,
    /* ¿ya cerró el ranking de este turno? {cerrado, hora} */
    rankInfo: rankInfo,
    turnoDeTs: turnoDeTs,
    /* cierre a mano: modo "open" (abierto hasta que lo cambien), "closed" (cerrado ya) o "until" (abierto N minutos desde ahora). Vale para el turno activo y ese día. */
    setRankMode: function (modo, mins) { var o = { m: modo, t: cfg.turno, d: ahoraAR().dia }; if (modo === "until") o.u = nowMs() + Math.round(mins * 60000); return db ? db.ref("cfg/rkm").set(o).then(readCfg) : Promise.resolve(cfg); },
    clearRankMode: function () { return db ? db.ref("cfg/rkm").remove().then(readCfg) : Promise.resolve(cfg); },
    setTurnoManual: function (t) { var a = ahoraAR(); return db ? db.ref("cfg/tman").set({ t: t, a: turnoAuto(), d: a.dia, ts: firebase.database.ServerValue.TIMESTAMP }).then(readCfg) : Promise.resolve(cfg); },
    clearTurnoManual: function () { return db ? db.ref("cfg/tman").remove().then(readCfg) : Promise.resolve(cfg); },
    setXr: function (u, on) { cfg.xr = cfg.xr || {}; if (on) cfg.xr[u] = Date.now(); else delete cfg.xr[u]; return db ? db.ref("cfg/xr/" + u).set(on ? firebase.database.ServerValue.TIMESTAMP : null) : Promise.resolve(); },
    loadQuestions: loadQuestions,
    saveQuestions: saveQuestions,
    setXw: function (u, on) { cfg.xw = cfg.xw || {}; if (on) cfg.xw[u] = true; else delete cfg.xw[u]; return db ? db.ref("cfg/xw/" + u).set(on ? true : null) : Promise.resolve(); },
    clearXs: function (u) { cfg.xs = cfg.xs || {}; delete cfg.xs[u]; return db ? db.ref("cfg/xs/" + u).remove() : Promise.resolve(); },
    setXs: function (u, pts) { cfg.xs = cfg.xs || {}; cfg.xs[u] = pts | 0; return db ? db.ref("cfg/xs/" + u).set(pts | 0) : Promise.resolve(); },
    listScores: listScores,
    fromSnap: fromSnap,
    /* ¿ya se reclamó (se validó en el stand) este premio? Avisa al instante, también si el admin lo revierte (cfg/ovp) */
    watchPrize: function (gen, id, cb) {
      if (!db) return function () { };
      var p = null, o = null, rp = db.ref("prizes/" + gen + "/" + id), ro = db.ref("cfg/ovp/" + id);
      function ev() { var s = o && o.s; cb(s === "c" ? true : (s === "p" ? false : !!(p && p.claimed === true))); }
      var a = rp.on("value", function (s) { p = s.val(); ev(); }, function () { }), b = ro.on("value", function (s) { o = s.val(); ev(); }, function () { });
      return function () { rp.off("value", a); ro.off("value", b); };
    },
    watchScores: watchScores,
    saveScore: saveScore,
    isPending: isPending,
    isClaimed: isClaimed,
    lsGet: lsGet,
    lsSet: lsSet
  };
})();
