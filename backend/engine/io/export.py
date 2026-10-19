"""导出层：WAV / M4A / MP3。"""
from __future__ import annotations

import os
import subprocess
from typing import Optional

import numpy as np
import soundfile as sf

from ..session.session import Session
from ..config.constants import (
    WORK_SR, TRUE_PEAK_LIMIT_DBTP, TRUE_PEAK_LIMIT_WAV_DBTP,
)


def export_all(session: Session, out_dir: str) -> None:
    """按 session.template_id 导出 WAV / M4A / MP3。"""
    os.makedirs(out_dir, exist_ok=True)
    wav_path = os.path.join(out_dir, f"{session.session_id}_out.wav")
    m4a_path = os.path.join(out_dir, f"{session.session_id}_out.m4a")
    mp3_path = os.path.join(out_dir, f"{session.session_id}_out.mp3")

    data = session.working["wav"]  # [n, 2] float32

    # WAV 先写
    sf.write(wav_path, data, WORK_SR, subtype="PCM_24")
    session.exports.wav = wav_path

    # M4A (AAC) — 需要留更多 TP 余量给编码过冲
    _encode_via_ffmpeg(wav_path, m4a_path, ["-c:a", "aac", "-b:a", "256k"])
    session.exports.m4a = m4a_path

    # MP3
    _encode_via_ffmpeg(wav_path, mp3_path, ["-c:a", "libmp3lame", "-b:a", "320k"])
    session.exports.mp3 = mp3_path


def _encode_via_ffmpeg(in_wav: str, out_path: str, extra_args: list) -> None:
    cmd = ["ffmpeg", "-y", "-i", in_wav] + extra_args + [out_path]
    subprocess.run(cmd, check=True, capture_output=True)
