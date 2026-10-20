"""FastAPI HTTP 桥接层：Electron 前端通过 HTTP 调用后端。"""
from __future__ import annotations

import os
import tempfile
import traceback
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from ..orchestration.pipeline import Pipeline
from ..session.session import PipelineState


app = FastAPI(title="DeAI Audio Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_pipelines: dict[str, Pipeline] = {}


class ProcessRequest(BaseModel):
    template_id: str = "studio_vocal"
    keep_audio: bool = False


class SessionInfo(BaseModel):
    session_id: str
    state: str
    template_id: str
    diagnosis: dict
    segments: list
    exports: dict
    measurements: dict = {}   # 新增：before/after/steps/lufs_target/true_peak_limit


@app.post("/process", response_model=SessionInfo)
async def process_audio(file: UploadFile = File(...),
                        template_id: str = "studio_vocal") -> SessionInfo:
    """上传音频文件，跑完整链，返回 SessionInfo。"""
    tmp_dir = tempfile.mkdtemp(prefix="deai_upload_")
    in_path = os.path.join(tmp_dir, file.filename or "input.wav")
    with open(in_path, "wb") as f:
        f.write(await file.read())

    try:
        p = Pipeline(tmp_dir=tmp_dir)
        sess = p.run(in_path, template_id=template_id)
        _pipelines[sess.session_id] = p
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

    return SessionInfo(
        session_id=sess.session_id,
        state=sess.state.value,
        template_id=sess.template_id,
        diagnosis={
            "phase_entropy": sess.diagnosis.mechanical_signature.phase_entropy,
            "transient_deficit_db": sess.diagnosis.mechanical_signature.transient_deficit_db,
            "dominant_damage_type": sess.diagnosis.dominant_damage_type.value,
            "clipping_detected": sess.diagnosis.clipping.detected,
            "hnr_db": sess.diagnosis.mechanical_signature.hnr_db,
            "checkerboard_ratio": sess.diagnosis.mechanical_signature.checkerboard_ratio,
            "stereo_phase_coherence": sess.diagnosis.mechanical_signature.stereo_phase_coherence,
        },
        segments=sess.to_dict()["segments"],
        exports={k: v for k, v in sess.exports.__dict__.items() if v},
        measurements=getattr(sess, "measurements", {}),
    )


@app.get("/session/{session_id}/waveform")
async def get_waveform(session_id: str):
    """返回处理后 WAV —— WaveSurfer 直接 load 即可渲波形。"""
    p = _pipelines.get(session_id)
    if not p: raise HTTPException(status_code=404, detail="session not found")
    wav_path = os.path.join(p._tmp_dir, "exports", f"{session_id}_out.wav")
    if not os.path.exists(wav_path): raise HTTPException(status_code=404, detail="exports not ready")
    return FileResponse(wav_path, media_type="audio/wav", filename=f"{session_id}_processed.wav")


@app.get("/export/{session_id}/{format}")
async def download_export(session_id: str, format: str):
    """下载处理后导出文件。format ∈ {wav, m4a, mp3}。"""
    p = _pipelines.get(session_id)
    if not p: raise HTTPException(status_code=404, detail="session not found")
    fmt = format.lower()
    ext_map = {"wav": ".wav", "m4a": ".m4a", "mp3": ".mp3"}
    if fmt not in ext_map: raise HTTPException(status_code=400, detail=f"unsupported format {format}")
    path = os.path.join(p._tmp_dir, "exports", f"{session_id}_out{ext_map[fmt]}")
    if not os.path.exists(path): raise HTTPException(status_code=404, detail=f"{format} not ready at {path}")
    media_map = {"wav": "audio/wav", "m4a": "audio/mp4", "mp3": "audio/mpeg"}
    return FileResponse(path, media_type=media_map[fmt], filename=f"{session_id}_processed.{fmt}")


@app.get("/templates")
async def list_templates():
    from ..config.constants import TEMPLATES, TEMPLATE_NAMES_ZH
    out = []
    for tid, params in TEMPLATES.items():
        out.append({
            "id": tid,
            "name_zh": TEMPLATE_NAMES_ZH.get(tid, tid),
            "params": params,
        })
    return {"templates": out}


# ============================================================
# 拆解台
# ============================================================

@app.post("/analyze")
async def analyze_reference(file: UploadFile = File(...)):
    """上传参考歌，跑拆解台全链（MVP：BPM/key/结构/chord/生产笔记）。"""
    from ..reference import analyze_reference
    tmp_dir = tempfile.mkdtemp(prefix="deai_ref_")
    in_path = os.path.join(tmp_dir, file.filename or "reference.wav")
    with open(in_path, "wb") as f:
        f.write(await file.read())
    try:
        r = analyze_reference(in_path)
        return {
            "id": r.id,
            "bpm": r.bpm,
            "key": r.key,
            "mode": r.mode,
            "time_signature": r.time_signature,
            "duration_s": r.duration_s,
            "structure": r.structure,
            "chords": r.chords,
            "production_notes": r.production_notes,
            "recipe": None,   # 后续接 recipe_build
            "confidence": r.confidence,
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/recipe/build/{analysis_id}")
async def build_recipe(analysis_id: str):
    """从 ReferenceAnalysis 提取配方（MVP 占位）。"""
    return {"id": f"recipe_{analysis_id}", "name": "配方占位", "tags": []}


@app.get("/health")
async def health():
    return {"ok": True, "service": "deai-audio-backend"}
