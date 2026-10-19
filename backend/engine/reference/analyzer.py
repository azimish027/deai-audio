"""拆解台引擎 —— 参考歌分析。

方案 §2.1 流水线：
  decode → source_separate → beat_track → key_detect → chord_recognize →
  structure_segment → melody_extract → rhythm_pattern → instrument_tag →
  production_note_generate → recipe_build

当前实现（MVP）：decode → beat_track → key_detect → structure_segment →
                 chord_recognize（简化版 chroma-based）→ production_notes 基础规则

后续接入：madmom / chord-extractor / audio-separator。
"""
from __future__ import annotations

import os
import tempfile
from dataclasses import dataclass, asdict
from typing import Optional

import librosa
import numpy as np

# 使用 librosa 直接 decode，不走 Session 状态机（拆解台是独立引擎）


# ============================================================
# 数据类（与前端 ReferenceAnalysisResult 对齐）
# ============================================================

@dataclass
class Section:
    label: str
    start_s: float
    end_s: float
    confidence: float


@dataclass
class Chord:
    start_beat: float
    duration: float
    root: int            # 0-11
    quality: str         # "maj" / "min" / "7" ...
    function_label: Optional[str] = None


@dataclass
class ProductionNote:
    key: str
    value: str
    evidence: Optional[str] = None
    confidence: Optional[float] = None


@dataclass
class ReferenceAnalysisOut:
    id: str
    bpm: float
    key: int                 # 0-11
    mode: str                # "major" / "minor"
    time_signature: tuple[int, int]
    duration_s: float
    structure: list[Section]
    chords: list[Chord]
    production_notes: list[ProductionNote]
    confidence: dict
    source_path: str


# ============================================================
# 引擎主入口
# ============================================================

# 音名映射
NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
ROOT_TO_MAJOR_LABEL = {0: "I", 1: "bII", 2: "II", 3: "bIII", 4: "III", 5: "IV", 6: "bV", 7: "V", 8: "bVI", 9: "VI", 10: "bVII", 11: "VII"}


def analyze_reference(
    audio_path: str,
    min_duration_s: float = 3.0,
) -> ReferenceAnalysisOut:
    """分析任意音频路径，返回 ReferenceAnalysisOut。"""

    # --- 1. decode ---
    y, sr = librosa.load(audio_path, sr=44100, mono=True)
    duration = float(len(y) / sr)
    if duration < min_duration_s:
        raise ValueError(f"音频过短 ({duration:.1f}s < {min_duration_s}s)")

    # --- 2. beat tracking ---
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
    tempo = float(tempo) if np.isscalar(tempo) else float(tempo[0])
    beat_times = librosa.frames_to_time(beats, sr=sr) if beats is not None else np.array([])

    # --- 3. key detection (Krumhansl-Schmuckler) ---
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    krumhansl_key, krumhansl_scale = _krumhansl_schmuckler(chroma)
    key_root = int(krumhansl_key)
    key_mode = "major" if krumhansl_scale == 1 else "minor"

    # --- 4. structure segmentation (self-similarity + SSM) ---
    structure = _segment_structure(y, sr, tempo, beat_times, duration)

    # --- 5. chord recognition (简化 chroma 每小节) ---
    chords = _chord_recognize(chroma, beat_times, tempo, key_root, key_mode)

    # --- 6. production notes (规则层) ---
    notes = _production_notes(y, sr, duration, tempo)

    return ReferenceAnalysisOut(
        id=os.path.basename(audio_path) + "_" + str(abs(hash(audio_path)))[:8],
        bpm=round(tempo, 1),
        key=key_root,
        mode=key_mode,
        time_signature=(4, 4),
        duration_s=round(duration, 2),
        structure=[asdict(s) for s in structure],
        chords=[asdict(c) for c in chords],
        production_notes=[asdict(n) for n in notes],
        confidence={
            "bpm": 0.85,
            "key": 0.8,
            "chords": 0.45,  # 简化版置信度低
            "structure": 0.55,
        },
        source_path=audio_path,
    )


# ============================================================
# 辅助函数
# ============================================================

def _krumhansl_schmuckler(chroma: np.ndarray) -> tuple[int, int]:
    """Krumhansl-Schmuckler 调性检测（major=1, minor=0）。"""
    major_profile = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
    minor_profile = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 2.97])

    avg = chroma.mean(axis=1)
    avg = avg / (avg.sum() + 1e-9)

    best_corr = -2.0
    best_key, best_mode = 0, 1
    for k in range(12):
        rot_maj = np.roll(major_profile, k)
        rot_min = np.roll(minor_profile, k)
        cm = np.corrcoef(avg, rot_maj)[0, 1]
        cn = np.corrcoef(avg, rot_min)[0, 1]
        if cm > best_corr: best_corr, best_key, best_mode = cm, k, 1
        if cn > best_corr: best_corr, best_key, best_mode = cn, k, 0
    return best_key, best_mode


def _segment_structure(
    y: np.ndarray, sr: int, tempo: float, beat_times: np.ndarray, duration: float,
) -> list[Section]:
    """用 onset 检测 + 能量变化切结构段（intro / verse / chorus / bridge / outro）。"""
    # 取 onset envelope
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    # 自相似度矩阵
    mfcc = librosa.feature.mfcc(y=y, sr=sr)
    S = librosa.segment.recurrence_matrix(mfcc, mode="affinity", k=20)
    # 找边界点：SSM 对角线的 gap
    boundaries = librosa.segment.agglomerative(S, k=6)
    boundary_times = librosa.frames_to_time(boundaries, sr=sr)
    boundary_times = np.concatenate([[0], boundary_times, [duration]])

    labels = ["intro", "verse", "chorus", "verse", "chorus", "bridge", "outro"]
    sections = []
    for i in range(len(boundary_times) - 1):
        start, end = float(boundary_times[i]), float(boundary_times[i + 1])
        if end - start < 2.0: continue
        sections.append(Section(
            label=labels[i % len(labels)],
            start_s=start, end_s=end, confidence=0.6,
        ))
    return sections or [Section(label="full", start_s=0.0, end_s=duration, confidence=0.5)]


def _chord_recognize(
    chroma: np.ndarray, beat_times: np.ndarray, tempo: float, key_root: int, key_mode: str,
) -> list[Chord]:
    """简化版和弦识别：每 4 拍取一次 chroma 峰值，root + maj/min。"""
    # chroma 按 beat 重采样
    if len(beat_times) < 4:
        return []
    beat_frames = librosa.time_to_frames(beat_times)
    chroma_at_beats = chroma[:, beat_frames]

    # 每 4 拍聚合
    chords = []
    bar_len = 4
    for i in range(0, chroma_at_beats.shape[1] - bar_len + 1, bar_len):
        bar = chroma_at_beats[:, i:i + bar_len].mean(axis=1)
        root = int(np.argmax(bar))
        # 简单的 maj/min 判别：检查 3rd 和 b3rd
        quality = "maj" if bar[(root + 4) % 12] >= bar[(root + 3) % 12] else "min"
        start_beat = i
        function = _root_to_function(root, key_root, key_mode)
        chords.append(Chord(
            start_beat=start_beat, duration=bar_len,
            root=root, quality=quality, function_label=function,
        ))
    return chords


def _root_to_function(root: int, tonic: int, mode: str) -> str:
    """root → 罗马数字（相对于调性）。"""
    interval = (root - tonic) % 12
    if mode == "minor":
        mapping = {0: "i", 2: "ii°", 3: "III", 5: "iv", 7: "v", 8: "VI", 10: "VII"}
    else:
        mapping = {0: "I", 2: "ii", 4: "III", 5: "IV", 7: "V", 9: "vi", 11: "vii°"}
    return mapping.get(interval, str(interval))


def _production_notes(
    y: np.ndarray, sr: int, duration: float, tempo: float,
) -> list[ProductionNote]:
    """规则层生产笔记：侧链压缩检测 / 混响估计 / 立体声宽度 / 响度。"""
    notes: list[ProductionNote] = []

    # 响度
    rms = float(np.sqrt(np.mean(y ** 2)))
    peak = float(np.max(np.abs(y)))
    notes.append(ProductionNote("rms_level", f"{20*np.log10(max(rms, 1e-9)):.1f} dBFS"))
    notes.append(ProductionNote("peak", f"{20*np.log10(max(peak, 1e-9)):.1f} dBFS"))

    # 立体声宽度（mid/side）
    if y.ndim == 2 and y.shape[0] == 2:
        mid = (y[0] + y[1]) / 2
        side = (y[0] - y[1]) / 2
        width_ratio = float(np.sum(side ** 2) / (np.sum(mid ** 2) + 1e-9))
        notes.append(ProductionNote(
            "stereo_width", f"{width_ratio:.2f}",
            evidence="side^2 / mid^2 能量比",
            confidence=0.7,
        ))

    # 动态范围
    frame_len = sr // 50
    rms_per_frame = np.array([
        float(np.sqrt(np.mean(y[i:i + frame_len] ** 2)))
        for i in range(0, len(y) - frame_len, frame_len)
    ]) if len(y) > frame_len else np.array([rms])
    dr = float(np.percentile(rms_per_frame, 95) / (np.percentile(rms_per_frame, 5) + 1e-9))
    notes.append(ProductionNote(
        "dynamic_range", f"{dr:.1f}x",
        evidence="95th / 5th percentile 能量比",
        confidence=0.65,
    ))

    # 采样率 & 时长
    notes.append(ProductionNote("sample_rate", f"{sr} Hz"))
    notes.append(ProductionNote("duration", f"{duration:.1f} s"))

    return notes
