# Trivia del Stream — Streaming Room T3

| Página | Link | Para qué |
| --- | --- | --- |
| Trivia (jugadores) | https://trivia-streamingroom-t3.web.app | El juego: se abre desde el celular (QR del stand). |
| Saludá a la cámara (cámara 1) | https://saluda-streamingroom-t3.web.app | Stand del saludo de la cámara 1 (QR del stand). |
| Saludá a la cámara (cámara 2) | https://saluda-streamingroom-t3.web.app/?cam=2 | Mismo saludo, cámara 2 (QR del stand). El panel admin muestra a qué cámara corresponde cada saludo. |
| Ranking para OBS | https://ranking-streamingroom-t3.web.app | Fuente de navegador en OBS: ranking en vivo con fondo transparente. |
| Juego en vivo (Rojo vs Azul) | https://trivia-streamingroom-t3.web.app/juego.html | Horarios con posición libre. La gente no se anota sola: se anota en el stand (el admin carga apodo y Gmail) y con el QR que le dan ve su turno y puede cancelar. |
| Ruleta pizarrón (stand) | https://trivia-streamingroom-t3.web.app/ruleta-pizarron.html | La ruleta que se usa en el stand, conectada al stock. Espacio o clic en el logo genera un QR único que el celular escanea para girar (una vez por celular). **P** abre el panel de premios (oculto por defecto; en la pantalla hay un cartel con los atajos). **Sin internet:** en el panel, desactivar «Pedir QR para girar» (pide la contraseña) deja girar sin QR; los premios que se gastan se guardan en el dispositivo y se descuentan del stock al volver la conexión (cartel rojo arriba a la derecha). |
| Ruleta grande (OBS) | https://trivia-streamingroom-t3.web.app/ruleta-grande.html | Ruleta grande para la transmisión, también conectada al stock. |
| Panel admin | https://admin-streamingroom-t3.web.app | Producción: preguntas, configuración, saludos, reiniciar el ranking y validar premios (con clave). |
| Bienvenida a la Muestra | https://muestra-streamingroom-t3.web.app | Página de inicio de la muestra anual: Trivia, Ruleta (con mapa del puesto), Rojo vs Azul y el directo de YouTube (QR/cartel de bienvenida). |

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
| `girar.html` | Página que abre el celular al escanear el QR de la ruleta: canjea el QR (sirve una sola vez, vence a los 2 minutos) y la ruleta gira. Cada celular gira una sola vez. En la ruleta pizarrón, Espacio o clic en el logo genera el QR; en el panel se puede desactivar o reiniciar los celulares. |
| `index.html` (trivia) | Si el premio ganado se agotó en el turno: «Lo siento, nos quedamos sin stock». Si falta el Grande pero queda Normal, entrega el Normal. |
| `saluda.html` (cámaras) | Si la bolsita Pequeño se agotó, muestra «Lo siento» en vez del QR. |
| `admin.html` | Pestaña **Stock**: tabla en vivo de los dos turnos, ajustes y selector de turno. |

Si no se puede leer la planilla (sin internet), las páginas no bloquean nada.
