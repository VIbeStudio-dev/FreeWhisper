from contextlib import asynccontextmanager
import logging
import os
import tempfile
from threading import Lock

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# Mapping from UI label → actual faster-whisper model id.
# "fast"    → small  (~500 MB int8)   ~3–4× faster than large-v3 on CPU
# "normal"  → large-v3 (~1.5 GB int8)  best accuracy
MODEL_MAP = {
    "fast": "small",
    "normal": "large-v3",
}

_models: dict[str, WhisperModel] = {}
_load_lock = Lock()


def get_model(key: str) -> WhisperModel:
    size = MODEL_MAP.get(key, "large-v3")
    with _load_lock:
        if size not in _models:
            log.info("Loading %s model (first use downloads weights)...", size)
            _models[size] = WhisperModel(size, device="cpu", compute_type="int8")
            log.info("%s ready.", size)
        return _models[size]


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Preload BOTH models so neither mode has a cold-start / download delay
    # on first use. Fast (~500 MB) loads first because it's smaller.
    log.info("Preloading fast + normal models (first run downloads ~2 GB total)...")
    get_model("fast")
    get_model("normal")
    log.info("All models ready.")
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "loaded": list(_models.keys())}


@app.post("/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    model: str = Form("normal"),
):
    data = await audio.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty audio payload")

    m = get_model(model)

    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name

    try:
        # Fast mode: smaller beam → noticeably lower latency.
        beam = 1 if model == "fast" else 5
        segments, info = m.transcribe(
            tmp_path,
            beam_size=beam,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 500},
        )
        text = " ".join(s.text.strip() for s in segments).strip()
        log.info("[%s] (%s) %s", model, info.language, text[:80])
        return {"text": text, "language": info.language, "model": model}
    finally:
        os.unlink(tmp_path)
