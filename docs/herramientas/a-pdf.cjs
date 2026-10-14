// Convierte la documentación Markdown a PDF: pandoc arma el HTML y Chromium (Playwright) lo imprime.
// Lo llama docs/generar.sh; no hace falta usarlo directo.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const DOCS = path.resolve(__dirname, '..');
const PDF = path.join(DOCS, 'pdf');
const TMP = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'docs-'));

const generales = ['1-vision-general', '2-dfd', '3-casos-de-uso', '4-der', '5-arquitectura-despliegue', '6-decisiones-tecnicas'];
const modulos = ['modulo-1-acceso', 'modulo-2-menus', 'modulo-3-pedidos', 'modulo-4-pagos', 'modulo-5-plataforma'];
const archivo = (n) => path.join(DOCS, n.startsWith('modulo') ? 'modulos' : '', `${n}.md`);

function html(entradas, salida, titulo, extra = []) {
  execFileSync('pandoc', [
    ...entradas, '-f', 'markdown', '-t', 'html5', '--standalone', '--embed-resources',
    '--css', path.join(__dirname, 'estilo.css'), '--lua-filter', path.join(__dirname, 'enlaces.lua'),
    '--resource-path', [DOCS, path.join(DOCS, 'modulos')].join(path.delimiter),
    '--metadata', `pagetitle=${titulo}`, '--metadata', 'lang=es', ...extra, '-o', salida,
  ]);
  return salida;
}

const pie = `<div style="font-size:7pt;width:100%;padding:0 16mm;color:#777;display:flex;justify-content:space-between">
  <span>ViandasSemana — Documentación del TP Integrador</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`;

(async () => {
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage();
  async function imprimir(htmlArchivo, pdf, opciones = {}) {
    await pagina.goto('file://' + htmlArchivo);
    await pagina.pdf({ path: pdf, preferCSSPageSize: true, printBackground: true,
      displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: pie, ...opciones });
    console.log('  ✓', path.relative(DOCS, pdf));
  }

  // Un PDF por documento
  for (const n of [...generales, ...modulos]) {
    await imprimir(html([archivo(n)], path.join(TMP, `${n}.html`), n), path.join(PDF, `${n}.pdf`));
  }

  // Todo junto, con portada
  const portada = path.join(TMP, 'portada.md');
  fs.writeFileSync(portada, `::: portada
# ViandasSemana
Documentación del Trabajo Práctico Integrador

Segundo Enriquez Gatti · Roman Oberlander

6.° 1.ª — E.T. N.° 21 — ${new Date().getFullYear()}
:::
`);
  await imprimir(
    html([portada, ...generales.map(archivo), ...modulos.map(archivo)], path.join(TMP, 'completa.html'), 'Documentación completa', ['--toc', '--toc-depth=2']),
    path.join(PDF, 'documentacion-completa.pdf'),
  );

  // Propuesta (consigna 2)
  await imprimir(
    html([path.join(__dirname, 'propuesta.docx')].map((p) => p), path.join(TMP, 'propuesta.html'), 'Propuesta', ['-f', 'docx']),
    path.join(PDF, 'propuesta.pdf'),
  );

  // Láminas: cada diagrama en su propio PDF A3 (apaisado o vertical según su forma), para imprimirlo grande
  fs.rmSync(path.join(PDF, 'laminas'), { recursive: true, force: true });
  fs.mkdirSync(path.join(PDF, 'laminas'));
  for (const f of fs.readdirSync(path.join(DOCS, 'diagramas')).filter((f) => f.endsWith('.svg')).sort()) {
    const svg = fs.readFileSync(path.join(DOCS, 'diagramas', f), 'utf8');
    const [, w, h] = /viewBox="[\d.-]+ [\d.-]+ ([\d.]+) ([\d.]+)"/.exec(svg) ?? [0, 4, 3];
    const apaisado = Number(w) >= Number(h);
    const [ancho, alto] = apaisado ? [400, 277] : [277, 400]; // A3 menos 10 mm de margen por lado
    await pagina.setContent(`<!doctype html><meta charset="utf-8"><style>
      body { margin: 0; height: ${alto - 2}mm; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: Helvetica, sans-serif; }
      img { max-width: ${ancho}mm; max-height: ${alto - 12}mm; } p { font-size: 9pt; color: #777; margin: 3mm 0 0; }
    </style><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"><p>ViandasSemana — ${f.replace('.svg', '')}</p>`);
    const pdf = path.join(PDF, 'laminas', f.replace('.svg', '.pdf'));
    await pagina.pdf({ path: pdf, format: 'A3', landscape: apaisado, printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } });
    console.log('  ✓', path.relative(DOCS, pdf));
  }

  await navegador.close();
  fs.rmSync(TMP, { recursive: true, force: true });
})();
