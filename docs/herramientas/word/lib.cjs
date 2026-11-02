// Ayudas para armar los documentos Word de ViandasSemana con la librería docx.
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ShadingType,
  ImageRun, AlignmentType, PageBreak, LevelFormat, Footer, PageNumber, BorderStyle, TableOfContents,
  VerticalAlign, ExternalHyperlink,
} = require('docx');

const PNG = path.join(__dirname, '..', '.generado', 'png'); // la arma generar.sh
const TAM = JSON.parse(fs.readFileSync(path.join(PNG, 'tamanos.json'), 'utf8'));
const ANCHO = 9638; // A4 con márgenes de 2 cm (DXA)
const ROJO = '7A1F12', OCRE = 'EFE8D6', GRIS = 'F4F4F4';

// Texto con **negrita** y `código`
function runs(texto, base = {}) {
  const out = [];
  for (const parte of String(texto).split(/(\*\*[^*]+\*\*|`[^`]+`)/)) {
    if (!parte) continue;
    if (parte.startsWith('**')) out.push(new TextRun({ ...base, text: parte.slice(2, -2), bold: true }));
    else if (parte.startsWith('`')) out.push(new TextRun({ ...base, text: parte.slice(1, -1), font: 'Consolas', size: 19 }));
    else out.push(new TextRun({ ...base, text: parte }));
  }
  return out;
}

const h1 = (t, nueva = false) => new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: nueva, children: [new TextRun(t)] });
const h2 = (t, nueva = false) => new Paragraph({ heading: HeadingLevel.HEADING_2, pageBreakBefore: nueva, children: [new TextRun(t)] });
const h3 = (t, nueva = false) => new Paragraph({ heading: HeadingLevel.HEADING_3, pageBreakBefore: nueva, children: [new TextRun(t)] });
const p = (t, opts = {}) => new Paragraph({ spacing: { after: 120 }, ...opts, children: runs(t) });
const nota = (t) => new Paragraph({ spacing: { after: 120 }, children: runs(t, { italics: true, color: '555555' }) });
const vinetas = (items, nivel = 0) => items.flatMap((it) =>
  Array.isArray(it) ? vinetas(it, nivel + 1) : [new Paragraph({ numbering: { reference: 'vinetas', level: nivel }, spacing: { after: 60 }, children: runs(it) })]);
const numerada = (items, ref = 'numeros') => items.map((it) =>
  new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { after: 60 }, children: runs(it) }));
const salto = () => new Paragraph({ children: [new PageBreak()] });
const codigo = (lineas) => lineas.map((l) => new Paragraph({ spacing: { after: 0 }, shading: { type: ShadingType.CLEAR, fill: GRIS },
  children: [new TextRun({ text: l || ' ', font: 'Consolas', size: 18 })] }));

function imagen(nombre, anchoMax = 16, altoMax = 21) {
  const [w, h] = TAM[nombre];
  const cm = 37.8; // px por cm a 96 ppp
  let ancho = Math.min(anchoMax * cm, w), alto = (ancho * h) / w;
  if (alto > altoMax * cm) { alto = altoMax * cm; ancho = (alto * w) / h; }
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 120 },
    children: [new ImageRun({ type: 'png', data: fs.readFileSync(path.join(PNG, nombre + '.png')),
      transformation: { width: Math.round(ancho), height: Math.round(alto) } })] });
}
const epigrafe = (t) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: runs(t, { italics: true, size: 18, color: '666666' }) });

const borde = { style: BorderStyle.SINGLE, size: 4, color: 'B5AD98' };
const bordes = { top: borde, bottom: borde, left: borde, right: borde };
function celda(contenido, ancho, { fondo, span, filas, negrita, centrado } = {}) {
  const parrafos = (Array.isArray(contenido) ? contenido : [contenido]).map((t) =>
    t instanceof Paragraph ? t : new Paragraph({ alignment: centrado ? AlignmentType.CENTER : AlignmentType.LEFT, children: runs(t, negrita ? { bold: true } : {}) }));
  return new TableCell({ children: parrafos, width: { size: ancho, type: WidthType.DXA }, columnSpan: span, rowSpan: filas,
    verticalAlign: VerticalAlign.CENTER, borders: bordes, margins: { top: 60, bottom: 60, left: 100, right: 100 },
    shading: fondo ? { type: ShadingType.CLEAR, fill: fondo, color: 'auto' } : undefined });
}

// Tabla simple: encabezados + filas. anchos en proporciones.
function tabla(encabezados, filas, proporciones) {
  const total = proporciones.reduce((a, b) => a + b, 0);
  const anchos = proporciones.map((x) => Math.round((x / total) * ANCHO));
  anchos[anchos.length - 1] += ANCHO - anchos.reduce((a, b) => a + b, 0);
  return new Table({ width: { size: ANCHO, type: WidthType.DXA }, columnWidths: anchos, rows: [
    new TableRow({ tableHeader: true, children: encabezados.map((e, i) => celda(e, anchos[i], { fondo: OCRE, negrita: true })) }),
    ...filas.map((f) => new TableRow({ children: f.map((c, i) => celda(c, anchos[i])) })),
  ] });
}

// Plantilla de caso de uso (formato pedido por el grupo)
function casoDeUso(cu) {
  const A = [1900, 600, 3569, 3569]; // etiqueta, #, acción, reacción
  const resto = A[1] + A[2] + A[3];
  const fila = (etq, valor) => new TableRow({ cantSplit: true, children: [celda(etq, A[0], { fondo: OCRE, negrita: true }), celda(valor, resto, { span: 3 })] });
  const filas = [
    new TableRow({ children: [celda(cu.id, A[0], { fondo: ROJO_CLARO, negrita: true }), celda(cu.nombre, resto, { span: 3, fondo: ROJO_CLARO, negrita: true })] }),
    fila('Descripción', cu.descripcion),
    fila('Actores', cu.actores),
    fila('Precondiciones', cu.pre),
    fila('Postcondiciones', cu.post),
  ];
  // Secuencia normal
  const sec = [];
  sec.push([celda('#', A[1], { fondo: GRIS, negrita: true, centrado: true }), celda('Acción (actor)', A[2], { fondo: GRIS, negrita: true }), celda('Reacción (sistema)', A[3], { fondo: GRIS, negrita: true })]);
  cu.pasos.forEach(([n, actor, sistema]) => {
    if (n === null) sec.push([celda('', A[1]), celda(actor, A[2] + A[3], { span: 2 })]); // alternativa
    else sec.push([celda(String(n), A[1], { centrado: true }), celda(actor || '', A[2]), celda(sistema || '', A[3])]);
  });
  sec.forEach((celdas, i) => filas.push(new TableRow({ cantSplit: true, children: i === 0
    ? [celda('Secuencia normal', A[0], { fondo: OCRE, negrita: true, filas: sec.length }), ...celdas] : celdas })));
  // Excepciones
  const exc = [[celda('#', A[1], { fondo: GRIS, negrita: true, centrado: true }), celda('Acción (actor)', A[2], { fondo: GRIS, negrita: true }), celda('Reacción (sistema)', A[3], { fondo: GRIS, negrita: true })]];
  (cu.excepciones.length ? cu.excepciones : [['—', '', 'No tiene excepciones propias además de las alternativas.']]).forEach(([n, actor, sistema]) =>
    exc.push([celda(String(n), A[1], { centrado: true }), celda(actor || '', A[2]), celda(sistema, A[3])]));
  exc.forEach((celdas, i) => filas.push(new TableRow({ cantSplit: true, children: i === 0
    ? [celda('Excepciones', A[0], { fondo: OCRE, negrita: true, filas: exc.length }), ...celdas] : celdas })));
  filas.push(fila('Rendimiento', cu.rendimiento));
  filas.push(fila('Frecuencia', cu.frecuencia));
  filas.push(fila('Importancia', cu.importancia));
  filas.push(fila('Urgencia', cu.urgencia));
  filas.push(fila('Comentarios', cu.comentarios));
  return [new Table({ width: { size: ANCHO, type: WidthType.DXA }, columnWidths: A, rows: filas })];
}
const ROJO_CLARO = 'F6DAD3';

function documento(titulo, subtitulo, contenido, { indice = false } = {}) {
  const portada = [
    new Paragraph({ spacing: { before: 3000 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'ViandasSemana', size: 64, bold: true, color: ROJO })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 }, children: [new TextRun({ text: titulo, size: 40, bold: true })] }),
    ...(subtitulo ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 }, children: [new TextRun({ text: subtitulo, size: 26, color: '555555' })] })] : []),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1600 }, children: [new TextRun({ text: 'Segundo Enriquez Gatti · Roman Oberlander', size: 24 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '6.° 1.ª — E.T. N.° 21 — Programación sobre Redes — 2026', size: 22, color: '555555' })] }),
    salto(),
    ...(indice ? [new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: 'Índice', size: 34, bold: true, color: ROJO })] }), new TableOfContents('Índice', { hyperlink: true, headingStyleRange: '1-2' }), salto()] : []),
  ];
  return new Document({
    creator: 'ViandasSemana', title: `ViandasSemana — ${titulo}`, features: { updateFields: indice },
    styles: {
      default: { document: { run: { font: 'Calibri', size: 22 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 34, bold: true, color: ROJO }, paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 28, bold: true, color: ROJO }, paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1 } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 24, bold: true, color: '333333' }, paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 } },
      ],
    },
    numbering: { config: [
      { reference: 'vinetas', levels: [0, 1].map((l) => ({ level: l, format: LevelFormat.BULLET, text: l ? '◦' : '•', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720 * (l + 1), hanging: 360 } } } })) },
      ...['numeros', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8'].map((ref) => ({ reference: ref, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] })),
    ] },
    sections: [{
      properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [
        new TextRun({ text: `ViandasSemana — ${titulo}    `, size: 16, color: '888888' }),
        new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '888888' })] })] }) },
      children: [...portada, ...contenido],
    }],
  });
}

async function guardar(doc, archivo) {
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  fs.writeFileSync(archivo, await Packer.toBuffer(doc));
  console.log('  ✓', archivo);
}

// Todos los casos de uso de un módulo, cada uno desde una página nueva
const casosDeUso = (lista) => lista.flatMap((c, i) => [h2(`${c.id} ${c.nombre}`, i > 0), ...casoDeUso(c)]);

module.exports = { casosDeUso, h1, h2, h3, p, nota, vinetas, numerada, salto, codigo, imagen, epigrafe, tabla, casoDeUso, documento, guardar, runs };
