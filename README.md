# Trivia del Stream — Streaming Room T3

| Página | Link | Para qué |
| --- | --- | --- |
| Trivia (jugadores) | https://trivia-streamingroom-t3.web.app | El juego: se abre desde el celular (QR del stand). |
| Saludá a la cámara (cámara 1) | https://saluda-streamingroom-t3.web.app | Stand del saludo de la cámara 1 (QR del stand). |
| Saludá a la cámara (cámara 2) | https://saluda-streamingroom-t3.web.app/?cam=2 | Mismo saludo, cámara 2 (QR del stand). El panel admin muestra a qué cámara corresponde cada saludo. |
| Ranking para OBS | https://ranking-streamingroom-t3.web.app | Fuente de navegador en OBS: ranking en vivo con fondo transparente. |
| Juego en vivo (Rojo vs Azul) | https://trivia-streamingroom-t3.web.app/juego.html | Horarios con posición libre. La gente pide su lugar sola (apodo + Gmail) y recibe un QR único con el aviso «todavía no estás anotado»; el lugar solo cuenta cuando el admin escanea ese QR (pestaña Escanear) y toca Aceptar. Ya anotada, la persona puede invitar a un compañero con otro QR (que también pasa por el admin) o salir del juego. El admin también puede anotar a alguien en el momento (➕ Anotar). |
| Ruleta pizarrón (stand) | https://trivia-streamingroom-t3.web.app/ruleta-pizarron.html | La ruleta que se usa en el stand, conectada al stock. Espacio o clic en el logo genera un QR único que el celular escanea para girar (una vez por celular). **P** abre el panel de premios (oculto por defecto; en la pantalla hay un cartel con los atajos). **Sin internet:** en el panel, desactivar «Pedir QR para girar» (pide la contraseña) deja girar sin QR; los premios que se gastan se guardan en el dispositivo y se descuentan del stock al volver la conexión (cartel rojo arriba a la derecha). |
| Ruleta grande (OBS) | https://trivia-streamingroom-t3.web.app/ruleta-grande.html | Ruleta grande para la transmisión, también conectada al stock. |
| Guía del staff | https://trivia-streamingroom-t3.web.app/tutorial-staff.html | Tutorial ilustrado para el staff: panel admin, ruleta, Rojo vs Azul, cámaras, stock y qué hacer si se cae internet. Funciona sin conexión. También está en PDF en la carpeta «Muestra anual» del Drive. |
| Panel admin | https://admin-streamingroom-t3.web.app | Producción: preguntas, configuración, saludos, reiniciar el ranking y validar premios (con clave). |
| Bienvenida a la Muestra | https://muestra-streamingroom-t3.web.app | Página de inicio de la muestra anual: Trivia, Ruleta (con mapa del puesto), Rojo vs Azul y el directo de YouTube (QR/cartel de bienvenida). |

Las direcciones de GitHub Pages (`ale3317h.github.io/trivia-input/...`) siguen funcionando con los mismos datos, como respaldo.

## Sin conexión (solo cuando no hay internet)

Todas las páginas se pueden abrir sin internet (`sw.js`, un service worker). **Con internet todo funciona igual que siempre**: se pide primero a la red y la copia guardada solo se usa si la red falla.

**Antes del evento (con internet):** en cada dispositivo del staff, abrir una vez cada página que se vaya a usar (admin, ruleta pizarrón, etc.) con la misma dirección que se va a usar después. Desde ahí la página queda guardada en el dispositivo y se actualiza sola cada vez que se abre con internet.

**Panel admin sin internet** (cartel rojo arriba: «Sin internet · trabajando con la copia de este dispositivo»):
- Abre con la última copia de premios, saludos, ranking, stock y Rojo vs Azul.
- **Reclamar premios:** con el escáner o escribiendo el código. Si el jugador está en la copia, queda reclamado en ese dispositivo (etiqueta «SIN SUBIR»). Si no estaba y el QR se escanea con la cámara, se comprueba la firma del código sin internet y se reclama; si no se puede comprobar, el staff elige qué premio llevó (Normal, Grande o Especial).
- **Stock:** se descuenta en el dispositivo (también lo que gasta la ruleta) y se sube al volver la conexión. El código es el mismo, así que si otro dispositivo lo reclama con internet no se descuenta dos veces.
- **Rojo vs Azul:** anotar, quitar, marcar jugado/lleno/suspendido (descuenta el stock) y QR de cada persona (funciona cuando el dispositivo recupere internet).
- **Al volver la conexión** todo se sube solo, en orden. Si otro dispositivo ya había reclamado el mismo premio, avisa.
- Lo que necesita internet (reiniciar, anular, bloquear, revertir un premio ya subido, saludos de las cámaras, editar preguntas) avisa que no se puede en este momento.
- Límite: si dos dispositivos trabajan sin internet a la vez no se ven entre sí; con un solo dispositivo por función no hay conflictos.

**Ruleta pizarrón:** abre sin internet; ver «Modo sin internet» en el panel (P).

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
