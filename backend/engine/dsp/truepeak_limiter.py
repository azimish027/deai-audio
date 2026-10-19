"""4 倍过采样真峰值检测 + look-ahead 平滑包络限幅。"""
from __future__ import annotations

import numpy as np
from scipy.signal import resample_poly


def compute_true_peak(audio: np.ndarray, up_factor: int = 4) -> float:
    """对 audio 做 4 倍过采样，取最大绝对值。"""
    if audio.ndim == 1:
        up = resample_poly(audio, up_factor, 1)
        return float(np.max(np.abs(up)))
    peaks = []
    for ch in range(audio.shape[1]):
        up = resample_poly(audio[:, ch], up_factor, 1)
        peaks.append(float(np.max(np.abs(up))))
    return max(peaks)


def truepeak_limit(audio: np.ndarray, sr: int,
                    limit_dbfs: float = -1.5,
                    lookahead_ms: float = 5.0,
                    up_factor: int = 4) -> np.ndarray:
    """真峰值限幅：检测 → 平滑包络 → 增益衰减。"""
    limit_lin = 10 ** (limit_dbfs / 20.0)

    if audio.ndim == 1:
        return _limit_mono(audio, sr, limit_lin, lookahead_ms, up_factor)

    out = np.copy(audio)
    for ch in range(audio.shape[1]):
        out[:, ch] = _limit_mono(audio[:, ch], sr, limit_lin, lookahead_ms, up_factor)
    return out.astype(np.float32)


def _limit_mono(mono: np.ndarray, sr: int, limit_lin: float,
                 lookahead_ms: float, up_factor: int) -> np.ndarray:
    # 4 倍过采样
    up = resample_poly(mono, up_factor, 1)
    n_up = len(up)

    # look-ahead 窗口（以过采样样本计）
    lookahead_samps = int(lookahead_ms / 1000.0 * sr * up_factor)

    # 向前看的峰值包络
    peak_env = np.zeros(n_up)
    for i in range(n_up):
        end = min(n_up, i + lookahead_samps)
        peak_env[i] = np.max(np.abs(up[i:end]))

    # 计算增益：峰值超过 limit 的地方才衰减
    gain = np.minimum(1.0, limit_lin / (peak_env + 1e-12))

    # 增益平滑（避免瞬态切换失真）
    alpha = 1.0 - np.exp(-1.0 / (sr * up_factor * 0.001))
    smoothed = np.zeros_like(gain)
    smoothed[0] = gain[0]
    for i in range(1, len(gain)):
        if gain[i] < smoothed[i - 1]:
            smoothed[i] = gain[i]  # 下降快
        else:
            smoothed[i] = smoothed[i - 1] + alpha * (gain[i] - smoothed[i - 1])  # 上升慢

    out_up = up * smoothed
    # 回到原始采样率
    out = resample_poly(out_up, 1, up_factor)[:len(mono)]
    # 对齐长度
    if len(out) < len(mono):
        out = np.pad(out, (0, len(mono) - len(out)))
    return out.astype(np.float32)
