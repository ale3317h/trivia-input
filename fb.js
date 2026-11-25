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

  function norm(v) {
    v = v || {};
    return {
      t: typeof v.t === "number" ? v.t : DEF.t,
      n: (v.n && v.n.length === 3) ? v.n : DEF.n,
      showRank: v.showRank === undefined ? true : !!v.showRank,
      gen: typeof v.gen === "number" ? v.gen : DEF.gen,
      rg: (v.rs && typeof v.rs === "object" && +v.rs.allGen) || 0,   // ronda del último "Reiniciar todo" (vuelve a pedir seguir las redes)
      stk: (v.stk && typeof v.stk === "object") ? v.stk : {},   // stock en vivo por turno: stk/<turno>/<premio>/{n, used/<código>}
      turno: v.turno === "tarde" ? "tarde" : "manana",   // turno activo (lo elige producción en el admin): decide qué hoja en vivo manda
      px: (v.px && typeof v.px === "object") ? v.px : {},   // personas que producción reinició: uid -> hora
      pv: (v.pv && typeof v.pv === "object") ? v.pv : {},   // premios/QR anulados: id -> hora
      xw: (v.xw && typeof v.xw === "object") ? v.xw : {},   // en espera: terminó el experto y todavía no respondió la ventana (no aparece en el ranking)
      xs: (v.xs && typeof v.xs === "object") ? v.xs : {}    // quien rechazó el aviso al terminar el modo experto: uid -> puntos que tenía al ganar el nivel difícil (su ranking llega hasta ahí)
    };
  }

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

  function watchCfg(cb) {
    if (!db) { cb(cfg); return; }
    db.ref("cfg").on("value", function (s) { cfg = norm(s.val()); guardarCfg(s.val()); cb(cfg); },
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

  function fromSnap(s) {
    var out = [];
    s.forEach(function (c) {
      if (cfg.px && cfg.px[c.key]) return;   // reiniciada por producción
      if (pend[c.key]) return;               // su QR todavía no fue validado en el stand
      if (cfg.xw && cfg.xw[c.key]) return;   // terminó el experto y no respondió todavía: en espera
      var v = c.val() || {};
      var sc = v.score | 0, lv = v.lvl || 1;
      if (cfg.xs && cfg.xs[c.key] != null) { sc = Math.min(sc, cfg.xs[c.key] | 0); lv = Math.min(lv, 3); }   // rechazó seguir: cuenta solo hasta el nivel difícil
      out.push({ id: c.key, uid: c.key, name: v.name || "?", score: sc, lvl: lv, ts: v.ts || 0 });
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
      var last = null;
      query(c.gen).on("value", function (s) { last = s; cb(fromSnap(s)); }, function (e) { lastError = e.message; });
      db.ref("cfg/px").on("value", function (s) { cfg.px = s.val() || {}; if (last) cb(fromSnap(last)); });
      db.ref("cfg/xs").on("value", function (s) { cfg.xs = s.val() || {}; if (last) cb(fromSnap(last)); });
      db.ref("cfg/xw").on("value", function (s) { cfg.xw = s.val() || {}; if (last) cb(fromSnap(last)); });
      db.ref("prizes/" + c.gen).on("value", function (s) { calcPend(s); if (last) cb(fromSnap(last)); });
    });
  }

  function saveScore(rec) {
    if (!db) {
      var l = lsGet("trivia_scores", []).filter(function (x) { return x.uid !== rec.uid; });
      l.push(rec); lsSet("trivia_scores", l);
      return Promise.resolve();
    }
    return readCfg().then(function (c) {
      return db.ref("scores/" + c.gen + "/" + rec.uid).set({
        name: rec.name, score: rec.score | 0, lvl: rec.lvl || 1, ts: rec.ts || Date.now()
      });
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
    loadQuestions: loadQuestions,
    saveQuestions: saveQuestions,
    setXw: function (u, on) { cfg.xw = cfg.xw || {}; if (on) cfg.xw[u] = true; else delete cfg.xw[u]; return db ? db.ref("cfg/xw/" + u).set(on ? true : null) : Promise.resolve(); },
    setXs: function (u, pts) { cfg.xs = cfg.xs || {}; cfg.xs[u] = pts | 0; return db ? db.ref("cfg/xs/" + u).set(pts | 0) : Promise.resolve(); },
    listScores: listScores,
    watchScores: watchScores,
    saveScore: saveScore,
    isPending: isPending,
    isClaimed: isClaimed,
    lsGet: lsGet,
    lsSet: lsSet
  };
})();
