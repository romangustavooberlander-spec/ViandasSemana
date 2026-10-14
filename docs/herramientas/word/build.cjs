const path = require('path');
const { documento, guardar } = require('./lib.cjs');
const OUT = process.argv[2] || path.join(__dirname, '..', '..'); // docs/
const nombres = process.argv.slice(3).length ? process.argv.slice(3) : ['principal', 'tecnica', 'modulo1', 'modulo2', 'modulo3', 'modulo4', 'modulo5'];
(async () => {
  for (const n of nombres) {
    const m = require(`./${n}.cjs`);
    const dir = n.startsWith('modulo') ? path.join(OUT, 'modulos') : OUT;
    await guardar(documento(m.titulo, m.subtitulo, m.contenido, { indice: !!m.indice }), path.join(dir, m.archivo + '.docx'));
  }
})().catch((e) => { console.error(e); process.exit(1); });
