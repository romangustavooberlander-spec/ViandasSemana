#!/usr/bin/env bash
# Regenera los diagramas (SVG) y los PDF de la documentación.
# Requisitos: Java, Graphviz (dot), pandoc y Node con Playwright (npm i -g playwright && npx playwright install chromium).
# Uso: bash docs/generar.sh
set -euo pipefail
cd "$(dirname "$0")"

JAR=herramientas/plantuml.jar   # no se sube al repo (.gitignore)
if [ ! -f "$JAR" ]; then
  echo "Descargando PlantUML…"
  curl -sSfL -o "$JAR" https://repo1.maven.org/maven2/net/sourceforge/plantuml/plantuml/1.2025.2/plantuml-1.2025.2.jar
fi

echo "Diagramas:"
for f in diagramas/fuentes/*.dot; do
  dot -Tsvg "$f" -o "diagramas/$(basename "${f%.dot}").svg" && echo "  ✓ diagramas/$(basename "${f%.dot}").svg"
done
java -jar "$JAR" -tsvg -charset UTF-8 -o .. diagramas/fuentes/*.puml && echo "  ✓ diagramas UML (PlantUML)"

echo "PDF:"
mkdir -p pdf
NODE_PATH="$(npm root -g)" node herramientas/a-pdf.cjs
