import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";

const BACKEND = "http://127.0.0.1:8000";

let recorder = null;
let chunks = [];
let stream = null;
let isRecording = false;

const pill = document.getElementById("pill");
const statusEl = document.getElementById("status");
const modelSelect = document.getElementById("model-select");

// Remember the user's choice across restarts
modelSelect.value = localStorage.getItem("bf_model") || "normal";
modelSelect.addEventListener("change", () => {
  localStorage.setItem("bf_model", modelSelect.value);
});

function setState(s) {
  pill.className = `pill ${s}`;
  statusEl.textContent = { idle: "Ready", recording: "Recording…", processing: "Transcribing…", error: "Error" }[s] ?? "Ready";
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
document.getElementById("mic-btn").addEventListener("click", toggle);

setState("idle");
