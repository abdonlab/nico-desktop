const { contextBridge, ipcRenderer } = require('electron');

// Puente seguro entre el avatar y el proceso principal.
contextBridge.exposeInMainWorld('nico', {
  quit: () => ipcRenderer.send('nico:quit'),
  minimize: () => ipcRenderer.send('nico:minimize'),
  togglePin: (pinned) => ipcRenderer.send('nico:toggle-pin', pinned),
  clickThrough: (ignore) => ipcRenderer.send('nico:click-through', ignore),
  // Pregunta a Gemini/Ollama. messages = [{role:'user'|'model', text}]
  ask: (messages) => ipcRenderer.invoke('nico:ask', messages),
  // Voz del sistema (Mac)
  platform: process.platform,
  say: (text) => ipcRenderer.send('nico:say', text),
  sayStop: () => ipcRenderer.send('nico:say-stop'),
  onSayDone: (cb) => ipcRenderer.on('nico:say-done', cb)
});
