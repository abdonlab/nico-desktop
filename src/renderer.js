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
function ttsSpeak(text) {
  if (!voiceOn || !('speechSynthesis' in window)) return null;
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
  if (u) { u.onend = stopTalking; u.onerror = stopTalking; }
  else { setTimeout(stopTalking, Math.min(9000, 1400 + text.length * 45)); }
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
  if (!voiceOn && 'speechSynthesis' in window) speechSynthesis.cancel();
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

// -------- Arranque --------
if ('speechSynthesis' in window) {
  speechSynthesis.onvoiceschanged = () => {};
  speechSynthesis.getVoices();
}
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => speak('¡Hola! Soy NICO. Escríbeme abajo y te respondo.'), 700);
  q.focus();
});
