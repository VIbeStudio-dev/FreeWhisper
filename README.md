# FreeWhisper

A free, local, source-available voice dictation app for Windows — a drop-in alternative to WhisperFlow / Wispr Flow / Typeless. Press a hotkey, speak, and your words are typed into whatever window has focus. Everything runs on your own machine; no cloud, no subscription, no audio ever leaves your computer.

![Pill UI](https://img.shields.io/badge/UI-pill-fbbf24) ![Local](https://img.shields.io/badge/100%25-local-22c55e) ![License](https://img.shields.io/badge/license-Source--Available-fbbf24)

## Features

- **Always-on-top pill** — small, draggable, never steals focus.
- **Global hotkey** — `Ctrl+Space` from anywhere starts/stops dictation.
- **Live audio-reactive waveform** — Web Audio `AnalyserNode` drives a yellow 7-bar visualizer that responds to your voice in real time. The dark-grey mic button morphs into the waveform as soon as you start speaking.
- **Two speed modes** — no slow modes anymore, both are fast:
  - **Fast** (`small`, ~500 MB int8) — solid accuracy, good speed. Default.
  - **Ultra-fast** (`tiny.en`, ~75 MB int8) — ~2× faster than Fast. English-only. Tuned with `beam_size=1`, tighter VAD (`min_silence_duration_ms=300`), and `condition_on_previous_text=False` for minimum latency.
- **100% local** — audio is captured in the browser, sent to a local FastAPI server on `127.0.0.1:8000`, transcribed with [`faster-whisper`](https://github.com/SYSTRAN/faster-whisper), then pasted via simulated `Ctrl+V`.

## The "engine"

FreeWhisper's transcription path is a thin Python bridge in `backend/main.py` that wraps `faster-whisper` (CTranslate2 backend, int8 quantized) and exposes a single `/transcribe` endpoint. The Ultra-fast mode is a tuned configuration of that bridge — same engine, smaller model, more aggressive decode/VAD parameters — chosen because it gets you most of the speedup of a native C++ port (e.g. whisper.cpp) without adding a build toolchain. Pure Python, no extra dependencies.

## Architecture

```
┌────────────────────────┐        ┌────────────────────────────┐
│  Tauri 2 (Rust + JS)   │  HTTP  │  FastAPI + faster-whisper  │
│  • Pill UI (pure HTML) │ ─────► │  • /transcribe             │
│  • MediaRecorder audio │        │  • Fast: small             │
│  • Web Audio waveform  │        │  • Ultra-fast: tiny.en     │
│  • Global hotkey       │ ◄───── │    (beam=1, tight VAD)     │
│  • Clipboard + paste   │  text  │  • CPU + int8              │
└────────────────────────┘        └────────────────────────────┘
```

- **Frontend** — Tauri 2 + Vite + vanilla JS. No framework.
- **Backend** — Python FastAPI served by Uvicorn.
- **Models** — `faster-whisper` (CTranslate2 backend, int8, CPU-only).
- **Text injection** — the Rust side uses `enigo` to send `Ctrl+V`; `WS_EX_NOACTIVATE` keeps the pill from ever taking focus.

## Requirements

- **Windows 10/11** (focus/border handling uses Win32 + DWM APIs)
- **Python 3.10+** — tested on 3.14
- **Node.js 18+** — for Tauri's dev server
- **Rust stable toolchain** — `rustup default stable`
- **Microphone**
- ~600 MB disk for both models combined (downloaded on first run)

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
1. The FastAPI backend in its own terminal window (on first run it downloads both models — `small` ~500 MB and `tiny.en` ~75 MB).
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
2. Press **`Ctrl+Space`** or click the centered yellow-ringed mic button on the pill.
3. Speak — the mic icon swaps to a live audio-reactive waveform.
4. Press `Ctrl+Space` / click again to stop.
5. Transcribed text is pasted at your cursor.

Drag the pill anywhere on screen by grabbing the area around the button (not the button itself).

## Project structure

```
FreeWhisper/
├── start.bat                  ← launches backend + frontend together
├── start_backend.bat          ← backend only
├── LICENSE                    ← custom source-available license
├── backend/
│   ├── main.py                FastAPI app, model loader, /transcribe endpoint
│   └── requirements.txt
└── frontend/
    ├── index.html             pill markup
    ├── src/
    │   ├── main.js            audio capture, Web Audio waveform, API call, paste
    │   └── styles.css         yellow-ringed pill theme
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
- **Change default model** → edit `frontend/src/main.js`, the saved-model fallback (`fast` or `fast2x`).
- **Change pill position** → drag it once; position persists per Tauri window state, or edit the `x` / `y` fields in `tauri.conf.json`.
- **Pin the language** (Fast mode) → pass `language="en"` to `model.transcribe(...)` in `backend/main.py`. (Ultra-fast already uses `tiny.en`, English only.)

## Known limitations

- **Windows only** — the focus and border handling uses Win32 / DWM APIs. The pill UI works on any OS, but click-without-focus would need porting.
- **CPU inference** — `faster-whisper` supports CUDA but not AMD ROCm. On AMD-GPU laptops (Ryzen iGPU), CPU is the only practical path. Still plenty fast on modern CPUs with AVX2.
- **First run is slow** — both models download on first startup. After that, startup is just loading from disk.
- **Ultra-fast is English-only** — it uses the `tiny.en` weights. If you need other languages, use Fast.

## License

FreeWhisper is **source-available, not open-source**. See [LICENSE](LICENSE) for the full text. In short:

- ✅ Free to use, including inside a business or commercial setting.
- ✅ Free to modify and redistribute (with the license preserved).
- ❌ You may **not** sell, resell, sublicense, or otherwise monetize the software or a hosted version of it.
- ❌ You may not bundle it with a paid product/service to derive revenue from it.

## Credits

- [faster-whisper](https://github.com/SYSTRAN/faster-whisper) — CTranslate2 port of Whisper.
- [OpenAI Whisper](https://github.com/openai/whisper) — original model.
- [Tauri](https://tauri.app/) — the Rust/WebView app framework.
- [enigo](https://github.com/enigo-rs/enigo) — cross-platform input simulation.
