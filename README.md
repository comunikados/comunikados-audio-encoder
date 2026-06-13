# 🎙️ Comunikados Audio Encoder

**Professional radio streaming encoder for Windows**  
Icecast · Shoutcast · MP3 · AAC · Opus · OGG  
By [Grup Comunikados](https://comunikados.cl)

---

## ✨ Features

- ✅ Streaming to **Icecast** and **Shoutcast** servers
- ✅ Codecs: **MP3, AAC, Opus (Ultra Low Latency), OGG Vorbis**
- ✅ Bitrates: 32 – 320 kbps
- ✅ **10-band equalizer** (32Hz to 16kHz)
- ✅ **DSP audio processor**: Compressor, Noise Gate, Limiter, Normalizer
- ✅ Audio device selector (WASAPI / ASIO)
- ✅ Live metadata support (.txt file or manual)
- ✅ VBR (Variable Bitrate) mode
- ✅ Auto-reconnect on disconnect
- ✅ Real-time VU meters
- ✅ On-air timer
- ✅ Frameless dark UI

---

## 🚀 Quick Start (Development)

### 1. Prerequisites

- [Node.js 18+](https://nodejs.org/)
- [FFmpeg for Windows](https://www.gyan.dev/ffmpeg/builds/) — **required for audio encoding**

### 2. Clone & Install

```bash
git clone https://github.com/TU_USUARIO/comunikados-audio-encoder.git
cd comunikados-audio-encoder
npm install
```

### 3. Install FFmpeg

Download **FFmpeg full build** from https://www.gyan.dev/ffmpeg/builds/  
Extract and place `ffmpeg.exe` in one of these locations:

```
comunikados-audio-encoder/
└── ffmpeg.exe          ← Option A: next to package.json

OR add ffmpeg to your system PATH (Option B)
```

### 4. Run

```bash
npm start
```

---

## 🏗️ Build .exe Installer

```bash
npm run build
```

Output in `dist/` folder:
- `Comunikados Audio Encoder Setup x.x.x.exe` — NSIS installer
- `Comunikados Audio Encoder x.x.x.exe` — Portable .exe

> **Note:** For the built .exe to work, bundle `ffmpeg.exe` in `resources/ffmpeg/ffmpeg.exe`  
> or instruct users to install FFmpeg and add it to PATH.

---

## ⚙️ Configuration

All settings are entered in the UI:

| Field | Description |
|-------|-------------|
| Host | IP or domain of your streaming server |
| Port | Icecast default: 8000 · Shoutcast default: 8005 |
| Mount point | Icecast only (e.g. `/live`) |
| Password | Source password of your server |
| Codec | MP3 recommended for max compatibility |
| Bitrate | 128 kbps standard · 192+ for high quality |
| Device | Select your microphone or mixer via WASAPI |
| Metadata | Song title displayed to listeners |

---

## 🔊 DSP Audio Processor

| Effect | Description |
|--------|-------------|
| Compressor | Evens out loud/quiet differences |
| Noise Gate | Cuts background noise when silent |
| Limiter | Prevents clipping / distortion |
| Normalizer | Auto-levels overall volume |

Powered by FFmpeg audio filters (acompressor, agate, dynaudnorm, alimiter).

---

## 📁 Project Structure

```
comunikados-audio-encoder/
├── src/
│   ├── main.js        ← Electron main process + FFmpeg control
│   ├── preload.js     ← Secure IPC bridge
│   └── index.html     ← Full UI (single file)
├── assets/
│   └── icon.ico       ← App icon (add your own)
├── package.json
└── README.md
```

---

## 🛠️ Tech Stack

- [Electron](https://www.electronjs.org/) — Desktop app framework
- [FFmpeg](https://ffmpeg.org/) — Audio encoding engine
- HTML5 + CSS3 + Vanilla JS — UI (no frameworks needed)

---

## 📋 Requirements

- Windows 10 / 11 (64-bit)
- FFmpeg installed (see above)
- Icecast or Shoutcast streaming server

---

## 🆚 Compared to RadioCaster / BUTT

| Feature | Comunikados Encoder | RadioCaster | BUTT |
|---------|-------------------|-------------|------|
| Free / Open Source | ✅ | ❌ Paid | ✅ |
| Icecast support | ✅ | ✅ | ✅ |
| Shoutcast support | ✅ | ✅ | ✅ |
| 10-band EQ | ✅ | ✅ | ❌ |
| DSP Processor | ✅ | ✅ | ❌ |
| Custom branding | ✅ | ❌ | ❌ |
| Windows native .exe | ✅ | ✅ | ✅ |

---

## 📄 License

MIT — free to use, modify and distribute.

---

**Grup Comunikados** · comunikados.cl · tuciudadlatina@gmail.com
