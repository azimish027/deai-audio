"""立体声相位相干性。"""
from __future__ import annotations

import numpy as np


def compute_stereo_phase_coherence(audio: np.ndarray, sr: int,
                                    frame_len: int = 2048, hop: int = 512) -> float:
    """多声部/音乐：真实录音有自然相位色散（Haas），
    生成模型常产生"伪立体声扩散塌缩" → 相干性异常。
    单声道输入直接返回 0.0。
    """
    if audio.ndim == 1 or audio.shape[1] < 2:
        return 0.0

    n_frames = max(1, (len(audio) - frame_len) // hop + 1)
    coherences = []

    for i in range(n_frames):
        seg_l = audio[i * hop:i * hop + frame_len, 0]
        seg_r = audio[i * hop:i * hop + frame_len, 1]
        if np.max(np.abs(seg_l)) < 1e-6 or np.max(np.abs(seg_r)) < 1e-6:
            continue
        spec_l = np.fft.rfft(seg_l * np.hanning(len(seg_l)))
        spec_r = np.fft.rfft(seg_r * np.hanning(len(seg_r)))
        # 相干性：|Σ S_l * conj(S_r)| / sqrt(Σ|S_l|² * Σ|S_r|²)
        numerator = np.abs(np.sum(spec_l * np.conj(spec_r)))
        denominator = np.sqrt(np.sum(np.abs(spec_l) ** 2) * np.sum(np.abs(spec_r) ** 2)) + 1e-12
        coherences.append(numerator / denominator)

    return float(np.median(coherences)) if coherences else 0.0
