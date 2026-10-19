"""棋盘伪影检测：优先 orbit-forensics（倒谱 cepstral_peak_ratio），
不可用时回退到自实现。
"""
from __future__ import annotations

import numpy as np


def compute_checkerboard_ratio(audio: np.ndarray, sr: int) -> float:
    mono = audio if audio.ndim == 1 else audio.mean(axis=1)
    mono = mono.astype(np.float32)

    try:
        from orbit_forensics.audio_forensics import measure_checkerboard_artifacts
        result = measure_checkerboard_artifacts(mono, sr=sr)
        val = result.get("cepstral_peak_ratio")
        if val is not None and np.isfinite(val):
            return float(val)
    except Exception:
        pass

    return _checkerboard_fallback(mono.astype(np.float64))


def _checkerboard_fallback(mono: np.ndarray,
                           frame_len: int = 2048, hop: int = 512) -> float:
    n_frames = max(1, (len(mono) - frame_len) // hop + 1)
    ratios = []

    for i in range(min(n_frames, 200)):
        seg = mono[i * hop:i * hop + frame_len]
        if np.max(np.abs(seg)) < 1e-6:
            continue
        spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) + 1e-9
        log_spec = np.log(spec)
        full_log = np.concatenate([log_spec, log_spec[-2:0:-1]])
        cepstrum = np.real(np.fft.ifft(full_log))[:len(seg) // 2]
        if len(cepstrum) < 6:
            continue
        cepstrum = cepstrum[5:]
        mean_val = np.mean(np.abs(cepstrum)) + 1e-9
        max_val = np.max(np.abs(cepstrum))
        ratios.append(max_val / mean_val)

    return float(np.median(ratios)) if ratios else 0.0
