"""双遍 EBU R128 标准化 + LRA 测量。"""
from __future__ import annotations

import numpy as np
import pyloudnorm as pyln

from ..config.constants import IL_TARGET_SPEECH, IL_TARGET_SHORT_VIDEO


def loudness_normalize(audio: np.ndarray, sr: int,
                        target_lufs: float = IL_TARGET_SPEECH,
                        measure_lra: bool = True) -> tuple[np.ndarray, float, float]:
    """返回 (normalized_audio, measured_il, measured_lra)。
    只做线性增益，不做动态压缩。
    """
    meter = pyln.Meter(sr)

    # 第一遍：测量
    if audio.ndim == 1:
        mono_meter = pyln.Meter(sr)
        # pyloudnorm 接受 [n, n_channels]
        measure_in = audio[:, None]
    else:
        measure_in = audio

    try:
        measured_il = float(meter.integrated_loudness(measure_in))
    except Exception:
        measured_il = -18.0

    measured_lra = 0.0
    if measure_lra:
        try:
            measured_lra = float(meter.loudness_range(measure_in))
        except Exception:
            measured_lra = 0.0

    # 第二遍：线性增益对齐 IL
    gain_db = target_lufs - measured_il
    gain_lin = 10 ** (gain_db / 20.0)
    out = (audio * gain_lin).astype(np.float32)

    return out, measured_il, measured_lra
