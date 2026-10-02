const { contextBridge, ipcRenderer } = require('electron');

// Puente seguro entre el avatar y el proceso principal.
contextBridge.exposeInMainWorld('nico', {
  quit: () => ipcRenderer.send('nico:quit'),
  togglePin: (pinned) => ipcRenderer.send('nico:toggle-pin', pinned),
  clickThrough: (ignore) => ipcRenderer.send('nico:click-through', ignore),
  // Pregunta a Gemini. messages = [{role:'user'|'model', text}]
  ask: (messages) => ipcRenderer.invoke('nico:ask', messages)
});
