# FreeWhisper

A free, local, open-source voice dictation app for Windows — a drop-in alternative to WhisperFlow / Wispr Flow / Typeless. Press a hotkey, speak, and your words are typed into whatever window has focus. Everything runs on your own machine; no cloud, no subscription, no audio ever leaves your computer.

![Pill UI](https://img.shields.io/badge/UI-pill-6366f1) ![Local](https://img.shields.io/badge/100%25-local-22c55e) ![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **Push-to-dictate pill** — a small, always-on-top, draggable overlay with recording / transcribing states.
- **Global hotkey** — `Ctrl+Space` to start/stop dictation from anywhere.
- **Click-to-toggle** — click the mic icon in the pill; it never steals focus from your current text field.
- **Model switcher** — dropdown to pick:
  - **Fast** (`small`, ~500 MB) — ~3–4× faster on CPU.
  - **Normal** (`large-v3`, ~1.5 GB int8) — best accuracy.
- **100% local** — audio is captured in the browser, sent to a local FastAPI server on `127.0.0.1:8000`, transcribed with [`faster-whisper`](https://github.com/SYSTRAN/faster-whisper), then pasted via simulated `Ctrl+V`.

## Architecture

```
┌────────────────────────┐        ┌────────────────────────────┐
│  Tauri 2 (Rust + JS)   │  HTTP  │  FastAPI + faster-whisper  │
│  • Pill UI (pure HTML) │ ─────► │  • /transcribe             │
│  • MediaRecorder audio │        │  • Runs large-v3 / small   │
│  • Global hotkey       │ ◄───── │    on CPU (int8)           │
│  • Clipboard + paste   │  text  │                            │
└────────────────────────┘        └────────────────────────────┘
```

- **Frontend** — Tauri 2 + Vite + vanilla JS. No framework.
- **Backend** — Python FastAPI served by Uvicorn.
- **Model** — `faster-whisper` (CTranslate2 backend, int8 quantization, CPU-only).
- **Text injection** — the Rust side uses `enigo` to send `Ctrl+V`; `WS_EX_NOACTIVATE` keeps the pill from ever taking focus.

## Requirements

- **Windows 10/11** (the focus/border handling uses Win32 + DWM APIs)
- **Python 3.10+** — tested on 3.14
- **Node.js 18+** — for Tauri's dev server
- **Rust stable toolchain** — `rustup default stable`
- **Microphone**
- ~2 GB disk for models (downloaded on first run)

## Setup

```bash
git clone https://github.com/VIbeStudio-dev/FreeWhisper.git
cd FreeWhisper

# Backend
cd backend
pip install -r requirements.txt
cd ..

# Frontend
cd frontend
npm install
cd ..
```

## Running

Double-click **`start.bat`**, or from a terminal at the project root:

```bash
start.bat
```

This launches:
1. The FastAPI backend in its own terminal window (on first run it downloads both models, ~2 GB total — one-time).
2. The Tauri frontend — the pill appears in the bottom-right of your screen.

### Manual (for development)

```bash
# Terminal 1
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000

# Terminal 2
cd frontend
npm run tauri dev
```

## Usage

1. Put your cursor in any text field (Notepad, VS Code, Slack, a browser…).
2. Press **`Ctrl+Space`** or click the mic icon.
3. Speak.
4. Press `Ctrl+Space` / click the mic again to stop.
5. Transcribed text is pasted at your cursor.

Drag the pill anywhere on screen by grabbing the "Ready" / waveform area (not the mic button).

## Project structure

```
FreeWhisper/
├── start.bat                  ← launches backend + frontend together
├── start_backend.bat          ← backend only
├── backend/
│   ├── main.py                FastAPI app, model loader, /transcribe endpoint
│   └── requirements.txt
└── frontend/
    ├── index.html             pill markup
    ├── src/
    │   ├── main.js            audio capture, API call, clipboard + paste
    │   └── styles.css         glassmorphism pill
    ├── vite.config.js
    ├── package.json
    └── src-tauri/
        ├── Cargo.toml
        ├── tauri.conf.json    window config (transparent, always-on-top)
        ├── capabilities/      Tauri 2 permission model
        └── src/
            ├── main.rs
            └── lib.rs         global shortcut, paste cmd, Win32 styling
```

## Customization

- **Change the hotkey** → edit `frontend/src-tauri/src/lib.rs`, the `on_shortcut("CommandOrControl+Space", …)` line.
- **Change default model** → edit `frontend/src/main.js`, the `localStorage.getItem("bf_model") || "normal"` fallback.
- **Change pill position** → drag it once; position persists per Tauri window state, or edit the `x` / `y` fields in `tauri.conf.json`.
- **Change language** → `/transcribe` currently auto-detects. To pin a language, pass `language="en"` to `model.transcribe(...)` in `backend/main.py`.

## Known limitations

- **Windows only** — the focus and border handling uses Win32 / DWM APIs. The pill UI works on any OS, but click-without-focus would need porting.
- **CPU inference** — `faster-whisper` supports CUDA but not AMD ROCm. On AMD-GPU laptops (Ryzen iGPU), CPU is the only practical path. Still plenty fast on modern CPUs with AVX2.
- **First run is slow** — both models download on first startup (~2 GB). After that, startup is just loading from disk.

## License

MIT.

## Credits

- [faster-whisper](https://github.com/SYSTRAN/faster-whisper) — CTranslate2 port of Whisper.
- [OpenAI Whisper](https://github.com/openai/whisper) — original model.
- [Tauri](https://tauri.app/) — the Rust/WebView app framework.
- [enigo](https://github.com/enigo-rs/enigo) — cross-platform input simulation.
