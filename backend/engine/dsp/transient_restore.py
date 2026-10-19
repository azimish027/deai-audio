"""瞬态同步动态恢复：快慢包络差驱动的向上扩展（结构性上限）。"""
from __future__ import annotations

import numpy as np

from ..diagnosis.transient_deficit import _envelope as compute_envelope


def transient_restore(audio: np.ndarray, sr: int,
                       target_transient_db: float = 10.0,
                       max_restore_db: float = 4.0) -> np.ndarray:
    """仅在检测到瞬态亏损的帧上向上扩展，恢复被压扁的瞬态。
    增益由"实测瞬态度 vs 目标瞬态度"决定，而非用户激进参数。
    """
    if audio.ndim == 1:
        return _restore_mono(audio, sr, target_transient_db, max_restore_db)
    out = np.copy(audio)
    for ch in range(audio.shape[1]):
        out[:, ch] = _restore_mono(audio[:, ch], sr, target_transient_db, max_restore_db)
    return out.astype(np.float32)


def _restore_mono(mono: np.ndarray, sr: int,
                  target_db: float, max_db: float) -> np.ndarray:
    fast_env = compute_envelope(mono, sr, 0.5, 20.0)
    slow_env = compute_envelope(mono, sr, 20.0, 200.0)

    fast_db = 20 * np.log10(fast_env + 1e-12)
    slow_db = 20 * np.log10(slow_env + 1e-12)
    transient_activity = fast_db - slow_db  # 快慢包络差

    # 逐样本增益：只在 transient_activity > 3dB 的样本上施加强化
    threshold_db = 3.0
    deficit = target_db - transient_activity  # 正值表示需要补
    deficit = np.clip(deficit, 0, max_db)
    # 低于阈值的瞬态不恢复
    deficit = np.where(transient_activity > threshold_db, deficit, 0.0)

    # 增益平滑（attack 不快于 2ms，release 不慢于 80ms）
    alpha_a = 1.0 - np.exp(-1.0 / (sr * 0.002))
    alpha_r = 1.0 - np.exp(-1.0 / (sr * 0.08))
    gain_smooth = np.zeros_like(deficit)
    gain_smooth[0] = deficit[0]
    for i in range(1, len(deficit)):
        if deficit[i] > gain_smooth[i - 1]:
            gain_smooth[i] = gain_smooth[i - 1] + alpha_a * (deficit[i] - gain_smooth[i - 1])
        else:
            gain_smooth[i] = gain_smooth[i - 1] + alpha_r * (deficit[i] - gain_smooth[i - 1])

    gain_lin = 10 ** (gain_smooth / 20.0)
    return (mono * gain_lin).astype(np.float32)
