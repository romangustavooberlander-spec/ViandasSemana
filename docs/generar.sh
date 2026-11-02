#!/usr/bin/env bash
# Regenera todo lo de docs/: diagramas (.drawio y lámina PDF), documentos Word y sus PDF.
# Requisitos: Java, Graphviz (dot), Python 3, LibreOffice y Node con las librerías docx y playwright
#   (npm i -g docx playwright && npx playwright install chromium).
# Uso: bash docs/generar.sh
set -euo pipefail
cd "$(dirname "$0")/herramientas"
export NODE_PATH="$(npm root -g)"

JAR=plantuml.jar   # no se sube al repo (.gitignore)
if [ ! -f "$JAR" ]; then
  echo "Descargando PlantUML…"
  curl -sSfL -o "$JAR" https://repo1.maven.org/maven2/net/sourceforge/plantuml/plantuml/1.2025.2/plantuml-1.2025.2.jar
fi

rm -rf .generado && mkdir -p .generado/svg
echo "Imágenes de los diagramas:"
for f in fuentes/*.dot; do dot -Tsvg "$f" -o ".generado/svg/$(basename "${f%.dot}").svg"; done
java -jar "$JAR" -tsvg -charset UTF-8 -o ../.generado/svg fuentes/*.puml
node imagenes.cjs .generado/svg .generado/png ../diagramas

echo "Diagramas editables (.drawio):"
python3 drawio.py ../diagramas fuentes

echo "Documentos Word:"
node word/build.cjs ..

echo "PDF de los documentos:"
(cd .. && python3 herramientas/word/a-pdf.py ./*.docx modulos/*.docx)
