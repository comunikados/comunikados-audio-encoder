const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('encoder', {
  minimize: () => ipcRenderer.send('win-minimize'),
  maximize: () => ipcRenderer.send('win-maximize'),
  close: () => ipcRenderer.send('win-close'),
  browseTxt: () => ipcRenderer.invoke('browse-txt'),
  getDevices: () => ipcRenderer.invoke('get-devices'),
  startStream: (config) => ipcRenderer.invoke('start-stream', config),
  stopStream: () => ipcRenderer.invoke('stop-stream'),
  onFfmpegLog: (cb) => ipcRenderer.on('ffmpeg-log', (e, msg) => cb(msg)),
  onStreamStopped: (cb) => ipcRenderer.on('stream-stopped', (e, code) => cb(code)),
  onStreamError: (cb) => ipcRenderer.on('stream-error', (e, msg) => cb(msg)),
  onFfmpegMissing: (cb) => ipcRenderer.on('ffmpeg-missing', () => cb())
})
