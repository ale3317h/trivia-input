#!/usr/bin/env bash
# Publica la web en los 5 sitios de Firebase Hosting (proyecto trivia-input).
# Uso (Git Bash, desde la carpeta del repo, con los cambios ya commiteados):  bash desplegar.sh
# Publica lo que está en el último commit (HEAD). Usa la sesión de Firebase CLI de la computadora (firebase login:list).
set -e
cd "$(dirname "$0")"
git pull --ff-only -q
D=$(mktemp -d)
for pair in trivia:index admin:admin saluda:saluda ranking:ranking muestra:muestra; do
  n=${pair%%:*}; pg=${pair##*:}; mkdir -p "$D/$n"
  git ls-files | grep -v -e '^README.md$' -e '^\.nojekyll$' -e '^AGENTS.md$' -e '^desplegar.sh$' -e '^.gitattributes$' | while read -r f; do
    mkdir -p "$D/$n/$(dirname "$f")"; git show "HEAD:$f" > "$D/$n/$f"; done
  git show "HEAD:$pg.html" > "$D/$n/index.html"   # cada sitio abre su página en la raíz
done
echo '{"hosting":[{"site":"trivia-streamingroom-t3","public":"trivia"},{"site":"admin-streamingroom-t3","public":"admin"},{"site":"saluda-streamingroom-t3","public":"saluda"},{"site":"ranking-streamingroom-t3","public":"ranking"},{"site":"muestra-streamingroom-t3","public":"muestra"}]}' > "$D/firebase.json"
echo '{"projects":{"default":"trivia-input"}}' > "$D/.firebaserc"
cd "$D" && firebase deploy --only hosting
