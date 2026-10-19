"""VAD 分段 + 场景分类。"""
from __future__ import annotations

import numpy as np
import librosa

from ..session.session import Session, Segment, SceneLabel
from ..config.constants import (
    VAD_TOP_DB, VAD_FRAME_LENGTH, VAD_HOP_LENGTH,
    SEG_MIN_LEN_S, SEG_MAX_LEN_S, SEG_CROSSFADE_MS,
)


def segment_session(session: Session) -> Session:
    audio = session.working["wav"]
    sr = session.working["sr"]
    mono = audio if audio.ndim == 1 else audio.mean(axis=1)

    # VAD 能量分段
    frame_length = VAD_FRAME_LENGTH
    hop_length = VAD_HOP_LENGTH

    try:
        bounds = librosa.effects.split(
            mono, top_db=VAD_TOP_DB,
            frame_length=frame_length, hop_length=hop_length,
        )
    except Exception:
        # 退化：整文件一个段
        bounds = np.array([[0, len(mono)]])

    segments = []
    for start_idx, end_idx in bounds:
        start_s = start_idx / sr
        end_s = end_idx / sr
        if end_s - start_s < SEG_MIN_LEN_S:
            continue

        # 超长段切分
        if end_s - start_s > SEG_MAX_LEN_S:
            chunk = 10.0  # 10s 窗口
            t = start_s
            while t < end_s:
                t_next = min(end_s, t + chunk)
                segments.append(_classify_segment(mono, sr, t, t_next))
                t = t_next
        else:
            segments.append(_classify_segment(mono, sr, start_s, end_s))

    session.segments = segments
    return session


def _classify_segment(mono: np.ndarray, sr: int, start_s: float, end_s: float) -> Segment:
    start_idx = int(start_s * sr)
    end_idx = int(end_s * sr)
    seg = mono[start_idx:end_idx]

    if len(seg) < frame_length:
        return Segment(start_s, end_s, SceneLabel.MONOLOGUE, 0.5)

    # 基本特征
    spec_flatness = float(np.mean(librosa.feature.spectral_flatness(y=seg)))
    rms = float(np.sqrt(np.mean(seg ** 2)))

    # VAD 语音占比（弱能量以上）
    frame_len = VAD_FRAME_LENGTH
    hop = VAD_HOP_LENGTH
    rms_frames = librosa.feature.rms(y=seg, frame_length=frame_len, hop_length=hop)[0]
    if len(rms_frames) == 0 or rms_frames.max() < 1e-9:
        return Segment(start_s, end_s, SceneLabel.AMBIENCE, 0.8)
    voiced_ratio = float(np.mean(rms_frames > rms_frames.max() * 0.1))

    # 节拍置信度
    try:
        tempo, beats = librosa.beat.beat_track(y=seg, sr=sr)
        beat_conf = float(len(beats)) if beats is not None else 0.0
    except Exception:
        beat_conf = 0.0

    # 瞬态比例（短、高瞬态 → sfx）
    transient_ratio = float(np.mean(np.abs(np.diff(seg)) > 0.5))

    # 场景判定
    if end_s - start_s < 1.5 and transient_ratio > 0.1:
        label = SceneLabel.SFX
        conf = 0.8
    elif voiced_ratio > 0.7 and beat_conf < 5:
        label = SceneLabel.MONOLOGUE
        conf = 0.7 + voiced_ratio * 0.2
    elif voiced_ratio > 0.5:
        # 对话：基频跳变检测
        f0_curve, _ = librosa.pyin(
            seg, sr=sr, fmin=librosa.note_to_hz("C2"),
            fmax=librosa.note_to_hz("C7"), center=False,
        )
        voiced_f0 = f0_curve[np.isfinite(f0_curve) & (f0_curve > 0)]
        if len(voiced_f0) > 10:
            f0_jumps = float(np.sum(np.abs(np.diff(voiced_f0)) > 30) / max(len(voiced_f0), 1))
            label = SceneLabel.DIALOGUE if f0_jumps > 0.15 else SceneLabel.MONOLOGUE
        else:
            label = SceneLabel.MONOLOGUE
        conf = 0.6
    elif beat_conf > 5:
        label = SceneLabel.MUSIC
        conf = 0.6 + min(beat_conf / 20, 0.3)
    else:
        label = SceneLabel.AMBIENCE
        conf = 0.7 + (1 - spec_flatness) * 0.2

    return Segment(start_s, end_s, label, conf)
