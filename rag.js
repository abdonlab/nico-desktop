// ============================================================
//  RAG de NICO — búsqueda de conocimiento en tus documentos
// ============================================================
// Genera embeddings con el mismo cerebro que uses (Gemini u Ollama),
// guarda los vectores en conocimiento.json (lo crea el indexador) y,
// al preguntar, recupera los fragmentos más parecidos para dárselos
// como contexto al modelo. Sin base de datos: todo en memoria.

const fs = require('fs');
const path = require('path');

// ---------- Embeddings ----------
// Convierte un texto en un vector numérico usando el proveedor de cfg.
async function embedText(text, cfg) {
  const provider = (cfg.PROVIDER || 'gemini').toLowerCase();
  if (provider === 'ollama') return embedOllama(text, cfg);
  return embedGemini(text, cfg);
}

// Detecta automáticamente un modelo de embeddings válido para esta API key
// (arregla el 404 cuando text-embedding-004 no está disponible).
let RESOLVED_EMBED_GEMINI = null;
async function resolveEmbedModelGemini(key, cfg) {
  if (RESOLVED_EMBED_GEMINI) return RESOLVED_EMBED_GEMINI;
  const prefer = [cfg.EMBED_MODEL_GEMINI, 'text-embedding-004', 'gemini-embedding-001', 'embedding-001']
    .filter(Boolean);
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    if (r.ok) {
      const data = await r.json();
      const usable = (data.models || [])
        .filter(m => (m.supportedGenerationMethods || []).includes('embedContent'))
        .map(m => m.name.replace(/^models\//, ''));
      for (const p of prefer) if (usable.includes(p)) { RESOLVED_EMBED_GEMINI = p; break; }
      if (!RESOLVED_EMBED_GEMINI) RESOLVED_EMBED_GEMINI = usable.find(n => n.includes('embedding')) || usable[0];
      if (RESOLVED_EMBED_GEMINI) { console.log('Embeddings Gemini:', RESOLVED_EMBED_GEMINI); return RESOLVED_EMBED_GEMINI; }
    } else {
      console.error('ListModels (embed)', r.status, await r.text());
    }
  } catch (e) { console.error('ListModels (embed) error', e.message); }
  RESOLVED_EMBED_GEMINI = cfg.EMBED_MODEL_GEMINI || 'text-embedding-004';
  return RESOLVED_EMBED_GEMINI;
}

async function embedGemini(text, cfg) {
  const key = (cfg.GEMINI_API_KEY || '').trim();
  if (!key || key.includes('PEGA_AQUI')) throw new Error('Falta la API key de Gemini para los embeddings.');
  const model = await resolveEmbedModelGemini(key, cfg);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${key}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: `models/${model}`, content: { parts: [{ text: String(text || '') }] } })
  });
  if (!r.ok) throw new Error(`Gemini embeddings error ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return data?.embedding?.values || [];
}

async function embedOllama(text, cfg) {
  const base = (cfg.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '');
  const model = cfg.EMBED_MODEL_OLLAMA || 'nomic-embed-text';
  const r = await fetch(`${base}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: String(text || '') })
  });
  if (!r.ok) {
    const t = await r.text();
    if (r.status === 404) throw new Error(`No tengo el modelo de embeddings "${model}". Corre:  ollama pull ${model}`);
    throw new Error(`Ollama embeddings error ${r.status}: ${t}`);
  }
  const data = await r.json();
  return data?.embedding || [];
}

// ---------- Similitud ----------
function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ---------- Carga del conocimiento ----------
let KNOWLEDGE = [];   // [{ text, source, vector }]
let LOADED = false;

// Busca conocimiento.json junto al .exe (resources) o junto a rag.js (dev).
function findKnowledgeFile() {
  const candidates = [
    process.resourcesPath ? path.join(process.resourcesPath, 'conocimiento.json') : null,
    path.join(__dirname, 'conocimiento.json')
  ].filter(Boolean);
  for (const c of candidates) { try { if (fs.existsSync(c)) return c; } catch (e) {} }
  return null;
}

function loadKnowledge() {
  LOADED = true;
  const file = findKnowledgeFile();
  if (!file) { console.log('RAG: no hay conocimiento.json (ejecuta  npm run indexar).'); KNOWLEDGE = []; return KNOWLEDGE; }
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    KNOWLEDGE = Array.isArray(raw?.chunks) ? raw.chunks : (Array.isArray(raw) ? raw : []);
    console.log(`RAG: ${KNOWLEDGE.length} fragmentos cargados de`, file);
  } catch (e) {
    console.error('RAG: no pude leer conocimiento.json:', e.message);
    KNOWLEDGE = [];
  }
  return KNOWLEDGE;
}

function isReady() { return LOADED && KNOWLEDGE.length > 0; }

// ---------- Recuperación ----------
// Devuelve { context, sources } con los top-K fragmentos más parecidos.
async function retrieve(query, cfg) {
  if (!LOADED) loadKnowledge();
  if (!isReady()) return { context: '', sources: [] };

  const topK = Math.max(1, cfg.RAG_TOP_K || 4);
  const minScore = typeof cfg.RAG_MIN_SCORE === 'number' ? cfg.RAG_MIN_SCORE : 0.2;

  let qvec;
  try { qvec = await embedText(query, cfg); }
  catch (e) { console.error('RAG: error al embeber la pregunta:', e.message); return { context: '', sources: [] }; }
  if (!qvec.length) return { context: '', sources: [] };

  const scored = KNOWLEDGE
    .map(ch => ({ ch, score: cosineSim(qvec, ch.vector || []) }))
    .filter(s => s.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  if (!scored.length) return { context: '', sources: [] };

  const context = scored
    .map((s, i) => `[Fragmento ${i + 1} — fuente: ${s.ch.source || 'desconocida'}]\n${s.ch.text}`)
    .join('\n\n');
  const sources = [...new Set(scored.map(s => s.ch.source).filter(Boolean))];
  return { context, sources };
}

module.exports = { embedText, cosineSim, loadKnowledge, isReady, retrieve };
