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
  setTimeout(checkFfmpeg, 2000)
})

app.on('window-all-closed', () => {
  stopStream()
  app.quit()
})

function getFfmpegPath() {
  const bundled = path.join(process.resourcesPath, 'ffmpeg', 'ffmpeg.exe')
  if (fs.existsSync(bundled)) return bundled
  const local = path.join(app.getAppPath(), 'resources', 'ffmpeg', 'ffmpeg.exe')
  if (fs.existsSync(local)) return local
  return 'ffmpeg'
}

function checkFfmpeg() {
  const p = getFfmpegPath()
  const proc = spawn(p, ['-version'], { windowsHide: true })
  proc.on('error', () => {
    if (mainWindow) mainWindow.webContents.send('ffmpeg-missing')
  })
}

ipcMain.on('win-minimize', () => mainWindow.minimize())
ipcMain.on('win-maximize', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize())
ipcMain.on('win-close', () => { stopStream(); app.quit() })

ipcMain.handle('browse-txt', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'Text', extensions: ['txt'] }],
    properties: ['openFile']
  })
  return r.canceled ? null : r.filePaths[0]
})

// ── Detectar dispositivos de audio (Windows WASAPI) ───────────────
ipcMain.handle('get-devices', async () => {
  return new Promise((resolve) => {
    const ffmpeg = getFfmpegPath()
    const proc = spawn(ffmpeg, [
      '-list_devices', 'true',
      '-f', 'dshow',
      '-i', 'dummy'
    ], { windowsHide: true })

    let out = ''
    proc.stderr.on('data', d => { out += d.toString() })
    proc.stdout.on('data', d => { out += d.toString() })

    proc.on('close', () => {
      const devices = []
      const lines = out.split('\n')
      let inAudio = false
      lines.forEach(line => {
        if (line.includes('(audio)')) inAudio = true
        if (inAudio) {
          const m = line.match(/"([^"]+)"/)
          if (m && m[1] && !devices.includes(m[1])) {
            devices.push(m[1])
          }
        }
      })
      // Filtrar solo líneas de audio
      const audioDevices = []
      lines.forEach(line => {
        if (line.toLowerCase().includes('(audio)')) {
          const m = line.match(/"([^"]+)"/)
          if (m && m[1]) audioDevices.push(m[1])
        }
      })
      resolve(audioDevices.length ? audioDevices : ['Dispositivo por defecto'])
    })
    proc.on('error', () => resolve(['Dispositivo por defecto']))
    setTimeout(() => {
      try { proc.kill() } catch(e) {}
      resolve(['Dispositivo por defecto'])
    }, 8000)
  })
})

// ── Start stream ──────────────────────────────────────────────────
ipcMain.handle('start-stream', async (event, cfg) => {
  try {
    stopStream()
    const args = buildArgs(cfg)
    console.log('FFmpeg args:', args.join(' '))
    ffmpegProcess = spawn(getFfmpegPath(), args, { windowsHide: true })
    ffmpegProcess.stderr.on('data', d => mainWindow.webContents.send('ffmpeg-log', d.toString()))
    ffmpegProcess.stdout.on('data', d => mainWindow.webContents.send('ffmpeg-log', d.toString()))
    ffmpegProcess.on('close', code => {
      mainWindow.webContents.send('stream-stopped', code)
      ffmpegProcess = null
    })
    ffmpegProcess.on('error', err => {
      mainWindow.webContents.send('stream-error', err.message)
      ffmpegProcess = null
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('stop-stream', async () => { stopStream(); return { ok: true } })

function stopStream() {
  if (ffmpegProcess) {
    ffmpegProcess.kill('SIGTERM')
    setTimeout(() => { try { if (ffmpegProcess) ffmpegProcess.kill('SIGKILL') } catch(e){} }, 2000)
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

  // Filtros DSP y EQ
  const filters = []
  const eqFreqs = [32,64,125,250,500,1000,2000,4000,8000,16000]
  if (eq) eq.forEach((g,i) => { if (g !== 0) filters.push(`equalizer=f=${eqFreqs[i]}:t=o:w=1:g=${g}`) })
  if (compressor) filters.push('acompressor=threshold=-18dB:ratio=4:attack=5:release=200:makeup=2')
  if (noisegate)  filters.push('agate=threshold=-40dB:ratio=4')
  if (normalizer) filters.push('dynaudnorm=p=0.95:m=30')
  if (limiter)    filters.push('alimiter=limit=0.95:level=false')
  const filterArgs = filters.length ? ['-af', filters.join(',')] : []

  // Codec
  let codecArgs = []
  if (codec === 'mp3')  codecArgs = ['-c:a','libmp3lame','-b:a',`${br}k`, ...(vbr?['-q:a','2']:[]) ]
  if (codec === 'aac')  codecArgs = ['-c:a','aac','-b:a',`${br}k`]
  if (codec === 'opus') codecArgs = ['-c:a','libopus','-b:a',`${br}k`,'-vbr',vbr?'on':'off']
  if (codec === 'ogg')  codecArgs = ['-c:a','libvorbis','-b:a',`${br}k`]

  const metaArgs = metadata ? ['-metadata',`title=${metadata}`,'-metadata','artist=Comunikados Radio'] : []

  // Input — si es "Dispositivo por defecto" usar audio=default
  const inputDevice = (device === 'Dispositivo por defecto') ? 'audio=@device_cm_{33D9A762-90C8-11D0-BD43-00A0C911CE86}\\wave_{00000000-0000-0000-0000-000000000000}' : `audio=${device}`

  let outputUrl, fmtArgs
  if (serverType === 'icecast') {
    const mnt = mount.startsWith('/') ? mount : `/${mount}`
    outputUrl = `icecast://:${password}@${host}:${port}${mnt}`
    fmtArgs = ['-f', codec==='ogg'?'ogg':codec==='aac'?'adts':'mp3']
  } else {
    // Shoutcast v2 — formato correcto
    outputUrl = `shoutcast://:${password}@${host}:${port}`
    fmtArgs = ['-f', 'mp3', '-content_type', 'audio/mpeg']
  }

  return [
    '-f', 'dshow',
    '-i', `audio=${device}`,
    '-ar', `${sr}`,
    '-ac', `${ch}`,
    ...filterArgs,
    ...codecArgs,
    ...metaArgs,
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '5',
    ...fmtArgs,
    outputUrl
  ]
}
