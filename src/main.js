const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const fs = require('fs')

let mainWindow
let ffmpegProcess = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 940,
    height: 640,
    minWidth: 800,
    minHeight: 580,
    frame: false,
    backgroundColor: '#111111',
    icon: path.join(__dirname, '../assets/icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })
  mainWindow.loadFile(path.join(__dirname, 'index.html'))
}

app.whenReady().then(() => {
  createWindow()
  checkFfmpeg()
})

app.on('window-all-closed', () => {
  stopStream()
  app.quit()
})

// ── FFmpeg path ───────────────────────────────────────────────────
function getFfmpegPath() {
  // 1. Bundled dentro del instalador (producción)
  const bundled = path.join(process.resourcesPath, 'ffmpeg', 'ffmpeg.exe')
  if (fs.existsSync(bundled)) return bundled

  // 2. Carpeta resources/ local (desarrollo)
  const local = path.join(app.getAppPath(), 'resources', 'ffmpeg', 'ffmpeg.exe')
  if (fs.existsSync(local)) return local

  // 3. Sistema PATH
  return 'ffmpeg'
}

function checkFfmpeg() {
  const p = getFfmpegPath()
  const proc = spawn(p, ['-version'], { windowsHide: true })
  proc.on('error', () => {
    if (mainWindow) {
      mainWindow.webContents.send('ffmpeg-missing')
    }
  })
}

// ── Window controls ───────────────────────────────────────────────
ipcMain.on('win-minimize', () => mainWindow.minimize())
ipcMain.on('win-maximize', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize())
ipcMain.on('win-close', () => { stopStream(); app.quit() })

// ── Browse .txt ───────────────────────────────────────────────────
ipcMain.handle('browse-txt', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'Text', extensions: ['txt'] }],
    properties: ['openFile']
  })
  return r.canceled ? null : r.filePaths[0]
})

// ── Get audio devices ─────────────────────────────────────────────
ipcMain.handle('get-devices', async () => {
  return new Promise((resolve) => {
    const ffmpeg = getFfmpegPath()
    const proc = spawn(ffmpeg, ['-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'], { windowsHide: true })
    let out = ''
    proc.stderr.on('data', d => out += d.toString())
    proc.on('close', () => {
      const devices = []
      out.split('\n').forEach(line => {
        const m = line.match(/"([^"]+)"\s+\(audio\)/)
        if (m) devices.push(m[1])
      })
      resolve(devices.length ? devices : ['Dispositivo por defecto'])
    })
    proc.on('error', () => resolve(['Dispositivo por defecto']))
  })
})

// ── Start stream ──────────────────────────────────────────────────
ipcMain.handle('start-stream', async (event, cfg) => {
  try {
    stopStream()
    const args = buildArgs(cfg)
    ffmpegProcess = spawn(getFfmpegPath(), args, { windowsHide: true })
    ffmpegProcess.stderr.on('data', d => mainWindow.webContents.send('ffmpeg-log', d.toString()))
    ffmpegProcess.on('close', code => { mainWindow.webContents.send('stream-stopped', code); ffmpegProcess = null })
    ffmpegProcess.on('error', err => { mainWindow.webContents.send('stream-error', err.message); ffmpegProcess = null })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('stop-stream', async () => { stopStream(); return { ok: true } })

function stopStream() {
  if (ffmpegProcess) {
    ffmpegProcess.kill('SIGTERM')
    setTimeout(() => { if (ffmpegProcess) ffmpegProcess.kill('SIGKILL') }, 2000)
    ffmpegProcess = null
  }
}

// ── Build FFmpeg args ─────────────────────────────────────────────
function buildArgs(cfg) {
  const { device, host, port, mount, password, codec, bitrate,
          sampleRate, channels, vbr, metadata, serverType,
          compressor, noisegate, limiter, normalizer, eq } = cfg

  const ch = channels === 'Estéreo' ? 2 : 1
  const br = parseInt(bitrate)
  const sr = parseInt(sampleRate)

  const filters = []
  const eqFreqs = [32,64,125,250,500,1000,2000,4000,8000,16000]
  if (eq) eq.forEach((g,i) => { if (g !== 0) filters.push(`equalizer=f=${eqFreqs[i]}:t=o:w=1:g=${g}`) })
  if (compressor) filters.push('acompressor=threshold=-18dB:ratio=4:attack=5:release=200:makeup=2')
  if (noisegate)  filters.push('agate=threshold=-40dB:ratio=4')
  if (normalizer) filters.push('dynaudnorm=p=0.95:m=30')
  if (limiter)    filters.push('alimiter=limit=0.95:level=false')

  const filterArgs = filters.length ? ['-af', filters.join(',')] : []

  let codecArgs = []
  if (codec === 'mp3')  codecArgs = ['-c:a','libmp3lame','-b:a',`${br}k`, ...(vbr ? ['-q:a','2'] : [])]
  if (codec === 'aac')  codecArgs = ['-c:a','aac','-b:a',`${br}k`]
  if (codec === 'opus') codecArgs = ['-c:a','libopus','-b:a',`${br}k`,'-vbr', vbr ? 'on' : 'off']
  if (codec === 'ogg')  codecArgs = ['-c:a','libvorbis','-b:a',`${br}k`]

  const metaArgs = metadata ? ['-metadata',`title=${metadata}`,'-metadata','artist=Comunikados Radio'] : []

  let outputUrl, fmtArgs
  if (serverType === 'icecast') {
    const mnt = mount.startsWith('/') ? mount : `/${mount}`
    outputUrl = `icecast://:${password}@${host}:${port}${mnt}`
    fmtArgs = ['-f', codec === 'ogg' ? 'ogg' : codec === 'aac' ? 'adts' : 'mp3']
  } else {
    outputUrl = `shoutcast://:${password}@${host}:${port}`
    fmtArgs = ['-f','mp3']
  }

  return [
    '-f','dshow', '-i',`audio=${device}`,
    '-ar',`${sr}`, '-ac',`${ch}`,
    ...filterArgs, ...codecArgs, ...metaArgs,
    '-reconnect','1','-reconnect_streamed','1','-reconnect_delay_max','5',
    ...fmtArgs, outputUrl
  ]
}
