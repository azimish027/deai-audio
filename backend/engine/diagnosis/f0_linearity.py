"""音高线性度：一阶差分零值比例 + 二阶差分符号一致性 → [0,1]。"""
from __future__ import annotations

import numpy as np


def compute_f0_linearity(f0: np.ndarray) -> float:
    """f0 需要是 voicing mask 过滤后的有效值序列（去掉 0 和 NaN）。"""
    voiced = f0[np.isfinite(f0) & (f0 > 0)]
    if len(voiced) < 10:
        return 0.0

    d1 = np.diff(voiced)
    d2 = np.diff(d1)

    # 一阶差分零值比例——越高代表 pitch 完全量化（合成感）
    zero_ratio = float(np.mean(np.abs(d1) < 1e-3))

    # 二阶差分符号一致性——越高代表 pitch 是单调/阶梯式（合成特征）
    sign_consistency = float(np.mean(np.sign(d2) != 0)) if len(d2) > 0 else 0.0
    # 符号基本保持一致才是问题，所以直接取符号方差小的情况
    sign_var = float(np.var(np.sign(d2))) if len(d2) > 0 else 1.0
    consistency_score = 1.0 - np.clip(sign_var, 0, 1)

    score = np.clip(0.5 * zero_ratio + 0.5 * consistency_score, 0, 1)
    return float(score)


def compute_f0_consistency(f0: np.ndarray) -> float:
    """f0 一致性：在滑动窗口内的相对方差倒数。
    真实人声的 f0 有自然颤音（~3-6 Hz 速率，±2-6 cents 深度），
    完全不波动或波动是机械模式 → 低一致性。
    """
    voiced = f0[np.isfinite(f0) & (f0 > 0)]
    if len(voiced) < 10:
        return 0.0

    # 转成 cents 相对中值
    median_f0 = np.median(voiced)
    cents = 1200 * np.log2(voiced / (median_f0 + 1e-12))

    # 滑动窗口 100ms 看方差（假设 hop=10ms → 10 帧）
    window = 10
    variances = []
    for i in range(window, len(cents)):
        seg = cents[i - window:i]
        variances.append(np.var(seg))

    if not variances:
        return 0.0

    mean_var = float(np.mean(variances))
    # 经验：自然人声的窗口方差在 4-20 cents²，合成的 < 1 或 > 40
    # 映射为 [0,1]，在 8 cents² 左右达到峰值
    score = np.exp(-((mean_var - 8) ** 2) / (2 * 100))
    return float(np.clip(score, 0, 1))
