"""音高修正 + 共振峰保留（TD-PSOLA / pytsmod）。"""
from __future__ import annotations

import numpy as np
import librosa


def pitch_correct_via_tdpsola(audio: np.ndarray, sr: int,
                               f0_shift_cents: float = 0.0,
                               enable: bool = True) -> np.ndarray:
    """f0_shift_cents: 正 = 升调，负 = 降调。enable=False 时原样返回。
    TD-PSOLA 天然保留共振峰位置。
    """
    if not enable or abs(f0_shift_cents) < 0.1:
        return audio.copy()

    try:
        import pytsmod as tsm
    except ImportError:
        return audio.copy()

    if audio.ndim == 1:
        return _shift_mono(audio, sr, f0_shift_cents, tsm)
    out = np.copy(audio)
    for ch in range(audio.shape[1]):
        out[:, ch] = _shift_mono(audio[:, ch], sr, f0_shift_cents, tsm)
    return out.astype(np.float32)


def _shift_mono(mono: np.ndarray, sr: int, cents: float, tsm_module) -> np.ndarray:
    # 目标 F0 缩放
    alpha = 2 ** (cents / 1200.0)

    try:
        # librosa.pyin 跟踪 F0
        f0, voiced, _ = librosa.pyin(
            mono, sr=sr, fmin=librosa.note_to_hz("C2"),
            fmax=librosa.note_to_hz("C7"), center=False,
        )
        # 只对 voicing 的帧做修正
        target_f0 = np.where(voiced, f0 * alpha, f0)

        p_hop = 441 if sr == 44100 else sr // 100
        p_win = p_hop * 4

        result = tsm_module.tdpsola(
            mono, sr, src_f0=f0, tgt_f0=target_f0,
            p_hop_size=p_hop, p_win_size=p_win,
        )
        # 对齐长度
        if len(result) >= len(mono):
            result = result[:len(mono)]
        else:
            result = np.pad(result, (0, len(mono) - len(result)))
        return result.astype(np.float32)
    except Exception:
        return mono.copy()
