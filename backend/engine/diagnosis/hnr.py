"""HNR：优先 praat-parselmouth 的 Cross-Correlation HNR（工业标准），
不可用时回退到自实现的频谱谐波度估计。
"""
from __future__ import annotations

import numpy as np


def compute_hnr(audio: np.ndarray, sr: int,
                fallback_from_f0: np.ndarray | None = None) -> float:
    """返回 HNR 均值（dB）。"""
    mono = audio if audio.ndim == 1 else audio.mean(axis=1)

    # 优先 praat-parselmouth
    try:
        import parselmouth
        snd = parselmouth.Sound(mono.astype(np.float64), sampling_frequency=sr)
        hnr_obj = snd.to_harmonicity_cc(time_step=0.01)
        vals = hnr_obj.values[np.isfinite(hnr_obj.values)]
        if len(vals) > 0:
            return float(np.clip(np.mean(vals), -40, 60))
    except Exception:
        pass

    # 回退：基于 librosa f0 的频谱谐波度估计
    return _hnr_from_f0(mono, sr, fallback_from_f0)


def _hnr_from_f0(mono: np.ndarray, sr: int, f0: np.ndarray | None) -> float:
    import librosa
    try:
        if f0 is None:
            f0, voicing, _ = librosa.pyin(
                mono, sr=sr, fmin=librosa.note_to_hz("C2"),
                fmax=librosa.note_to_hz("C7"), center=False,
            )
        else:
            voicing = f0 > 0
    except Exception:
        return 0.0

    frame_len = int(sr * 0.025)
    hop = frame_len // 2
    hnrs = []
    for i in range(len(f0)):
        if not voicing[i]:
            continue
        start = i * hop
        seg = mono[start:start + frame_len]
        if len(seg) < frame_len:
            continue
        f_val = f0[i]
        if not np.isfinite(f_val) or f_val <= 0:
            continue
        spectrum = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2
        freqs = np.fft.rfftfreq(len(seg), d=1.0 / sr)
        harmonic_energy = 0.0
        for k in range(1, 16):
            target = f_val * k
            idx = np.argmin(np.abs(freqs - target))
            bw = f_val * 0.3
            band = np.abs(freqs - target) <= bw
            harmonic_energy += spectrum[band].sum()
        total = spectrum.sum() + 1e-12
        noise = total - harmonic_energy + 1e-12
        hnrs.append(np.clip(10 * np.log10((harmonic_energy + 1e-12) / noise), -40, 60))

    return float(np.mean(hnrs)) if hnrs else 0.0
