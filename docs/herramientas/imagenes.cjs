// Convierte cada SVG en un PNG (para los Word) y en una lámina PDF A3 (un documento por diagrama).
// Uso: node imagenes.cjs <carpeta svg> <carpeta png> <carpeta láminas>
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const [svgs, pngs, laminas] = process.argv.slice(2);
  fs.mkdirSync(pngs, { recursive: true });
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage({ deviceScaleFactor: 2 });
  const tamanos = {};
  for (const f of fs.readdirSync(svgs).filter((f) => f.endsWith('.svg')).sort()) {
    const nombre = f.replace('.svg', '');
    const svg = fs.readFileSync(path.join(svgs, f), 'utf8').replace(/<\?xml[^>]*>/, '');
    // PNG en alta resolución
    await pagina.setContent(`<html><body style="margin:0;background:#fff">${svg}</body></html>`);
    const el = await pagina.$('svg');
    const caja = await el.boundingBox();
    await el.screenshot({ path: path.join(pngs, nombre + '.png') });
    tamanos[nombre] = [Math.round(caja.width), Math.round(caja.height)];
    // Lámina A3, apaisada o vertical según la forma del diagrama
    const apaisado = caja.width >= caja.height;
    const [ancho, alto] = apaisado ? [400, 277] : [277, 400]; // A3 menos 10 mm de margen por lado
    await pagina.setContent(`<!doctype html><meta charset="utf-8"><style>
      body { margin: 0; height: ${alto - 2}mm; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: Helvetica, sans-serif; }
      img { max-width: ${ancho}mm; max-height: ${alto - 12}mm; } p { font-size: 9pt; color: #777; margin: 3mm 0 0; }
    </style><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"><p>ViandasSemana — ${nombre}</p>`);
    await pagina.pdf({ path: path.join(laminas, nombre + '.pdf'), format: 'A3', landscape: apaisado, printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } });
    console.log('  ✓', nombre);
  }
  fs.writeFileSync(path.join(pngs, 'tamanos.json'), JSON.stringify(tamanos, null, 1));
  await navegador.close();
})();
