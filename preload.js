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
  onSayDone: (cb) => ipcRenderer.on('nico:say-done', cb),
  // Configuración (engranaje ⚙️)
  getSettings: () => ipcRenderer.invoke('nico:get-settings'),
  saveSettings: (s) => ipcRenderer.invoke('nico:save-settings', s),
  // Actualizaciones (GitHub)
  checkUpdate: () => ipcRenderer.invoke('nico:check-update'),
  openUpdate: (url) => ipcRenderer.invoke('nico:open-update', url),
  // Conocimiento (subir y vectorizar documentos)
  pickDocs: () => ipcRenderer.invoke('nico:pick-docs'),
  indexDocs: (files) => ipcRenderer.invoke('nico:index-docs', files),
  onIndexProgress: (cb) => ipcRenderer.on('nico:index-progress', (_e, p) => cb(p))
});
