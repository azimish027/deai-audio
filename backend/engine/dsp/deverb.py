"""去混响：频带谐波度驱动的衰减（不走独立 DNN）。"""
from __future__ import annotations

import numpy as np


def apply_deverb(audio: np.ndarray, sr: int, wet_retention: float = 0.20) -> np.ndarray:
    """直达/混响比包络检测 → 频带相关增益衰减。
    低频（<200Hz）保留更多湿声，中高频（2–8kHz）对混响尾巴衰减。
    wet_retention ∈ [0.1, 0.5]：越小去混响越激进。
    """
    if audio.ndim == 1:
        return _deverb_mono(audio, sr, wet_retention)
    out = np.copy(audio)
    for ch in range(audio.shape[1]):
        out[:, ch] = _deverb_mono(audio[:, ch], sr, wet_retention)
    return out.astype(np.float32)


def _deverb_mono(mono: np.ndarray, sr: int, wet_retention: float) -> np.ndarray:
    frame_len = int(sr * 40 / 1000)  # 40ms
    hop = frame_len // 2

    # 频带划分
    low_end = int(200 / (sr / 2) * frame_len)   # <200Hz 保留
    mid_start = int(2000 / (sr / 2) * frame_len)
    mid_end = int(8000 / (sr / 2) * frame_len)  # 2-8kHz 对混响衰减

    out_frames = []
    n_frames = max(1, (len(mono) - frame_len) // hop + 1)

    for i in range(n_frames):
        seg = mono[i * hop:i * hop + frame_len]
        if len(seg) < frame_len:
            seg = np.pad(seg, (0, frame_len - len(seg)))

        spec = np.fft.rfft(seg * np.hanning(frame_len))
        mag = np.abs(spec)

        # 谐波度：该帧能量在谐波峰值附近 vs. 漫散部分的比值
        harmonic_energy = 0.0
        total_energy = mag.sum() + 1e-12
        # 简化：频带平坦度低 → 谐波度高（语音/音符 vs 混响尾巴）
        flatness = np.exp(np.mean(np.log(mag + 1e-12))) / (np.mean(mag) + 1e-12)
        harmonicity = 1.0 - np.clip(flatness, 0, 1)

        # 逐频带增益
        band_gain = np.ones_like(mag)
        # 中频混响衰减
        if mid_start < len(band_gain) and mid_end < len(band_gain):
            # 混响尾巴 → harmonicity 低 → 衰减多
            damp = wet_retention + (1 - wet_retention) * harmonicity
            damp = np.clip(damp, wet_retention, 1.0)
            band_gain[mid_start:mid_end] *= damp

        # 低频保留（房间模态）
        band_gain[:low_end] *= 1.0  # 不变

        out_mag = mag * band_gain
        out_spec = out_mag * np.exp(1j * np.angle(spec))
        out_seg = np.fft.irfft(out_spec, n=frame_len) * np.hanning(frame_len).sum() / 2
        out_frames.append(out_seg)

    # 重叠加法还原
    out = np.zeros(len(mono))
    win_sum = np.zeros(len(mono))
    window = np.hanning(frame_len)
    for i, frame in enumerate(out_frames):
        start = i * hop
        out[start:start + frame_len] += frame * window
        win_sum[start:start + frame_len] += window ** 2

    win_sum = np.maximum(win_sum, 1e-9)
    out /= win_sum
    return out[:len(mono)].astype(np.float32)
