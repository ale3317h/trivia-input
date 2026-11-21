/**
 * Base de datos global de ST3 Room (Plan de premios Muestra anual 2026).
 * Se despliega como "Aplicación web" desde el propio Google Sheet (Extensiones > Apps Script).
 *
 *   GET  ?action=plan                 -> qué lleva cada premio + stock de los dos turnos
 *   GET  ?action=stock&turno=manana   -> stock de un turno (manana | tarde)
 *   POST {action:"entregar"|"revertir", turno, premio, codigo}   (cuerpo de texto con JSON)
 *
 * El stock vive en las pestañas "Hoja en vivo turno mañana" y "Hoja en vivo turno tarde".
 * Cada entrega se anota en esas hojas (columnas H:K) y la columna "Entregados" se recalcula sola.
 */
var HOJAS = { manana: 'Hoja en vivo turno mañana', tarde: 'Hoja en vivo turno tarde' };
var PREMIOS = ['Normal', 'Grande', 'Especial', 'Pequeño'];
var FILA_INI = 5, FILA_FIN = 8;      // filas de los premios en la hoja en vivo
var LOG_INI = 5;                     // primera fila del registro de entregas
var LOG_MAX = 300;                   // última fila que mira la fórmula de "Entregados"

function doGet(e) {
  var a = (e && e.parameter && e.parameter.action) || 'plan';
  try {
    if (a === 'stock') return json_({ ok: true, stock: stock_(e.parameter.turno) });
    return json_({ ok: true, premios: premios_(), stock: { manana: stock_('manana'), tarde: stock_('tarde') } });
  } catch (err) { return json_({ ok: false, error: String(err) }); }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var d = JSON.parse(e.postData.contents || '{}');
    var hoja = hoja_(d.turno);
    var premio = String(d.premio || ''), codigo = String(d.codigo || '');
    if (PREMIOS.indexOf(premio) < 0) throw 'Premio desconocido: ' + premio;
    if (!codigo) throw 'Falta el código';
    var res = d.action === 'revertir' ? revertir_(hoja, codigo) : entregar_(hoja, codigo, premio);
    SpreadsheetApp.flush();
    return json_({ ok: true, resultado: res, stock: stock_(d.turno) });
  } catch (err) { return json_({ ok: false, error: String(err) }); }
  finally { try { lock.releaseLock(); } catch (x) {} }
}

function entregar_(hoja, codigo, premio) {
  var fila = buscar_(hoja, codigo);
  if (fila) {
    if (hoja.getRange(fila, 11).getValue() === 'entregado') return 'ya estaba entregado';
    hoja.getRange(fila, 9, 1, 3).setValues([[new Date(), premio, 'entregado']]);
    return 'entregado de nuevo';
  }
  var col = hoja.getRange(LOG_INI, 8, LOG_MAX - LOG_INI + 1, 1).getValues();
  var i = 0;
  while (i < col.length && col[i][0] !== '') i++;
  if (i >= col.length) throw 'El registro de la hoja está lleno';
  hoja.getRange(LOG_INI + i, 8, 1, 4).setValues([[codigo, new Date(), premio, 'entregado']]);
  return 'entregado';
}

function revertir_(hoja, codigo) {
  var fila = buscar_(hoja, codigo);
  if (!fila) return 'no estaba anotado';
  hoja.getRange(fila, 11).setValue('revertido');
  return 'revertido';
}

function buscar_(hoja, codigo) {
  var col = hoja.getRange(LOG_INI, 8, LOG_MAX - LOG_INI + 1, 1).getValues();
  for (var i = 0; i < col.length; i++) if (String(col[i][0]) === codigo) return LOG_INI + i;
  return 0;
}

function hoja_(turno) {
  var n = HOJAS[turno];
  if (!n) throw 'Turno desconocido: ' + turno;
  var h = SpreadsheetApp.getActive().getSheetByName(n);
  if (!h) throw 'No existe la pestaña ' + n;
  return h;
}

function stock_(turno) {
  var v = hoja_(turno).getRange(FILA_INI, 1, FILA_FIN - FILA_INI + 1, 6).getValues(), o = {};
  v.forEach(function (r) {
    o[r[0]] = { puesto: r[1], stock: Number(r[2]) || 0, entregados: Number(r[3]) || 0, quedan: Number(r[4]) || 0, estado: r[5] };
  });
  return o;
}

// Qué lleva cada premio (hoja Premios, filas 5 a 8)
function premios_() {
  var h = SpreadsheetApp.getActive().getSheetByName('Premios');
  var v = h.getRange(4, 1, 5, 12).getValues(), cab = v[0], o = {};
  var nombres = { 2: ['caramelo', 'caramelos'], 3: ['sticker', 'stickers'], 4: ['sticker a elección', 'stickers a elección'],
    5: ['logo plano', 'logos planos'], 6: ['logo 3D', 'logos 3D'], 7: ['logo grande', 'logos grandes'],
    8: ['lapicera', 'lapiceras'], 9: ['lapicera personalizada', 'lapiceras personalizadas'],
    10: ['cuaderno', 'cuadernos'], 11: ['cuaderno premium', 'cuadernos premium'] };
  for (var i = 1; i < v.length; i++) {
    var partes = [], items = [];
    for (var c = 2; c < 12; c++) {
      var n = Number(v[i][c]) || 0;
      if (n > 0) { partes.push(n + ' ' + nombres[c][n === 1 ? 0 : 1]); items.push({ material: cab[c], cantidad: n }); }
    }
    o[v[i][0]] = { texto: partes.join(' + '), items: items };
  }
  return o;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
