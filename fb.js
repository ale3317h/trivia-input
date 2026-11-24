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
      pv: (v.pv && typeof v.pv === "object") ? v.pv : {}    // premios/QR anulados: id -> hora
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
  function readCfg() {
    if (!db) return Promise.resolve(cfg);
    return db.ref("cfg").once("value").then(function (s) {
      cfg = norm(s.val());
      return cfg;
    }).catch(function () { return cfg; });
  }

  function watchCfg(cb) {
    if (!db) { cb(cfg); return; }
    db.ref("cfg").on("value", function (s) { cfg = norm(s.val()); cb(cfg); },
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
  function loadPend(gen) { return db.ref("prizes/" + gen).once("value").then(calcPend); }
  function isClaimed(u) { return !!okc[u || uid()]; }
  function isPending(u) { return !!pend[u || uid()]; }

  function fromSnap(s) {
    var out = [];
    s.forEach(function (c) {
      if (cfg.px && cfg.px[c.key]) return;   // reiniciada por producción
      if (pend[c.key]) return;               // su QR todavía no fue validado en el stand
      var v = c.val() || {};
      out.push({ id: c.key, uid: c.key, name: v.name || "?", score: v.score | 0, lvl: v.lvl || 1, ts: v.ts || 0 });
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
    watchCfg: watchCfg,
    setCfg: setCfg,
    resetRank: resetRank,
    cfg: function () { return cfg; },
    loadQuestions: loadQuestions,
    saveQuestions: saveQuestions,
    listScores: listScores,
    watchScores: watchScores,
    saveScore: saveScore,
    isPending: isPending,
    isClaimed: isClaimed,
    lsGet: lsGet,
    lsSet: lsSet
  };
})();
