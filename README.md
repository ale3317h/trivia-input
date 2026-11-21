# Trivia del Stream — Streaming Room T3

| Página | Link | Para qué |
| --- | --- | --- |
| Trivia (jugadores) | https://trivia-streamingroom-t3.web.app | El juego: se abre desde el celular (QR del stand). |
| Saludá a la cámara (cámara 1) | https://saluda-streamingroom-t3.web.app | Stand del saludo de la cámara 1 (QR del stand). |
| Saludá a la cámara (cámara 2) | https://saluda-streamingroom-t3.web.app/?cam=2 | Mismo saludo, cámara 2 (QR del stand). El panel admin muestra a qué cámara corresponde cada saludo. |
| Ranking para OBS | https://ranking-streamingroom-t3.web.app | Fuente de navegador en OBS: ranking en vivo con fondo transparente. |
| Panel admin | https://admin-streamingroom-t3.web.app | Producción: preguntas, configuración, saludos, reiniciar el ranking y validar premios (con clave). |

Las direcciones de GitHub Pages (`ale3317h.github.io/trivia-input/...`) siguen funcionando con los mismos datos, como respaldo.

## Stock en vivo por turno

El plan de premios (Planilla de Google **Plan de premios Muestra anual 2026**) tiene las pestañas
**Hoja en vivo turno mañana** y **Hoja en vivo turno tarde** como referencia en papel.
El stock que usa la trivia vive en Firebase () y se maneja desde el admin:

- Admin, Ajustes: elegir el **turno activo** (mañana o tarde) y cargar el **stock del turno** de Normal, Grande, Especial y Pequeño (botón con los valores del plan: 60 / 32 / 3 / 18).
- Al marcar un premio como entregado en el admin se descuenta del turno activo; al revertirlo se devuelve.
- Trivia: si el premio ganado ya no tiene stock en el turno activo muestra «Lo siento, nos quedamos sin stock» y no genera QR. Si falta el Grande pero queda Normal, entrega el Normal. Si el stock de ese premio no está cargado, no bloquea nada.

### Opcional: leer y escribir la planilla con Apps Script
 hace lo mismo contra las pestañas de la planilla. Para usarlo: pegarlo en Extensiones > Apps Script
(con la cuenta dueña de la planilla), implementar como aplicación web (ejecutar como *Yo*, acceso *Cualquier persona*) y pegar la URL
que termina en  en  (). Con la URL vacía se usa Firebase.
