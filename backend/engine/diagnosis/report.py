"""汇总 DiagnosisReport：把所有指标一次性算完，填入 Session。"""
from __future__ import annotations

import numpy as np
import librosa

from ..session.session import (
    Session, DiagnosisReport, MechanicalSignature, DominantDamageType,
)
from ..config.constants import PHASE_ENTROPY_STRONG_THRESHOLD, PHASE_ENTROPY_NATURAL_THRESHOLD
from .phase_entropy import compute_phase_entropy
from .hnr import compute_hnr
from .f0_linearity import compute_f0_linearity, compute_f0_consistency
from .transient_deficit import compute_transient_deficit
from .checkerboard import compute_checkerboard_ratio
from .stereophase import compute_stereo_phase_coherence


def build_diagnosis_report(session: Session) -> DiagnosisReport:
    audio = session.working["wav"]
    sr = session.working["sr"]

    # DC offset
    mono = audio if audio.ndim == 1 else audio.mean(axis=1)
    dc_offset = float(np.mean(mono))

    # 削波检测
    from ..config.constants import DECLIP_THRESHOLD
    peak = np.max(np.abs(audio))
    clipping_detected = bool(peak > DECLIP_THRESHOLD)
    if clipping_detected:
        over_threshold = np.abs(audio) > DECLIP_THRESHOLD
        ranges = _runs(over_threshold.any(axis=1)) if audio.ndim == 2 else _runs(over_threshold)
    else:
        ranges = []

    # 相位熵
    phase_entropy = compute_phase_entropy(audio, sr)

    # F0 轮廓（librosa.pyin 是 pyin 的新版本名）
    try:
        f0, voiced_flag, _ = librosa.pyin(
            mono, sr=sr, fmin=librosa.note_to_hz("C2"),
            fmax=librosa.note_to_hz("C7"), center=False,
        )
    except Exception:
        f0 = np.zeros(len(mono))
        voiced_flag = np.zeros(len(mono), dtype=bool)

    pitch_linearity = compute_f0_linearity(f0)
    f0_consistency = compute_f0_consistency(f0)
    hnr = compute_hnr(audio, sr, f0)

    # 瞬态亏损
    deficit_db, peak_db = compute_transient_deficit(audio, sr)

    # 其他
    checkerboard = compute_checkerboard_ratio(audio, sr)
    stereo_coh = compute_stereo_phase_coherence(audio, sr)

    # 频谱平坦度、带宽截止
    spec_flatness = float(np.mean(librosa.feature.spectral_flatness(y=mono)))
    spectrum = np.abs(np.fft.rfft(mono[:sr * 5]))  # 前 5 秒
    freqs = np.fft.rfftfreq(len(mono[:sr * 5]), d=1.0 / sr)
    total = spectrum.sum() + 1e-12
    cumulative = np.cumsum(spectrum) / total
    try:
        bandwidth_cutoff = float(freqs[np.searchsorted(cumulative, 0.99)])
    except Exception:
        bandwidth_cutoff = None

    # 确定 dominant_damage_type
    damage = _classify_damage(phase_entropy, deficit_db, clipping_detected,
                               pitch_linearity, hnr)

    report = DiagnosisReport(
        mechanical_signature=MechanicalSignature(
            phase_entropy=phase_entropy,
            pitch_linearity_score=pitch_linearity,
            transient_deficit_db=deficit_db,
            lra_lu=0.0,  # 响度指标在标准化阶段算
            spectral_flatness=spec_flatness,
            pre_echo_score=0.0,
            bandwidth_cutoff_hz=bandwidth_cutoff,
            hnr_db=hnr,
            f0_consistency=f0_consistency,
            stereo_phase_coherence=stereo_coh,
            checkerboard_ratio=checkerboard,
        ),
        clipping=session.diagnosis.clipping,  # 保留已有，下面覆盖
        dc_offset=dc_offset,
        dominant_damage_type=damage,
    )
    report.clipping.detected = clipping_detected
    report.clipping.threshold = DECLIP_THRESHOLD
    report.clipping.sample_ranges = ranges
    return report


def _runs(mask: np.ndarray) -> list[dict]:
    """找到 True 的连续区间，返回 [{start, end}]。"""
    out = []
    i = 0
    n = len(mask)
    while i < n:
        if mask[i]:
            j = i
            while j < n and mask[j]:
                j += 1
            out.append({"start": int(i), "end": int(j)})
            i = j
        else:
            i += 1
    return out


def _classify_damage(phase_entropy: float, deficit_db: float,
                     clipping: bool, pitch_lin: float, hnr: float) -> DominantDamageType:
    if phase_entropy < PHASE_ENTROPY_STRONG_THRESHOLD:
        return DominantDamageType.VOCODER_RESIDUAL
    if deficit_db > 3.0:
        return DominantDamageType.OVER_COMPRESSION
    if clipping:
        return DominantDamageType.LOSSY_CODEC
    if pitch_lin > 0.6 and hnr < 15:
        return DominantDamageType.TRAINING_DATA_ARTIFACT
    return DominantDamageType.MIXED
