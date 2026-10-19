"""相位熵：优先 orbit-forensics 的 Hilbert 瞬时频率 + Shannon 熵（经过法证研究验证），
不可用时回退到自实现。
"""
from __future__ import annotations

import numpy as np


def compute_phase_entropy(audio: np.ndarray, sr: int) -> float:
    """返回归一化相位熵 [0,1]。"""
    mono = audio if audio.ndim == 1 else audio.mean(axis=1)
    mono = mono.astype(np.float32)

    # 优先 orbit-forensics
    try:
        from orbit_forensics.audio_forensics import measure_phase_entropy
        result = measure_phase_entropy(mono, sr=sr)
        ne = result.get("normalized_entropy")
        if ne is not None and np.isfinite(ne):
            return float(np.clip(ne, 0.0, 1.0))
    except Exception:
        pass

    return _phase_entropy_fallback(mono, sr)


def _phase_entropy_fallback(mono: np.ndarray, sr: int,
                            frame_ms: float = 40.0, bins: int = 64) -> float:
    from scipy.signal import hilbert
    frame_len = int(sr * frame_ms / 1000)
    hop = frame_len // 2
    n_frames = max(1, (len(mono) - frame_len) // hop + 1)
    entropies = []
    max_entropy = np.log2(bins)

    for i in range(n_frames):
        seg = mono[i * hop:i * hop + frame_len]
        if len(seg) < 8 or np.max(np.abs(seg)) < 1e-6:
            continue
        analytic = hilbert(seg.astype(np.float64))
        inst_freq = np.diff(np.unwrap(np.angle(analytic))) / (2 * np.pi) * sr
        inst_freq = np.clip(inst_freq, 0, sr / 2)
        hist, _ = np.histogram(inst_freq, bins=bins, range=(0, sr / 2), density=True)
        hist = hist[hist > 0]
        if len(hist) < 2:
            continue
        p = hist / hist.sum()
        entropies.append(-np.sum(p * np.log2(p)) / max_entropy)

    return float(np.median(entropies)) if entropies else 0.0
