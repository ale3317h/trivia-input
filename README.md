# Trivia del Stream — Streaming Room T3

| Página | Link | Para qué |
| --- | --- | --- |
| Trivia (jugadores) | https://trivia-streamingroom-t3.web.app | El juego: se abre desde el celular (QR del stand). |
| Saludá a la cámara (cámara 1) | https://saluda-streamingroom-t3.web.app | Stand del saludo de la cámara 1 (QR del stand). |
| Saludá a la cámara (cámara 2) | https://saluda-streamingroom-t3.web.app/?cam=2 | Mismo saludo, cámara 2 (QR del stand). El panel admin muestra a qué cámara corresponde cada saludo. |
| Ranking para OBS | https://ranking-streamingroom-t3.web.app | Fuente de navegador en OBS: ranking en vivo con fondo transparente. |
| Juego en vivo (anotarse) | https://trivia-streamingroom-t3.web.app/juego.html | Página para que la gente se anote y reserve su lugar (Rojo vs Azul) con nombre y Gmail. |
| Panel admin | https://admin-streamingroom-t3.web.app | Producción: preguntas, configuración, saludos, reiniciar el ranking y validar premios (con clave). |

Las direcciones de GitHub Pages (`ale3317h.github.io/trivia-input/...`) siguen funcionando con los mismos datos, como respaldo.

## Base de datos global del stock (planilla + Firebase)

Todo el stock de premios sale de la **Planilla de Google "Plan de premios Muestra anual 2026"** y se muestra en vivo en todas las páginas:

- **Stock del turno:** producción lo edita en las celdas azules de las pestañas **Hoja en vivo turno mañana** y **Hoja en vivo turno tarde** (bolsitas Normal, Grande, Especial y Pequeño, y los ocho premios de la ruleta). Las páginas lo leen solas cada 15 segundos, sin iniciar sesión. La planilla tiene que estar compartida como «cualquier persona con el enlace puede ver».
- **Entregas:** las cuenta Firebase (`cfg/stk/<turno>/<premio>/used`). Quedan = stock de la planilla menos lo entregado. En el admin, pestaña **Stock**, la columna «Ajuste» corrige un número sin tocar la planilla (`cfg/stk/<turno>/<premio>/n`).
- **Turno activo:** se elige en el admin, pestaña Stock. Decide qué hoja manda.
- Se descuenta al marcar un premio como entregado (admin), al girar la ruleta y al canjear un saludo de cámara. Revertir lo devuelve.

| Página | Qué hace |
| --- | --- |
| `premios.html` | Premios en gráficos (bolsitas, puestos). |
| `juego.html` | **Juego en vivo** (Rojo vs Azul): reserva de lugares por horario (turno mañana 9:30 a 11:00 y tarde 14:30 a 16:00, cada 15 min, 2 por equipo). Se anota con nombre y Gmail (guardado cifrado: solo se lee en el admin, pestaña Juego, con la clave), puede guardar el lugar 5 min para un compañero una sola vez e invitarlo con un QR único que se usa una vez. |
| `ruleta-grande.html` | **Ruleta grande** (la de OBS) conectada a la planilla: premios y porciones de la hoja «Ruleta»; las porciones sin stock en el turno quedan grises y dicen «NADA». Descuenta al entregar y permite deshacer. |
| `ruleta-pizarron.html` | **Ruleta pizarrón** (estética de los carteles de la muestra): misma conexión con la planilla y el stock que la ruleta grande. Tabla de premios a la izquierda con chance y stock (se activa o desactiva desde el panel), la ruleta se agranda al girar y vuelve al cerrar el premio, logo de tiza en el centro y simulador de tiradas con contraseña (no toca el stock real). Usa `fondo-pizarron.webp` y `logo-pizarron.webp`. |
| `index.html` (trivia) | Si el premio ganado se agotó en el turno: «Lo siento, nos quedamos sin stock». Si falta el Grande pero queda Normal, entrega el Normal. |
| `saluda.html` (cámaras) | Si la bolsita Pequeño se agotó, muestra «Lo siento» en vez del QR. |
| `admin.html` | Pestaña **Stock**: tabla en vivo de los dos turnos, ajustes y selector de turno. |

Si no se puede leer la planilla (sin internet), las páginas no bloquean nada.
