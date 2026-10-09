const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const rag = require('./rag.js');

// Carga nico.config.js. En modo desarrollo está junto a main.js;
// en el .exe empaquetado está en la carpeta "resources" junto al ejecutable
// (así puedes editar tu API key sin recompilar).
let cfg = {};
(() => {
  const candidates = [
    process.resourcesPath ? path.join(process.resourcesPath, 'nico.config.js') : null,
    path.join(__dirname, 'nico.config.js')
  ].filter(Boolean);
  for (const c of candidates) {
    try { if (fs.existsSync(c)) { cfg = require(c); console.log('Config:', c); return; } }
    catch (e) { console.error('Error leyendo', c, e.message); }
  }
  console.error('No se encontró nico.config.js');
})();

// ---- Ajustes editables desde el engranaje ⚙️ de la app ----
// Se guardan en la carpeta de datos del usuario (userData) y SOBREVIVEN a las
// actualizaciones. Lo que el usuario elige aquí tiene prioridad sobre nico.config.js.
function settingsPath() { return path.join(app.getPath('userData'), 'nico-settings.json'); }
function loadUserSettings() {
  try { const p = settingsPath(); if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8')) || {}; }
  catch (e) { console.error('No pude leer ajustes:', e.message); }
  return {};
}
function applyUserSettings() {
  const s = loadUserSettings();
  if (s && typeof s === 'object') Object.assign(cfg, s);
  return s;
}

let avatarWin = null;
let tray = null;

// ---- Ventana del AVATAR (lobo neón flotante, con chat integrado) ----
const WIN_W = 320;
const WIN_H = 580;

// Muestra u oculta el avatar; al ocultarlo queda accesible desde la bandeja.
function showAvatar() {
  if (!avatarWin) { createAvatarWindow(); return; }
  if (avatarWin.isMinimized()) avatarWin.restore();   // si venía del Dock (Mac)
  avatarWin.show();
  avatarWin.setAlwaysOnTop(true, 'screen-saver');
}
function hideAvatar() {
  if (avatarWin) avatarWin.hide();
}

// ---- Icono en la bandeja del sistema (junto al reloj) ----
// Sirve para recuperar a NICO cuando lo minimizas (se esconde aquí).
function createTray() {
  if (tray) return;
  let icon = nativeImage.createFromPath(path.join(__dirname, 'src', 'nico.png'));
  if (!icon.isEmpty()) icon = icon.resize({ width: 16, height: 16 });
  try {
    tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  } catch (e) { console.error('No se pudo crear la bandeja:', e.message); return; }

  tray.setToolTip('NICO — clic para mostrar/ocultar');
  const menu = Menu.buildFromTemplate([
    { label: 'Mostrar NICO', click: () => showAvatar() },
    { label: 'Ocultar NICO', click: () => hideAvatar() },
    { type: 'separator' },
    { label: 'Salir', click: () => app.quit() }
  ]);
  tray.setContextMenu(menu);
  // Clic izquierdo: alterna mostrar/ocultar.
  tray.on('click', () => {
    if (!avatarWin) { showAvatar(); return; }
    if (avatarWin.isMinimized() || !avatarWin.isVisible()) showAvatar();
    else hideAvatar();
  });
}

function createAvatarWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  avatarWin = new BrowserWindow({
    width: WIN_W, height: WIN_H,
    x: width - WIN_W - 24,
    y: height - WIN_H - 24,
    frame: false, transparent: true, resizable: false,
    alwaysOnTop: true, skipTaskbar: true, hasShadow: false, focusable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false
    }
  });

  avatarWin.setAlwaysOnTop(true, 'screen-saver');
  avatarWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  avatarWin.loadFile(path.join(__dirname, 'src', 'index.html'));
  avatarWin.on('closed', () => { avatarWin = null; });
}

// ================= ARRANQUE AUTOMÁTICO DE OLLAMA =================
// Si el cerebro es Ollama y no está corriendo, NICO lo levanta solo
// (ollama serve) al iniciar y espera a que responda. Configurable en
// nico.config.js con AUTO_START_OLLAMA (true/false) y OLLAMA_BIN (ruta).

let ollamaProc = null; // proceso que NICO lanzó (para cerrarlo al salir)

// Busca el ejecutable de Ollama según el sistema operativo.
function findOllamaBin() {
  if (cfg.OLLAMA_BIN && fs.existsSync(cfg.OLLAMA_BIN)) return cfg.OLLAMA_BIN;
  const home = app.getPath('home');
  const candidates = process.platform === 'win32'
    ? [
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe'),
        path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Ollama', 'ollama.exe'),
        'ollama.exe'
      ]
    : process.platform === 'darwin'
    ? [
        '/usr/local/bin/ollama',
        '/opt/homebrew/bin/ollama',
        '/Applications/Ollama.app/Contents/Resources/ollama',
        path.join(home, '.ollama', 'bin', 'ollama'),
        'ollama'
      ]
    : [
        '/usr/local/bin/ollama',
        '/usr/bin/ollama',
        path.join(home, '.local', 'bin', 'ollama'),
        'ollama'
      ];
  for (const c of candidates) {
    try { if (c === 'ollama' || c === 'ollama.exe' || fs.existsSync(c)) return c; }
    catch (e) { /* sigue buscando */ }
  }
  return 'ollama'; // último recurso: confiar en el PATH
}

// ¿Ollama ya responde?
async function ollamaAlive() {
  const base = (cfg.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '');
  try {
    const r = await fetch(`${base}/api/tags`, { method: 'GET' });
    return r.ok;
  } catch (e) { return false; }
}

// Levanta Ollama si hace falta y espera hasta ~20 s a que responda.
async function ensureOllama() {
  const provider = (cfg.PROVIDER || 'gemini').toLowerCase();
  if (provider !== 'ollama') return;                 // solo aplica al cerebro local
  if (cfg.AUTO_START_OLLAMA === false) return;       // el usuario lo desactivó
  if (await ollamaAlive()) { console.log('Ollama ya estaba corriendo.'); return; }

  const bin = findOllamaBin();
  console.log('Levantando Ollama con:', bin);
  try {
    ollamaProc = spawn(bin, ['serve'], {
      detached: false,
      stdio: 'ignore',
      windowsHide: true
    });
    ollamaProc.on('error', (err) => {
      console.error('No se pudo iniciar Ollama:', err.message);
      ollamaProc = null;
    });
  } catch (e) {
    console.error('Error al lanzar Ollama:', e.message);
    return;
  }

  // Espera a que el servidor esté listo (hasta 20 intentos de 1 s).
  for (let i = 0; i < 20; i++) {
    await new Promise(res => setTimeout(res, 1000));
    if (await ollamaAlive()) { console.log('Ollama listo.'); return; }
  }
  console.error('Ollama no respondió tras 20 s.');
}

// ================= CEREBRO: Gemini =================

// Detecta automáticamente un modelo válido para esta API key (arregla el 404).
let RESOLVED_MODEL = null;
async function resolveModel(key) {
  if (RESOLVED_MODEL) return RESOLVED_MODEL;
  const prefer = [cfg.MODEL, 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']
    .filter(Boolean);
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    if (r.ok) {
      const data = await r.json();
      const usable = (data.models || [])
        .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map(m => m.name.replace(/^models\//, ''));
      for (const p of prefer) if (usable.includes(p)) { RESOLVED_MODEL = p; break; }
      if (!RESOLVED_MODEL) RESOLVED_MODEL = usable.find(n => n.includes('flash')) || usable[0];
      if (RESOLVED_MODEL) { console.log('NICO usa el modelo:', RESOLVED_MODEL); return RESOLVED_MODEL; }
    } else {
      console.error('ListModels', r.status, await r.text());
    }
  } catch (e) { console.error('ListModels error', e.message); }
  RESOLVED_MODEL = cfg.MODEL || 'gemini-1.5-flash';
  return RESOLVED_MODEL;
}

// Arma el system prompt, añadiendo el contexto recuperado del RAG si lo hay.
async function construirSystemPrompt(messages) {
  const base = cfg.SYSTEM_PROMPT || 'Eres NICO.';
  if (cfg.RAG_ENABLED === false) return base;
  // Toma la última pregunta del usuario para buscar en el conocimiento.
  const ultima = [...(messages || [])].reverse().find(m => m.role === 'user');
  if (!ultima || !ultima.text) return base;
  try {
    const { context, sources } = await rag.retrieve(String(ultima.text), cfg);
    if (!context) return base;
    console.log('RAG: contexto de', sources.join(', '));
    return `${base}

=== CONOCIMIENTO INSTITUCIONAL (úsalo para responder; si la respuesta está aquí, básate en esto y no inventes) ===
${context}
=== FIN DEL CONOCIMIENTO ===`;
  } catch (e) {
    console.error('RAG: no se pudo recuperar contexto:', e.message);
    return base;
  }
}

// Selecciona el proveedor según nico.config.js: 'gemini' (nube) u 'ollama' (local).
ipcMain.handle('nico:ask', async (_e, messages) => {
  const provider = (cfg.PROVIDER || 'gemini').toLowerCase();
  const systemPrompt = await construirSystemPrompt(messages);
  if (provider === 'ollama') return askOllama(messages, systemPrompt);
  return askGemini(messages, systemPrompt);
});

// ---- Ollama (IA local, sin internet) ----
async function askOllama(messages, systemPrompt) {
  const base = (cfg.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '');
  const model = cfg.OLLAMA_MODEL || 'llama3.2';
  const msgs = [{ role: 'system', content: systemPrompt || cfg.SYSTEM_PROMPT || 'Eres NICO.' }]
    .concat((messages || []).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: String(m.text || '')
    })));
  try {
    const r = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: msgs, stream: false })
    });
    if (!r.ok) {
      const t = await r.text();
      console.error('Ollama error', r.status, t);
      if (r.status === 404) return { ok: false, reply: `No tengo el modelo "${model}". En una terminal corre:  ollama pull ${model}` };
      return { ok: false, reply: `Error de Ollama (${r.status}).` };
    }
    const data = await r.json();
    return { ok: true, reply: data?.message?.content || '(sin respuesta)' };
  } catch (err) {
    console.error(err);
    return { ok: false, reply: 'No pude conectar con Ollama. ¿Está encendido? Abre una terminal y corre:  ollama serve' };
  }
}

// ---- Gemini (nube) ----
async function askGemini(messages, systemPrompt) {
  const key = (cfg.GEMINI_API_KEY || '').trim();
  if (!key || key.includes('PEGA_AQUI')) {
    return { ok: false, reply: 'Falta tu API key de Gemini. Ábre el engranaje ⚙️ y pégala.' };
  }

  const model = await resolveModel(key);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const contents = (messages || []).map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: String(m.text || '') }]
  }));
  const body = {
    contents,
    systemInstruction: { parts: [{ text: systemPrompt || cfg.SYSTEM_PROMPT || 'Eres NICO.' }] },
    generationConfig: { maxOutputTokens: 800, temperature: 0.9, topP: 0.9 }
  };

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!r.ok) {
      const t = await r.text();
      console.error('Gemini error', r.status, t);
      if (r.status === 404) { RESOLVED_MODEL = null; return { ok: false, reply: 'No encontré un modelo válido para tu key. Reinicia NICO e intenta de nuevo.' }; }
      if (r.status === 400 || r.status === 403) return { ok: false, reply: 'Tu API key parece inválida. Revísala en el engranaje ⚙️.' };
      if (r.status === 429) return { ok: false, reply: 'Límite de uso alcanzado; espera un momento.' };
      return { ok: false, reply: `Error de la API (${r.status}).` };
    }
    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '(me quedé pensando…)';
    return { ok: true, reply: text };
  } catch (err) {
    console.error(err);
    return { ok: false, reply: 'No pude conectar con Gemini. ¿Hay internet?' };
  }
}

// ---- Controles del avatar ----
ipcMain.on('nico:quit', () => app.quit());
// Minimizar: en Mac usa el efecto NATIVO (se encoge hacia el Dock); en Windows
// se esconde a la bandeja (junto al reloj). En ambos vuelve con clic en el icono.
ipcMain.on('nico:minimize', () => {
  if (process.platform === 'darwin' && avatarWin) avatarWin.minimize();
  else hideAvatar();
});
ipcMain.on('nico:toggle-pin', (_e, pinned) => { if (avatarWin) avatarWin.setAlwaysOnTop(!!pinned, 'screen-saver'); });
ipcMain.on('nico:click-through', (_e, ignore) => { if (avatarWin) avatarWin.setIgnoreMouseEvents(!!ignore, { forward: true }); });

// ---- Configuración desde el engranaje ⚙️ ----
ipcMain.handle('nico:get-settings', () => {
  const key = String(cfg.GEMINI_API_KEY || '');
  return {
    provider: (cfg.PROVIDER || 'gemini').toLowerCase(),
    geminiKey: key.includes('PEGA_AQUI') ? '' : key,
    geminiModel: cfg.MODEL || 'gemini-2.0-flash',
    ollamaModel: cfg.OLLAMA_MODEL || 'qwen2.5:7b-instruct',
    ollamaUrl: cfg.OLLAMA_URL || 'http://localhost:11434'
  };
});
ipcMain.handle('nico:save-settings', (_e, s) => {
  s = s || {};
  const provider = (String(s.provider).toLowerCase() === 'ollama') ? 'ollama' : 'gemini';
  const next = {
    PROVIDER: provider,
    GEMINI_API_KEY: String(s.geminiKey || '').trim(),
    MODEL: String(s.geminiModel || '').trim() || 'gemini-2.0-flash',
    OLLAMA_MODEL: String(s.ollamaModel || '').trim() || 'qwen2.5:7b-instruct',
    OLLAMA_URL: String(s.ollamaUrl || '').trim() || 'http://localhost:11434'
  };
  try {
    const dir = app.getPath('userData');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(settingsPath(), JSON.stringify(Object.assign(loadUserSettings(), next), null, 2));
  } catch (e) { console.error('No pude guardar ajustes:', e.message); return { ok: false, error: e.message }; }
  Object.assign(cfg, next);
  RESOLVED_MODEL = null;
  try { rag.resetEmbedModel(); } catch (_) {}
  if (provider === 'ollama') ensureOllama();
  console.log('Ajustes guardados. Proveedor:', provider);
  return { ok: true };
});

// ---- Actualizaciones: consulta tu repo de GitHub ----
function cmpVersion(a, b) {
  const pa = String(a || '0').split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b || '0').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d > 0 ? 1 : -1; }
  return 0;
}
ipcMain.handle('nico:check-update', async () => {
  const repo = cfg.UPDATE_REPO || 'abdonlab/nico-desktop';
  try {
    const r = await fetch(`https://raw.githubusercontent.com/${repo}/main/package.json?t=${Date.now()}`);
    if (!r.ok) return { ok: false, error: 'GitHub ' + r.status };
    const remote = await r.json();
    const current = app.getVersion();
    return { ok: true, current, latest: remote.version, newer: cmpVersion(remote.version, current) > 0, url: `https://github.com/${repo}` };
  } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('nico:open-update', (_e, url) => {
  try { require('electron').shell.openExternal(url || `https://github.com/${cfg.UPDATE_REPO || 'abdonlab/nico-desktop'}`); } catch (e) {}
});

// ---- Conocimiento: subir documentos y vectorizarlos desde la app ----
ipcMain.handle('nico:pick-docs', async () => {
  try {
    const { dialog } = require('electron');
    const res = await dialog.showOpenDialog(avatarWin, {
      title: 'Elige los documentos de conocimiento',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Documentos', extensions: ['pdf', 'docx', 'md', 'markdown', 'txt', 'html', 'htm'] }]
    });
    return (res && !res.canceled) ? res.filePaths : [];
  } catch (e) { console.error('pick-docs:', e.message); return []; }
});
ipcMain.handle('nico:index-docs', async (e, files) => {
  try {
    const r = await rag.indexFiles(files || [], cfg, (done, total) => {
      try { e.sender.send('nico:index-progress', { done, total }); } catch (_) {}
    });
    console.log('Conocimiento vectorizado:', r.count, 'fragmentos de', (r.files || []).join(', '));
    return { ok: true, ...r };
  } catch (err) { console.error('index-docs:', err.message); return { ok: false, error: err.message }; }
});

// Voz del sistema en Mac con 'say'. Detecta y usa una voz de HOMBRE en español
// (prefiere la "mejorada"/enhanced). Puedes forzar una con MAC_VOICE en la config.
let sayProc = null;
let RESOLVED_MAC_VOICE; // undefined = sin resolver
function resolveMacVoice() {
  if (RESOLVED_MAC_VOICE !== undefined) return RESOLVED_MAC_VOICE;
  if (cfg.MAC_VOICE) { RESOLVED_MAC_VOICE = String(cfg.MAC_VOICE); console.log('Voz NICO (config):', RESOLVED_MAC_VOICE); return RESOLVED_MAC_VOICE; }
  try {
    const out = require('child_process').execSync('say -v "?"', { encoding: 'utf8' });
    const voices = [];
    out.split('\n').forEach(l => {
      const mm = l.match(/^(.+?)\s{2,}([a-z]{2}_[A-Z]{2})/);
      if (mm) voices.push({ name: mm[1].trim(), lang: mm[2] });
    });
    const es = voices.filter(v => /^es_/.test(v.lang));
    const pool = es.length ? es : voices;
    const MALE = /(juan|jorge|diego|carlos|enrique|miguel|pablo)/i;
    const male = pool.filter(v => MALE.test(v.name));
    const mp = male.length ? male : pool;
    const pick = mp.find(v => /(mejorada|enhanced|premium|siri)/i.test(v.name))
              || mp.find(v => /es_MX/.test(v.lang))
              || mp[0] || null;
    RESOLVED_MAC_VOICE = pick ? pick.name : null;
    console.log('Voz NICO (say):', RESOLVED_MAC_VOICE || '(por defecto del sistema)');
  } catch (err) { console.error('resolveMacVoice:', err.message); RESOLVED_MAC_VOICE = null; }
  return RESOLVED_MAC_VOICE;
}
ipcMain.on('nico:say', (e, text) => {
  if (process.platform !== 'darwin') return;
  try { if (sayProc) sayProc.kill('SIGTERM'); } catch (err) {}
  const voice = resolveMacVoice();
  const args = voice ? ['-v', voice, String(text || '')] : [String(text || '')];
  try {
    sayProc = spawn('say', args);
    sayProc.on('close', () => { sayProc = null; try { e.sender.send('nico:say-done'); } catch (_) {} });
    sayProc.on('error', () => { sayProc = null; try { e.sender.send('nico:say-done'); } catch (_) {} });
  } catch (err) { console.error('say error:', err.message); try { e.sender.send('nico:say-done'); } catch (_) {} }
});
ipcMain.on('nico:say-stop', () => { try { if (sayProc) sayProc.kill('SIGTERM'); } catch (err) {} sayProc = null; });

app.whenReady().then(() => {
  applyUserSettings();    // ajustes del engranaje ⚙️ (si existen) pisan la config base
  createAvatarWindow();   // muestra el avatar de inmediato
  createTray();           // icono en la bandeja para recuperarlo tras minimizar
  ensureOllama();         // y en paralelo levanta Ollama si hace falta
  try { rag.setUserDir(app.getPath('userData')); rag.loadKnowledge(); } catch (e) { console.error('RAG init:', e.message); }
});
app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (app.isReady() && BrowserWindow.getAllWindows().length === 0) createAvatarWindow(); });

// Si NICO levantó Ollama, lo apaga al cerrar (si ya estaba corriendo, lo deja).
app.on('before-quit', () => {
  if (ollamaProc) {
    try { ollamaProc.kill(); } catch (e) { /* nada */ }
    ollamaProc = null;
  }
});
