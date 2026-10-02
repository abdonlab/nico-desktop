#!/usr/bin/env node
// ============================================================
//  INDEXADOR del conocimiento de NICO
// ============================================================
// Lee todos los documentos de la carpeta  conocimiento/  (PDF, Word,
// Markdown, texto y HTML), los parte en fragmentos, genera embeddings
// con el cerebro de nico.config.js (Gemini u Ollama) y guarda
// conocimiento.json, que NICO usa para responder.
//
//   Uso:   npm run indexar
//
const fs = require('fs');
const path = require('path');
const cfg = require('./nico.config.js');
const { embedText } = require('./rag.js');

const CARPETA = path.join(__dirname, 'conocimiento');
const SALIDA = path.join(__dirname, 'conocimiento.json');

// Tamaño de cada fragmento (en caracteres) y traslape entre ellos.
const CHUNK = cfg.RAG_CHUNK_CHARS || 1200;
const OVERLAP = cfg.RAG_CHUNK_OVERLAP || 200;

// ---------- Lectores por tipo de archivo ----------
async function leerPDF(file) {
  const pdfParse = require('pdf-parse');
  const data = await pdfParse(fs.readFileSync(file));
  return data.text || '';
}
async function leerDOCX(file) {
  const mammoth = require('mammoth');
  const res = await mammoth.extractRawText({ path: file });
  return res.value || '';
}
function leerHTML(file) {
  const html = fs.readFileSync(file, 'utf8');
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')          // quita etiquetas
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
}
function leerTexto(file) {
  return fs.readFileSync(file, 'utf8');
}

async function leerDocumento(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.pdf') return leerPDF(file);
  if (ext === '.docx') return leerDOCX(file);
  if (ext === '.html' || ext === '.htm') return leerHTML(file);
  if (ext === '.md' || ext === '.txt' || ext === '.markdown') return leerTexto(file);
  return null; // tipo no soportado
}

// ---------- Fragmentación ----------
function fragmentar(texto) {
  const limpio = String(texto || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
  if (!limpio) return [];
  const partes = [];
  let i = 0;
  while (i < limpio.length) {
    let fin = Math.min(i + CHUNK, limpio.length);
    // intenta cortar en un punto o salto de línea cercano para no partir frases
    if (fin < limpio.length) {
      const ventana = limpio.slice(fin - 120, fin);
      const corte = Math.max(ventana.lastIndexOf('. '), ventana.lastIndexOf('\n'));
      if (corte > 0) fin = fin - 120 + corte + 1;
    }
    const frag = limpio.slice(i, fin).trim();
    if (frag.length > 30) partes.push(frag);
    i = fin - OVERLAP;
    if (i < 0) i = 0;
    if (fin >= limpio.length) break;
  }
  return partes;
}

// ---------- Programa principal ----------
(async () => {
  console.log('NICO · Indexador de conocimiento');
  console.log('Cerebro para embeddings:', (cfg.PROVIDER || 'gemini'));

  if (!fs.existsSync(CARPETA)) {
    fs.mkdirSync(CARPETA, { recursive: true });
    console.log(`\nCreé la carpeta "conocimiento/". Mete ahí tus PDF, Word, .md, .txt o .html y vuelve a correr:  npm run indexar`);
    return;
  }

  const archivos = fs.readdirSync(CARPETA)
    .filter(f => !f.startsWith('.'))
    .map(f => path.join(CARPETA, f))
    .filter(f => fs.statSync(f).isFile());

  if (!archivos.length) {
    console.log('\nLa carpeta "conocimiento/" está vacía. Mete documentos y vuelve a correr:  npm run indexar');
    return;
  }

  // 1) Leer y fragmentar todo
  const pendientes = []; // { text, source }
  for (const file of archivos) {
    const nombre = path.basename(file);
    let texto;
    try { texto = await leerDocumento(file); }
    catch (e) { console.warn(`  ⚠ No pude leer ${nombre}: ${e.message}`); continue; }
    if (texto === null) { console.log(`  · (omitido, tipo no soportado) ${nombre}`); continue; }
    const frags = fragmentar(texto);
    frags.forEach(t => pendientes.push({ text: t, source: nombre }));
    console.log(`  ✓ ${nombre} → ${frags.length} fragmentos`);
  }

  if (!pendientes.length) { console.log('\nNo se extrajo texto de ningún documento.'); return; }

  // 2) Generar embeddings
  console.log(`\nGenerando embeddings de ${pendientes.length} fragmentos…`);
  const chunks = [];
  for (let i = 0; i < pendientes.length; i++) {
    const p = pendientes[i];
    try {
      const vector = await embedText(p.text, cfg);
      if (vector && vector.length) chunks.push({ text: p.text, source: p.source, vector });
      process.stdout.write(`\r  ${i + 1}/${pendientes.length}`);
    } catch (e) {
      console.error(`\n  ⚠ Error en fragmento ${i + 1} (${p.source}): ${e.message}`);
      // Si falla el primero suele ser config/modelo: abortar con ayuda clara.
      if (chunks.length === 0) {
        console.error('\nNo pude generar embeddings. Revisa tu nico.config.js (API key de Gemini, o que Ollama esté corriendo con el modelo de embeddings descargado).');
        return;
      }
    }
  }

  // 3) Guardar
  const salida = {
    creado: new Date().toISOString(),
    proveedor: (cfg.PROVIDER || 'gemini'),
    modelo: (cfg.PROVIDER === 'ollama' ? (cfg.EMBED_MODEL_OLLAMA || 'nomic-embed-text') : (cfg.EMBED_MODEL_GEMINI || 'text-embedding-004')),
    chunks
  };
  fs.writeFileSync(SALIDA, JSON.stringify(salida));
  console.log(`\n\n✅ Listo: ${chunks.length} fragmentos guardados en conocimiento.json`);
  console.log('Ahora abre NICO (npm start) y pregúntale sobre tus documentos.');
})().catch(e => { console.error('\nError inesperado:', e); process.exit(1); });
