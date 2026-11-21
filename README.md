# Trivia del Stream — Streaming Room T3

| Página | Link | Para qué |
| --- | --- | --- |
| Trivia (jugadores) | https://trivia-streamingroom-t3.web.app | El juego: se abre desde el celular (QR del stand). |
| Saludá a la cámara (cámara 1) | https://saluda-streamingroom-t3.web.app | Stand del saludo de la cámara 1 (QR del stand). |
| Saludá a la cámara (cámara 2) | https://saluda-streamingroom-t3.web.app/?cam=2 | Mismo saludo, cámara 2 (QR del stand). El panel admin muestra a qué cámara corresponde cada saludo. |
| Ranking para OBS | https://ranking-streamingroom-t3.web.app | Fuente de navegador en OBS: ranking en vivo con fondo transparente. |
| Panel admin | https://admin-streamingroom-t3.web.app | Producción: preguntas, configuración, saludos, reiniciar el ranking y validar premios (con clave). |

Las direcciones de GitHub Pages (`ale3317h.github.io/trivia-input/...`) siguen funcionando con los mismos datos, como respaldo.

## Excel como base de datos global y stock en vivo

El Excel **Plan de premios Muestra anual 2026** es la base de datos de todas las páginas.
Tiene dos pestañas de stock en vivo: **Hoja en vivo turno mañana** y **Hoja en vivo turno tarde**
(stock del turno, entregados, quedan y estado de Normal, Grande, Especial y Pequeño).

- `apps-script/Code.gs`: script que lee y escribe esas hojas. Se despliega una sola vez.
- `sheet.js`: lo usan todas las páginas para leer el plan y el stock (y descontar al entregar).
- `sheet-config.js`: acá se pega la URL de la aplicación web de Apps Script.
- Admin, Ajustes: selector de **turno activo**. El stock que manda es el de la hoja de ese turno.
- Trivia: si el premio que ganó la persona ya no tiene stock en el turno activo, muestra «Lo siento, nos quedamos sin stock» y no genera QR. Si falta el Grande pero queda Normal, entrega el Normal.
- Admin: al marcar un premio como entregado se anota en la hoja del turno (y se descuenta); al revertirlo se devuelve.

### Puesta en marcha (una vez)
1. Abrir el Excel, Extensiones, Apps Script, pegar `apps-script/Code.gs` y guardar.
2. Implementar, Nueva implementación, tipo **Aplicación web**: ejecutar como *Yo*, acceso *Cualquier persona*.
3. Copiar la URL que termina en `/exec` y pegarla en `sheet-config.js` (`window.ST3_SHEET_URL`).
4. Subir los cambios y publicar. Mientras la URL esté vacía todo funciona como antes, sin control de stock.
