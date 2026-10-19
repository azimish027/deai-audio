"""微瑕疵注入：音高 ±6 cents + 音量 ±1 dB + 时间微偏移 2-5ms，三者共享同一随机包络。"""
from __future__ import annotations

import numpy as np
from scipy.ndimage import gaussian_filter1d

from ..config.constants import (
    MICRO_PITCH_CENTS_MAX, MICRO_GAIN_DB_MAX, MICRO_NOISE_FLOOR_DBFS,
)


def _shared_envelope(n_samples: int, sr: int, sigma_hz: float = 0.2) -> np.ndarray:
    """生成 [-1, 1] 的慢速相干随机包络（高斯低通白噪声，sigma 对应 Hz）。"""
    # 时间常数：1/sigma_hz = 5s
    sigma_samples = sr / sigma_hz / 10  # 归一化
    noise = np.random.randn(n_samples).astype(np.float32)
    envelope = gaussian_filter1d(noise, sigma=sigma_samples)
    envelope /= (np.max(np.abs(envelope)) + 1e-12)
    return envelope.astype(np.float32)


def inject_micro_imperfections(audio: np.ndarray, sr: int,
                                scene_label: str = "monologue",
                                do_pitch: bool = True,
                                do_volume: bool = True,
                                do_time: bool = True) -> np.ndarray:
    out = audio.copy()
    n = len(out)

    # 生成一个共享包络
    h = _shared_envelope(n, sr, sigma_hz=0.2)

    # 1) 音量微起伏：全段施加 ±1dB
    if do_volume:
        gain_db = MICRO_GAIN_DB_MAX * h  # [-1, +1] dB
        gain_lin = 10 ** (gain_db / 20.0)
        if out.ndim == 1:
            out *= gain_lin
        else:
            for ch in range(out.shape[1]):
                out[:, ch] *= gain_lin

    # 2) 音高微扰（仅语音场景）：±6 cents
    if do_pitch and scene_label in ("monologue", "dialogue"):
        try:
            from .pitch_correct import pitch_correct_via_tdpsola
            # 音高包络需要平滑得更慢
            pitch_envelope = gaussian_filter1d(h, sigma=sr / 0.1 / 10)  # ~0.1Hz
            cents_per_sample = MICRO_PITCH_CENTS_MAX * pitch_envelope
            # 整段平均 shift 为零，只给一个微小的总偏移
            total_cents = float(np.mean(cents_per_sample))
            out = pitch_correct_via_tdpsola(out, sr, f0_shift_cents=total_cents)
        except Exception:
            pass

    # 3) 时间人性化（语音段 2–5ms，音乐段可放宽）
    if do_time:
        max_shift_ms = 4.0 if scene_label == "music" else 2.5
        time_envelope = gaussian_filter1d(h, sigma=sr / 0.15 / 10)
        shift_samples = np.round(
            time_envelope * max_shift_ms / 1000.0 * sr
        ).astype(int)
        out = _apply_time_shift(out, shift_samples)

    return out.astype(np.float32)


def _apply_time_shift(audio: np.ndarray, shifts: np.ndarray) -> np.ndarray:
    """逐样本微时间偏移（共享包络，不是独立随机抖动）。"""
    n = len(audio)
    if audio.ndim == 1:
        out = np.zeros_like(audio)
        for i in range(n):
            src = i - shifts[i]
            src = max(0, min(n - 1, src))
            out[i] = audio[src]
        return out.astype(np.float32)
    out = np.zeros_like(audio)
    for i in range(n):
        src = i - shifts[i]
        src = max(0, min(n - 1, src))
        out[i] = audio[src]
    return out.astype(np.float32)


def inject_floor_noise(audio: np.ndarray, sr: int, vad_flag: np.ndarray,
                        noise_dbfs: float = MICRO_NOISE_FLOOR_DBFS) -> np.ndarray:
    """只在静音帧注入 -60dBFS 粉噪。"""
    if vad_flag is None:
        return audio.copy()
    noise = _pink_noise(len(audio), sr)
    noise *= 10 ** (noise_dbfs / 20.0)
    # 只在 VAD=0 的帧注入
    gate = 1.0 - vad_flag.astype(np.float32)
    out = audio + noise * gate
    return out.astype(np.float32)


def _pink_noise(n: int, sr: int) -> np.ndarray:
    white = np.random.randn(n)
    b, a = _pink_filter(sr)
    from scipy.signal import lfilter
    pink = lfilter(b, a, white).astype(np.float32)
    pink /= np.max(np.abs(pink)) + 1e-9
    return pink * 0.1


def _pink_filter(sr: int):
    # 简单 1/f 滤波器
    freqs = np.fft.rfftfreq(1024, 1.0 / sr)
    freqs[0] = 1
    mag = 1.0 / np.sqrt(freqs)
    phase = np.exp(1j * 2 * np.pi * np.random.rand(len(freqs)))
    impulse = np.fft.irfft(mag * phase, n=1024)
    b = impulse[:32]
    a = np.array([1.0])
    return b, a
