"""削波修复：DCT 域 L1 稀疏优化 + declip 后峰值归位。"""
from __future__ import annotations

import numpy as np
from scipy.fft import dct, idct
from scipy.optimize import minimize

from ..config.constants import DECLIP_THRESHOLD


def declip_sparse(audio: np.ndarray, sr: int,
                   window_ms: float = 40.0,
                   max_iters: int = 50) -> np.ndarray:
    """逐帧做 DCT + L1 正则稀疏重建，修复削波段。
    返回修复后的音频（削波段已重建，非削波段保持原信号）。
    """
    if audio.ndim == 1:
        return _declip_mono(audio, sr, window_ms, max_iters)
    out = np.copy(audio)
    for ch in range(audio.shape[1]):
        out[:, ch] = _declip_mono(audio[:, ch], sr, window_ms, max_iters)
    return out.astype(np.float32)


def _declip_mono(mono: np.ndarray, sr: int,
                 window_ms: float, max_iters: int) -> np.ndarray:
    window = int(sr * window_ms / 1000)
    hop = window // 2
    n = len(mono)
    out = mono.copy()

    # 标记削波样本（超过阈值且接近峰值）
    over = np.abs(mono) > DECLIP_THRESHOLD

    for i in range(0, n - window, hop):
        seg = mono[i:i + window]
        mask = over[i:i + window]

        if not mask.any():
            continue  # 该帧无削波，跳过

        # 将削波样本当作"不可见"，其他作为已知
        known_mask = ~mask

        def objective(x):
            # DCT 系数 → 重建 → 已知段应匹配，同时 DCT 系数 L1 稀疏
            coeffs = dct(x, type=2, norm="ortho")
            recon = idct(coeffs, type=2, norm="ortho")
            known_err = np.sum((recon[known_mask] - seg[known_mask]) ** 2)
            l1 = np.sum(np.abs(coeffs))
            return known_err + 1e-5 * l1

        x0 = seg.copy()
        try:
            result = minimize(
                objective, x0, method="L-BFGS-B",
                options={"maxiter": max_iters, "disp": False},
            )
            if result.success or result.fun < objective(seg):
                recon = idct(dct(result.x, type=2, norm="ortho"), type=2, norm="ortho")
                # 只替换削波段的部分
                out[i:i + window] = np.where(mask, recon, out[i:i + window])
        except Exception:
            continue

    # 削波修复可能超出原峰值范围，归位到 -1 dBFS 以下
    peak = np.max(np.abs(out))
    if peak > DECLIP_THRESHOLD:
        out = out * (DECLIP_THRESHOLD / peak) * 0.99

    return out.astype(np.float32)
