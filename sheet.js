/* Base de datos global: el Excel "Plan de premios Muestra anual 2026", vía Apps Script.
   Lo usan todas las páginas. Si no hay URL o falla la conexión, devuelve null y cada página
   sigue con sus datos incorporados (nunca bloquea el juego por un error de red). */
(function () {
  var URL_ = function () { return (window.ST3_SHEET_URL || "").trim(); };
  var data = null, at = 0, pending = null;
  try { data = JSON.parse(localStorage.getItem("st3_sheet") || "null"); } catch (e) {}

  function timeout(ms) {
    var c = new AbortController(); setTimeout(function () { c.abort(); }, ms); return c.signal;
  }
  /* Modo Firebase (por defecto, sin URL de Apps Script): el stock vive en cfg/stk y lo edita producción en el admin. */
  function fbStock(turno, premio) {
    var c = window.FB && FB.cfg && FB.cfg(), t = c && c.stk && c.stk[turno], p = t && t[premio];
    if (!p || typeof p.n !== "number") return null;
    var used = p.used ? Object.keys(p.used).length : 0;
    return { stock: p.n, entregados: used, quedan: p.n - used };
  }
  function load(force, ms) {
    if (!URL_()) return (window.FB && FB.readCfg ? FB.readCfg() : Promise.resolve()).then(function () { return null; }, function () { return null; });
    if (!force && data && Date.now() - at < 20000) return Promise.resolve(data);
    if (pending) return pending;
    pending = fetch(URL_() + "?action=plan&t=" + Date.now(), { signal: timeout(ms || 4000) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.ok) throw new Error((j && j.error) || "respuesta inválida");
        data = j; at = Date.now();
        try { localStorage.setItem("st3_sheet", JSON.stringify(j)); } catch (e) {}
        return data;
      })
      .catch(function () { return null; })
      .then(function (d) { pending = null; return d; });
    return pending;
  }
  function stock(turno, premio) {
    if (!URL_()) return fbStock(turno, premio);
    var s = data && data.stock && data.stock[turno];
    return s && s[premio] ? s[premio] : null;
  }
  /* true solo si la hoja del turno dice que ese premio ya no tiene stock */
  function agotado(turno, premio) {
    var s = stock(turno, premio);
    return !!(s && s.quedan <= 0);
  }
  function texto(premio) {
    var p = data && data.premios && data.premios[premio];
    return p && p.texto ? p.texto : null;
  }
  function send(action, turno, premio, codigo) {
    if (!URL_()) return Promise.resolve(null);
    return fetch(URL_(), { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: action, turno: turno, premio: premio, codigo: codigo }), signal: timeout(10000) })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.ok && j.stock && data) { data.stock[turno] = j.stock; at = Date.now(); } return j; })
      .catch(function (e) { return { ok: false, error: String((e && e.message) || e) }; });
  }
  window.ST3Sheet = {
    load: load, stock: stock, agotado: agotado, texto: texto,
    entregar: function (t, p, c) { return send("entregar", t, p, c); },
    revertir: function (t, p, c) { return send("revertir", t, p, c); },
    activo: function () { return !!URL_(); },   // true = modo Apps Script; false = modo Firebase
    data: function () { return data; }
  };
})();
