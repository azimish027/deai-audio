"""法证诊断模块：相位熵 / HNR / f0 线性度 / 瞬态亏损 / 棋盘伪影 / 立体声相位。"""
from .phase_entropy import compute_phase_entropy
from .hnr import compute_hnr
from .f0_linearity import compute_f0_linearity
from .transient_deficit import compute_transient_deficit
from .checkerboard import compute_checkerboard_ratio
from .stereophase import compute_stereo_phase_coherence
from .report import build_diagnosis_report
