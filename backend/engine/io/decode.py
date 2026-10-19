"""解码层：ffmpeg 提取 → soundfile 读入 → 重采样到 48kHz float32。"""
from __future__ import annotations

import os
import subprocess
import tempfile
from typing import Tuple

import numpy as np
import soundfile as sf
import librosa

from ..session.session import Session
from ..config.constants import WORK_SR


def decode_to_wav48(session: Session) -> np.ndarray:
    """解码 source.path，返回 float32 numpy 数组（48kHz stereo_interleaved）。
    session.source 会被填入 original_sr / original_channels / duration_s。
    session.working 会被填入 wav / sr / layout。
    """
    src = session.source.path
    if not os.path.isfile(src):
        raise FileNotFoundError(src)

    # 用 ffmpeg 解码到 WAV 48kHz float32
    tmp_dir = session.tmp_dir or tempfile.mkdtemp(prefix="deai_decode_")
    out_path = os.path.join(tmp_dir, f"{session.session_id}_48k.wav")

    # 先探测原采样率和声道
    probe = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json",
         "-show_streams", "-select_streams", "a:0", src],
        capture_output=True, text=True, check=False,
    )
    import json
    info = json.loads(probe.stdout or "{}")
    streams = info.get("streams", [{}])
    st = streams[0] if streams else {}
    session.source.original_sr = int(st.get("sample_rate", 48000))
    session.source.original_channels = int(st.get("channels", 2))

    # ffmpeg 解码
    cmd = [
        "ffmpeg", "-y", "-i", src,
        "-ar", str(WORK_SR),          # 重采样到 48k
        "-ac", "2",                    # 统一双声道（后续 DSP 按双声道工作）
        "-f", "wav",
        out_path,
    ]
    subprocess.run(cmd, check=True, capture_output=True)

    data, sr = sf.read(out_path, dtype="float32")
    if data.ndim == 1:
        # 单声道复制成双声道，保证后续 DSP 按双声道处理
        data = np.column_stack([data, data])
    session.working["wav"] = data   # [n_samples, 2]
    session.working["sr"] = sr
    session.source.duration_s = len(data) / sr

    # 缓存路径
    session.tmp_dir = tmp_dir
    return data


def as_interleaved_float32(data: np.ndarray) -> np.ndarray:
    """将 [n, 2] float32 数组转成 interleaved 格式 [n*2] float32。"""
    if data.ndim == 1:
        return data.astype(np.float32)
    return data.T.astype(np.float32).ravel(order="C")
