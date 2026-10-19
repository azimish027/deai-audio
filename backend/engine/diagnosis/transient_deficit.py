"""瞬态亏损：快/慢包络差的 95 百分位 - 目标瞬态值。"""
from __future__ import annotations

import numpy as np

from ..config.constants import (
    TRANSIENT_FAST_ATTACK_MS, TRANSIENT_FAST_RELEASE_MS,
    TRANSIENT_SLOW_ATTACK_MS, TRANSIENT_SLOW_RELEASE_MS,
)


def _envelope(audio: np.ndarray, sr: int, attack_ms: float, release_ms: float) -> np.ndarray:
    """指数包络跟踪器（dB 域）。"""
    alpha_a = 1.0 - np.exp(-1.0 / (sr * attack_ms / 1000.0 + 1e-9))
    alpha_r = 1.0 - np.exp(-1.0 / (sr * release_ms / 1000.0 + 1e-9))
    mono = audio if audio.ndim == 1 else audio.mean(axis=1)
    level = np.maximum(np.abs(mono), 1e-9)
    env = np.zeros_like(level)
    env[0] = level[0]
    for i in range(1, len(level)):
        if level[i] > env[i - 1]:
            env[i] = env[i - 1] + alpha_a * (level[i] - env[i - 1])
        else:
            env[i] = env[i - 1] + alpha_r * (level[i] - env[i - 1])
    return env


def compute_transient_deficit(audio: np.ndarray, sr: int,
                               target_transient_db: float = 12.0) -> tuple[float, float]:
    """返回 (transient_deficit_db, peak_transient_db)。"""
    fast_env = _envelope(audio, sr, TRANSIENT_FAST_ATTACK_MS, TRANSIENT_FAST_RELEASE_MS)
    slow_env = _envelope(audio, sr, TRANSIENT_SLOW_ATTACK_MS, TRANSIENT_SLOW_RELEASE_MS)

    fast_db = 20 * np.log10(fast_env + 1e-12)
    slow_db = 20 * np.log10(slow_env + 1e-12)
    transient_activity = fast_db - slow_db

    peak = float(np.percentile(transient_activity, 95))
    deficit = float(target_transient_db - peak)
    return deficit, peak
