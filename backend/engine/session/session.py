"""Session 数据契约、Segment、DiagnosisReport —— 全引擎唯一状态容器。"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class PipelineState(str, Enum):
    UPLOADED = "UPLOADED"
    DECODED = "DECODED"
    DIAGNOSED = "DIAGNOSED"
    SEPARATED = "SEPARATED"
    SEGMENTED = "SEGMENTED"
    PROCESSING = "PROCESSING"
    NORMALIZED = "NORMALIZED"
    EXPORTED = "EXPORTED"


class DominantDamageType(str, Enum):
    VOCODER_RESIDUAL = "vocoder_residual"
    OVER_COMPRESSION = "over_compression"
    LOSSY_CODEC = "lossy_codec"
    TRAINING_DATA_ARTIFACT = "training_data_artifact"
    MIXED = "mixed"


class SceneLabel(str, Enum):
    MONOLOGUE = "monologue"
    DIALOGUE = "dialogue"
    MUSIC = "music"
    AMBIENCE = "ambience"
    SFX = "sfx"


@dataclass
class MechanicalSignature:
    phase_entropy: float = 0.0           # 归一化 [0,1]
    pitch_linearity_score: float = 0.0   # 越高越合成 [0,1]
    transient_deficit_db: float = 0.0    # 瞬态亏损量
    lra_lu: float = 0.0
    spectral_flatness: float = 0.0
    pre_echo_score: float = 0.0
    bandwidth_cutoff_hz: Optional[float] = None
    hnr_db: float = 0.0                  # 谐波噪声比
    f0_consistency: float = 0.0          # f0 一致性 [0,1]
    stereo_phase_coherence: float = 0.0  # 立体声相位相干性 [0,1]
    checkerboard_ratio: float = 0.0      # 倒谱棋盘峰值比


@dataclass
class ClippingInfo:
    detected: bool = False
    threshold: float = 0.99
    sample_ranges: list = field(default_factory=list)


@dataclass
class DiagnosisReport:
    mechanical_signature: MechanicalSignature = field(default_factory=MechanicalSignature)
    clipping: ClippingInfo = field(default_factory=ClippingInfo)
    dc_offset: float = 0.0
    dominant_damage_type: DominantDamageType = DominantDamageType.MIXED


@dataclass
class Segment:
    start_s: float
    end_s: float
    scene_label: SceneLabel
    confidence: float = 0.0
    local_overrides: dict = field(default_factory=dict)  # template_id?, strength?


@dataclass
class SourceInfo:
    path: str = ""
    original_sr: int = 48000
    original_channels: int = 1
    duration_s: float = 0.0


@dataclass
class Stems:
    vocals: Optional[object] = None
    accompaniment: Optional[object] = None
    ambience: Optional[object] = None


@dataclass
class Exports:
    wav: Optional[str] = None
    m4a: Optional[str] = None
    mp3: Optional[str] = None


@dataclass
class Session:
    """全引擎唯一状态容器。所有模块读写同一 Session。"""
    session_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    state: PipelineState = PipelineState.UPLOADED

    source: SourceInfo = field(default_factory=SourceInfo)
    # working.wav 为 numpy.ndarray[float32]，48kHz stereo_interleaved
    working: dict = field(default_factory=lambda: {
        "wav": None, "sr": 48000, "layout": "stereo_interleaved"
    })

    diagnosis: DiagnosisReport = field(default_factory=DiagnosisReport)
    stems: Stems = field(default_factory=Stems)
    segments: list = field(default_factory=list)  # list[Segment]

    template_id: str = "studio_vocal"
    processing_graph: dict = field(default_factory=dict)
    exports: Exports = field(default_factory=Exports)

    # 运行时辅助（不写入 JSON）
    tmp_dir: str = ""

    def transition_to(self, new_state: PipelineState) -> None:
        """幂等状态转换。"""
        if new_state.value in [s.value for s in PipelineState]:
            self.state = new_state

    def to_dict(self) -> dict:
        """简化为 JSON 可序列化的字典（不包含 numpy 数组等）。"""
        return {
            "session_id": self.session_id,
            "state": self.state.value,
            "source": self.source.__dict__,
            "template_id": self.template_id,
            "segments": [
                {"start_s": s.start_s, "end_s": s.end_s,
                 "scene_label": s.scene_label.value, "confidence": s.confidence}
                for s in self.segments
            ],
            "diagnosis": {
                "phase_entropy": self.diagnosis.mechanical_signature.phase_entropy,
                "transient_deficit_db": self.diagnosis.mechanical_signature.transient_deficit_db,
                "dominant_damage_type": self.diagnosis.dominant_damage_type.value,
                "clipping_detected": self.diagnosis.clipping.detected,
            },
            "exports": {k: v for k, v in self.exports.__dict__.items()},
        }
