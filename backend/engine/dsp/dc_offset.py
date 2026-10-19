"""DC offset 去除：减去每声道均值（均值 > 阈值才触发）。"""
from __future__ import annotations

import numpy as np

from ..config.constants import DC_OFFSET_THRESHOLD


def remove_dc_offset(audio: np.ndarray) -> np.ndarray:
    """audio: [n_samples] or [n_samples, 2]，float32。"""
    if np.abs(np.mean(audio)) <= DC_OFFSET_THRESHOLD:
        return audio.copy()
    if audio.ndim == 1:
        return (audio - np.mean(audio)).astype(np.float32)
    out = np.copy(audio)
    for ch in range(audio.shape[1]):
        m = np.mean(audio[:, ch])
        if np.abs(m) > DC_OFFSET_THRESHOLD:
            out[:, ch] -= m
    return out.astype(np.float32)
