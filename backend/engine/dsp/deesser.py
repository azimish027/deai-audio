"""动态去齿音：窄带（250Hz 至 1/6~1又2/3倍频程）检测 + 2–4dB 增益降低。"""
from __future__ import annotations

import numpy as np
from scipy.signal import butter, sosfilt


def deesser(audio: np.ndarray, sr: int, level: str = "light") -> np.ndarray:
    """level: "off" | "light" | "medium"。
    齿音能量集中在 4–10kHz，检测到过载帧才介入，不是宽带静态衰减。
    """
    if level == "off":
        return audio.copy()

    strength_map = {"light": 0.5, "medium": 1.0}
    strength = strength_map.get(level, 0.5)
    max_reduction_db = 4.0 if level == "medium" else 2.5

    if audio.ndim == 1:
        return _deesser_mono(audio, sr, strength, max_reduction_db)
    out = np.copy(audio)
    for ch in range(audio.shape[1]):
        out[:, ch] = _deesser_mono(audio[:, ch], sr, strength, max_reduction_db)
    return out.astype(np.float32)


def _deesser_mono(mono: np.ndarray, sr: int, strength: float,
                   max_db: float) -> np.ndarray:
    # 窄带带通滤波：5-9kHz（男性约 5-6k，女性 7-8k）
    low = 5000.0
    high = 9000.0
    sos = butter(4, [low / (sr / 2), high / (sr / 2)], btype="bandpass", output="sos")
    band = sosfilt(sos, mono)

    # 帧级能量包络（20ms 帧）
    frame = int(sr * 0.02)
    hop = frame // 2
    n_frames = max(1, (len(mono) - frame) // hop + 1)

    env = np.zeros(n_frames)
    for i in range(n_frames):
        seg = band[i * hop:i * hop + frame]
        env[i] = np.sqrt(np.mean(seg ** 2)) + 1e-12

    # 归一化 + 阈值：超过 1.5x 全段均值 → 齿音
    mean_env = np.mean(env)
    threshold = mean_env * 1.5
    mask = env > threshold

    # 构造帧级增益（dB 衰减），限制上限
    gain_db = np.zeros(n_frames)
    gain_db[mask] = -strength * max_db * np.clip(
        (env[mask] - mean_env) / (threshold - mean_env + 1e-12), 0, 1
    )

    # 帧级增益 → 逐样本平滑增益
    smooth = np.interp(
        np.linspace(0, len(mono), len(mono), endpoint=False),
        np.linspace(0, len(mono), n_frames, endpoint=False),
        gain_db,
    )
    smooth = np.clip(smooth, -max_db, 0)
    gain_lin = 10 ** (smooth / 20.0)

    return (mono * gain_lin).astype(np.float32)
