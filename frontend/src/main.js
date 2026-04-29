import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";

const BACKEND = "http://127.0.0.1:8000";

let recorder = null;
let chunks = [];
let stream = null;
let isRecording = false;

let audioCtx = null;
let analyser = null;
let sourceNode = null;
let vizFrame = null;

const pill = document.getElementById("pill");
const statusEl = document.getElementById("status");
const modelSelect = document.getElementById("model-select");
const bars = Array.from(document.querySelectorAll(".wave-container .bar"));

// Remember the user's choice across restarts
const savedModel = localStorage.getItem("bf_model");
modelSelect.value = (savedModel === "fast" || savedModel === "fast2x") ? savedModel : "fast";
modelSelect.addEventListener("change", () => {
  localStorage.setItem("bf_model", modelSelect.value);
});

function setState(s) {
  pill.className = `pill ${s}`;
  statusEl.textContent = { idle: "Ready", recording: "Recording…", processing: "Transcribing…", error: "Error" }[s] ?? "Ready";
}

function startVisualizer() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.6;
  sourceNode = audioCtx.createMediaStreamSource(stream);
  sourceNode.connect(analyser);

  const buf = new Uint8Array(analyser.frequencyBinCount);
  const N = bars.length;
  const minH = 4;
  const maxH = 18;

  const tick = () => {
    analyser.getByteFrequencyData(buf);
    // Slice the lower ~half of the spectrum (voice band) into N bands.
    const usable = Math.floor(buf.length * 0.55);
    const bandSize = Math.max(1, Math.floor(usable / N));
    for (let i = 0; i < N; i++) {
      let sum = 0;
      const start = i * bandSize;
      for (let j = 0; j < bandSize; j++) sum += buf[start + j];
      const avg = sum / bandSize / 255; // 0..1
      // mild curve for perceptual feel
      const v = Math.pow(avg, 0.7);
      const h = minH + v * (maxH - minH);
      bars[i].style.height = `${h}px`;
    }
    vizFrame = requestAnimationFrame(tick);
  };
  tick();
}

function stopVisualizer() {
  if (vizFrame) cancelAnimationFrame(vizFrame);
  vizFrame = null;
  if (sourceNode) { try { sourceNode.disconnect(); } catch {} sourceNode = null; }
  analyser = null;
  for (const b of bars) b.style.height = "";
}

async function startRecording() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    chunks = [];
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = handleStop;
    recorder.start();
    isRecording = true;
    setState("recording");
    startVisualizer();
  } catch {
    setState("error");
    setTimeout(() => setState("idle"), 2500);
  }
}

function stopRecording() {
  if (!recorder || !isRecording) return;
  recorder.stop();
  stream.getTracks().forEach((t) => t.stop());
  isRecording = false;
  stopVisualizer();
  setState("processing");
}

async function handleStop() {
  const blob = new Blob(chunks, { type: "audio/webm" });
  const form = new FormData();
  form.append("audio", blob, "rec.webm");
  form.append("model", modelSelect.value);

  try {
    const res = await fetch(`${BACKEND}/transcribe`, { method: "POST", body: form });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { text } = await res.json();
    if (text?.trim()) {
      await writeText(text.trim());
      await invoke("paste_text");
    }
  } catch (err) {
    console.error("Transcription error:", err);
  } finally {
    setState("idle");
  }
}

function toggle() {
  if (pill.classList.contains("processing")) return; // ignore clicks mid-transcribe
  if (isRecording) stopRecording();
  else startRecording();
}

// Hotkey (Ctrl+Space) from Rust
await listen("hotkey-pressed", toggle);

// Mic button click
document.getElementById("wave-btn").addEventListener("click", toggle);

setState("idle");
