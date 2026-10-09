// ============================================================
//  NICO — lobo flotante con chat integrado
// ============================================================

const avatar = document.getElementById('avatar');
const bubble = document.getElementById('bubble');
const q      = document.getElementById('q');
const sendBtn = document.getElementById('sendBtn');

const history = [];      // [{role:'user'|'model', text}]
let busy = false;
let voiceOn = true;
let hideTimer = null;

// -------- Animación de "hablar" --------
function startTalking() { avatar.classList.add('speaking'); }
function stopTalking()  { avatar.classList.remove('speaking'); }

// -------- Globo --------
let typeTimer = null;
function stopTyping() { if (typeTimer) { clearInterval(typeTimer); typeTimer = null; } }

// Texto instantáneo (para "pensando…" y avisos)
function showBubble(text, opts = {}) {
  stopTyping();
  clearTimeout(hideTimer);
  bubble.textContent = text;
  bubble.classList.toggle('think', !!opts.think);
  bubble.classList.add('show');
  bubble.scrollTop = 0;
}

// Texto que sale letra por letra (máquina de escribir / retro) con cursor
function typeBubble(text, speed = 45) {
  stopTyping();
  clearTimeout(hideTimer);
  bubble.classList.remove('think');
  bubble.classList.add('show');
  bubble.textContent = '';
  const cursor = document.createElement('span');
  cursor.className = 'cursor';
  bubble.appendChild(cursor);
  let i = 0;
  typeTimer = setInterval(() => {
    if (i >= text.length) { stopTyping(); cursor.remove(); return; }
    cursor.insertAdjacentText('beforebegin', text[i]);   // inserta el carácter antes del cursor
    i++;
    bubble.scrollTop = bubble.scrollHeight;
  }, speed);
}
function hideBubble() { stopTyping(); bubble.classList.remove('show'); }

// -------- Voz --------
// ===== VOZ — ajústala aquí =====
// VOICE_NAME vacío = NICO elige automáticamente la mejor voz en español.
// Para forzar una voz, pon su nombre EXACTO, p.ej. 'Paulina (Mejorada)' o 'Mónica'.
const VOICE_NAME = '';
const VOICE_RATE = 0.95;  // velocidad (1.0 = normal; más bajo suena más calmado)
const VOICE_PITCH = 1.0;  // tono (1.0 = normal)

function pickSpanishVoice() {
  const v = speechSynthesis.getVoices();
  if (!v || !v.length) return null;
  if (VOICE_NAME) {
    const forced = v.find(x => x.name === VOICE_NAME)
                || v.find(x => x.name.toLowerCase().includes(VOICE_NAME.toLowerCase()));
    if (forced) return forced;
  }
  const es = v.filter(x => /^es/i.test(x.lang));
  const pool = es.length ? es : v;
  // Prefiere voces de alta calidad y evita las "compact" (las robóticas).
  // Prefiere voz de HOMBRE en español (NICO es un lobo).
  const MALE = /(juan|jorge|diego|carlos|enrique|miguel|pablo|crist[o\u00f3]bal|arnau)/i;
  const male = pool.filter(x => MALE.test(x.name));
  const mp = male.length ? male : pool;
  return mp.find(x => /(enhanced|premium|siri|neural|mejorada)/i.test(x.name))
      || mp.find(x => !/compact/i.test(x.name) && /es(-|_)MX/i.test(x.lang))
      || mp.find(x => !/compact/i.test(x.name))
      || mp.find(x => /es(-|_)MX/i.test(x.lang))
      || mp[0] || pool[0] || null;
}
const USE_SAY = !!(window.nico && window.nico.platform === 'darwin' && window.nico.say);

function ttsSpeak(text) {
  if (!voiceOn) return null;
  if (USE_SAY) { window.nico.say(text); return 'say'; }   // Mac: voz del sistema (la que elegiste en Ajustes)
  if (!('speechSynthesis' in window)) return null;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = pickSpanishVoice();
  if (v) u.voice = v;
  u.lang = v ? v.lang : 'es-MX';
  u.rate = VOICE_RATE; u.pitch = VOICE_PITCH;
  speechSynthesis.speak(u);
  return u;
}

function speak(text) {
  typeBubble(text);   // sale letra por letra
  startTalking();
  const u = ttsSpeak(text);
  if (u && u !== 'say') { u.onend = stopTalking; u.onerror = stopTalking; }
  else if (!u) { setTimeout(stopTalking, Math.min(9000, 1400 + text.length * 45)); }
  // con 'say' (Mac), la animación para cuando el sistema termina de hablar (onSayDone)
}

// -------- Gracia aleatoria (botón 🎲) --------
const FUN_ANIMS = ['fx-shake', 'fx-spin', 'fx-jump', 'fx-wobble', 'fx-zoom', 'fx-nod'];
const FUN_PHRASES = [
  '¿Me hablabas?', '¡Ey, aquí estoy!', 'Grr… es broma.', '¿Jugamos?',
  '¡Modo lobo activado!', 'A ver, sorpréndeme tú.', '¡Estoy despierto!',
  '¿Otra vez yo? jaja', 'Auuu.', 'Listo para ayudarte.', '¡Boop!'
];
function playRandomFun() {
  const fx = FUN_ANIMS[Math.floor(Math.random() * FUN_ANIMS.length)];
  avatar.classList.remove(...FUN_ANIMS);
  void avatar.offsetWidth;              // reinicia la animación
  avatar.classList.add(fx);
  setTimeout(() => avatar.classList.remove(fx), 1000);
  const phrase = FUN_PHRASES[Math.floor(Math.random() * FUN_PHRASES.length)];
  typeBubble(phrase, 35);
  ttsSpeak(phrase);
}

// -------- Preguntar a NICO (Gemini) --------
async function ask() {
  const text = q.value.trim();
  if (!text || busy) return;
  busy = true; sendBtn.disabled = true;
  q.value = '';

  history.push({ role: 'user', text });
  showBubble('NICO está pensando…', { think: true });

  const res = await window.nico.ask(history);
  const reply = (res && res.reply) ? res.reply : 'No recibí respuesta.';
  if (res && res.ok) history.push({ role: 'model', text: reply });

  speak(reply);
  busy = false; sendBtn.disabled = false;
  q.focus();
}

sendBtn.addEventListener('click', ask);
q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ask(); } });

// -------- Controles --------
const btnMute  = document.getElementById('btnMute');
const btnMin   = document.getElementById('btnMin');
const btnFun   = document.getElementById('btnFun');
const btnPin   = document.getElementById('btnPin');
const btnGhost = document.getElementById('btnGhost');
const btnClose = document.getElementById('btnClose');
let pinned = true, ghost = false;

btnMute.addEventListener('click', () => {
  voiceOn = !voiceOn;
  btnMute.textContent = voiceOn ? '🔊' : '🔇';
  if (!voiceOn) {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    if (window.nico && window.nico.sayStop) window.nico.sayStop();
  }
});

btnMin.addEventListener('click', () => window.nico.minimize());
btnFun.addEventListener('click', playRandomFun);
btnPin.addEventListener('click', () => {
  pinned = !pinned;
  btnPin.classList.toggle('active', pinned);
  window.nico.togglePin(pinned);
});
btnGhost.addEventListener('click', () => {
  ghost = !ghost;
  btnGhost.classList.toggle('active', ghost);
  window.nico.clickThrough(ghost);
  showBubble(ghost ? 'Modo fantasma 👻' : 'Aquí estoy ✨');
  hideTimer = setTimeout(hideBubble, 1800);
});
btnClose.addEventListener('click', () => window.nico.quit());

// -------- Configuración (engranaje ⚙️) --------
const btnCfg    = document.getElementById('btnCfg');
const cfgPanel  = document.getElementById('cfgPanel');
const segGemini = document.getElementById('segGemini');
const segOllama = document.getElementById('segOllama');
const cfgGemini = document.getElementById('cfgGemini');
const cfgOllama = document.getElementById('cfgOllama');
const cfgKey    = document.getElementById('cfgKey');
const cfgGModel = document.getElementById('cfgGModel');
const cfgOModel = document.getElementById('cfgOModel');
const cfgOUrl   = document.getElementById('cfgOUrl');
const cfgOk     = document.getElementById('cfgOk');
const cfgCancel = document.getElementById('cfgCancel');
const cfgUpdate = document.getElementById('cfgUpdate');
const cfgUpdMsg = document.getElementById('cfgUpdMsg');

let cfgProvider = 'gemini';
function setCfgProvider(p) {
  cfgProvider = (p === 'ollama') ? 'ollama' : 'gemini';
  segGemini.classList.toggle('sel', cfgProvider === 'gemini');
  segOllama.classList.toggle('sel', cfgProvider === 'ollama');
  cfgGemini.classList.toggle('cfg-hidden', cfgProvider !== 'gemini');
  cfgOllama.classList.toggle('cfg-hidden', cfgProvider !== 'ollama');
}

async function openCfg() {
  let s = {};
  try { s = (window.nico.getSettings && await window.nico.getSettings()) || {}; } catch (e) {}
  cfgKey.value    = s.geminiKey   || '';
  cfgGModel.value = s.geminiModel || '';
  cfgOModel.value = s.ollamaModel || '';
  cfgOUrl.value   = s.ollamaUrl   || '';
  cfgUpdMsg.textContent = '';
  setCfgProvider(s.provider || 'gemini');
  cfgPanel.classList.add('show');
}
function closeCfg() { cfgPanel.classList.remove('show'); }

btnCfg.addEventListener('click', openCfg);
segGemini.addEventListener('click', () => setCfgProvider('gemini'));
segOllama.addEventListener('click', () => setCfgProvider('ollama'));
cfgCancel.addEventListener('click', closeCfg);
cfgPanel.addEventListener('click', (e) => { if (e.target === cfgPanel) closeCfg(); });

cfgOk.addEventListener('click', async () => {
  const data = {
    provider: cfgProvider,
    geminiKey: cfgKey.value.trim(),
    geminiModel: cfgGModel.value.trim(),
    ollamaModel: cfgOModel.value.trim(),
    ollamaUrl: cfgOUrl.value.trim()
  };
  cfgOk.disabled = true;
  try { await window.nico.saveSettings(data); } catch (e) {}
  cfgOk.disabled = false;
  closeCfg();
  const quien = cfgProvider === 'ollama' ? 'Ollama (local)' : 'Gemini (nube)';
  showBubble('✓ Configuración guardada — ahora uso ' + quien);
  hideTimer = setTimeout(hideBubble, 2600);
});

// Botón de actualizaciones (se conecta a GitHub)
cfgUpdate.addEventListener('click', async () => {
  cfgUpdMsg.textContent = 'Buscando en GitHub…';
  let r = {};
  try { r = await window.nico.checkUpdate(); } catch (e) { r = { ok: false }; }
  if (!r || !r.ok) { cfgUpdMsg.textContent = 'No pude consultar GitHub. Revisa tu internet.'; return; }
  if (r.newer) {
    cfgUpdMsg.innerHTML = '¡Hay una versión nueva (' + r.latest + ')! Tienes la ' + r.current +
      '. <span id="cfgUpdOpen">Abrir en GitHub</span>';
    const o = document.getElementById('cfgUpdOpen');
    if (o) o.addEventListener('click', () => window.nico.openUpdate(r.url));
  } else {
    cfgUpdMsg.textContent = 'Ya tienes la última versión (' + r.current + ').';
  }
});

// Conocimiento: elegir documentos y vectorizarlos desde la app
const cfgPickDocs  = document.getElementById('cfgPickDocs');
const cfgDocsList  = document.getElementById('cfgDocsList');
const cfgIndexDocs = document.getElementById('cfgIndexDocs');
const cfgIdxMsg    = document.getElementById('cfgIdxMsg');
let docsElegidos = [];

function baseName(p) { return String(p).split(/[\\/]/).pop(); }
function pintarDocs() {
  cfgDocsList.textContent = docsElegidos.length
    ? '📎 ' + docsElegidos.map(baseName).join(', ')
    : 'Ningún documento elegido.';
}
pintarDocs();

cfgPickDocs.addEventListener('click', async () => {
  let files = [];
  try { files = (await window.nico.pickDocs()) || []; } catch (e) {}
  if (files.length) { docsElegidos = files; pintarDocs(); cfgIdxMsg.textContent = ''; }
});

if (window.nico && window.nico.onIndexProgress) {
  window.nico.onIndexProgress((p) => {
    if (p && p.total) cfgIdxMsg.textContent = 'Vectorizando… ' + p.done + '/' + p.total;
  });
}

cfgIndexDocs.addEventListener('click', async () => {
  if (!docsElegidos.length) { cfgIdxMsg.textContent = 'Primero elige documentos.'; return; }
  cfgIndexDocs.disabled = true; cfgPickDocs.disabled = true;
  cfgIdxMsg.textContent = 'Leyendo y vectorizando…';
  let r = {};
  try { r = await window.nico.indexDocs(docsElegidos); } catch (e) { r = { ok: false, error: e.message }; }
  cfgIndexDocs.disabled = false; cfgPickDocs.disabled = false;
  if (r && r.ok) {
    cfgIdxMsg.textContent = '✓ Listo: ' + r.count + ' fragmentos. NICO ya usa este conocimiento.';
    docsElegidos = []; pintarDocs();
  } else {
    cfgIdxMsg.textContent = 'Error: ' + ((r && r.error) || 'no se pudo vectorizar');
  }
});

// -------- Arranque --------
if ('speechSynthesis' in window) {
  speechSynthesis.onvoiceschanged = () => {};
  speechSynthesis.getVoices();
}
if (window.nico && window.nico.onSayDone) window.nico.onSayDone(() => stopTalking());
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => speak('¡Hola! Soy NICO. Escríbeme abajo y te respondo.'), 700);
  q.focus();
});
