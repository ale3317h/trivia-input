# Instrucciones para asistentes de IA que trabajen en este repo

## Publicar (Firebase Hosting)
- Los 5 sitios (`trivia-`, `admin-`, `saluda-`, `ranking-`, `muestra-streamingroom-t3.web.app`) son **sitios del mismo proyecto `trivia-input`**. No son proyectos separados.
- La computadora ya tiene la sesión de Firebase CLI con permisos. No hace falta pedir acceso ni cambiar de cuenta.
- Después de cada cambio: commit (en español) + push a `main` + `bash desplegar.sh`.
- No copiar archivos a mano a ningún lado ni publicar solo un sitio: el script publica los cinco.
- Antes de editar: `git pull`. Puede haber otra sesión trabajando en paralelo.

## Cuidados
- Los textos de la web van en castellano rioplatense.
- Probar sin tocar datos reales de la base. No usar el puerto local 8765 (lo usa otro programa del usuario); usar 8791.
- La guía del staff es `tutorial-staff.html`: actualizarla cuando cambie algo que el staff tenga que hacer.
- Los mails a ganadores los manda un Google Apps Script externo (constante `MAIL_API` en `admin.html`).
