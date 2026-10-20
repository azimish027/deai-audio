"""参数总表——硬编码常量，直接来自文档规格。"""

# ── 工作空间固定 ──────────────────────────────────────────────────
WORK_SR = 48000          # 固定 48kHz，不做 44.1kHz 工作流
WORK_BIT_DEPTH = "float32"

# ── VAD ──────────────────────────────────────────────────────────
VAD_TOP_DB = 30                  # dB 低于峰值阈值
VAD_FRAME_LENGTH = 2048          # 样本数
VAD_HOP_LENGTH = 512

# ── 分段 ─────────────────────────────────────────────────────────
SEG_MIN_LEN_S = 0.8              # 短于此合并
SEG_MAX_LEN_S = 30.0             # 长于此按 10s 窗口切
SEG_CROSSFADE_MS = 20            # 等功率曲线

# ── 瞬态恢复（快慢包络） ────────────────────────────────────────────
TRANSIENT_FAST_ATTACK_MS = 0.5
TRANSIENT_FAST_RELEASE_MS = 20.0
TRANSIENT_SLOW_ATTACK_MS = 20.0
TRANSIENT_SLOW_RELEASE_MS = 200.0

# ── 微瑕疵注入 ─────────────────────────────────────────────────────
MICRO_PITCH_CENTS_MAX = 6.0      # ±6 cents 上限
MICRO_GAIN_DB_MAX = 1.0          # ±1.0 dB 上限
MICRO_NOISE_FLOOR_DBFS = -60.0   # 底噪注入

# ── 降噪 ──────────────────────────────────────────────────────────
DENOISE_ATTEN_LIM_DB_RANGE = (3.0, 20.0)

# ── 响度标准化（EBU R128） ────────────────────────────────────────
IL_TARGET_SPEECH = -16.0         # LUFS
IL_TARGET_SHORT_VIDEO = -14.0    # LUFS

# ── 真峰值限幅 ────────────────────────────────────────────────────
TRUE_PEAK_LIMIT_DBTP = -1.5      # M4A/MP3 导出
TRUE_PEAK_LIMIT_WAV_DBTP = -1.0  # WAV 导出（无编码过冲）
LIMITER_LOOKAHEAD_MS = 5.0

# ── A/B 对比 ──────────────────────────────────────────────────────
AB_CROSSFADE_MS = 10.0

# ── 输入修复阈值 ──────────────────────────────────────────────────
DECLIP_THRESHOLD = 0.99          # 相对满刻度
DC_OFFSET_THRESHOLD = 0.001

# ── 诊断分型阈值 ──────────────────────────────────────────────────
PHASE_ENTROPY_NATURAL_THRESHOLD = 0.75    # ≥0.75 视为自然
PHASE_ENTROPY_STRONG_THRESHOLD = 0.55     # <0.55 强声码器残留

# ── 处理链状态机 ──────────────────────────────────────────────────
PIPELINE_STATES = [
    "UPLOADED", "DECODED", "DIAGNOSED", "SEPARATED",
    "SEGMENTED", "PROCESSING", "NORMALIZED", "EXPORTED",
]

# ── 模板参数表（9 步 DSP） ────────────────────────────────────────
# 每个模板的 human_preserve 字段覆盖人味保护子开关默认值。
# 前端 StepCards 人味子面板 → params.human_preserve → 这里读取 / 覆盖。

HUMAN_PROFILE_DEFAULTS = {
    "enabled": True,                 # 人味保护总开关（默认开）
    "pitch_correct": True,           # 修音（允许±cents 内偏差）
    "pitch_tolerance_cents": 15,     # ±15 cents 不修音（反直觉点：修到 100% 准人味死）
    "keep_breath": True,             # 气口保留（降噪时不衰减吸气段）
    "keep_slur": True,               # 滑音保留（pitch 检测不量化滑音段）
    "dynamic_wide": True,            # 动态范围放宽（不过度压缩）
    "loudness_tolerance_lufs": 1.5,  # 响度 ±1.5 LUFS 容忍度（电台感来自精确到 ±0.1）
    "denoise_strength_mult": 0.6,    # 降噪强度 ×0.6（气口一起被当噪声音掉）
    "deverb_wet_retention_mult": 1.5,# 混响保留 ×1.5（口腔共鸣是"人"的标记）
}

TEMPLATES = {
    "studio_vocal": {    # 录音棚人声 → 人味全开，气口滑音保留
        "denoise_strength": 0.6,
        "deverb_wet_retention": 0.15,
        "transient_target_db": 8.0,
        "transient_max_restore_db": 4.0,
        "hf_air_gain_db": 0.5,
        "hf_air_freq_hz": 10000,
        "deesser_level": "light",
        "segment_lra_target": 5.0,
        "il_target_lufs": IL_TARGET_SPEECH,
        "human_preserve": {**HUMAN_PROFILE_DEFAULTS,
            "pitch_tolerance_cents": 15,
            "keep_breath": True, "keep_slur": True,
            "loudness_tolerance_lufs": 1.5,
        },
    },
    "live_band": {       # 现场乐队感 → 人味全开，动态宽
        "denoise_strength": 0.4,
        "deverb_wet_retention": 0.35,
        "transient_target_db": 12.0,
        "transient_max_restore_db": 6.0,
        "hf_air_gain_db": 1.0,
        "hf_air_freq_hz": 8000,
        "deesser_level": "off",
        "segment_lra_target": 8.0,
        "il_target_lufs": IL_TARGET_SPEECH,
        "human_preserve": {**HUMAN_PROFILE_DEFAULTS,
            "pitch_tolerance_cents": 20,
            "keep_breath": False,  # 现场呼吸混响里淹没无所谓
            "loudness_tolerance_lufs": 2.5,
        },
    },
    "film_voiceover": {  # 电影旁白 → 人味适度，稳定优先
        "denoise_strength": 0.5,
        "deverb_wet_retention": 0.20,
        "transient_target_db": 7.0,
        "transient_max_restore_db": 3.0,
        "hf_air_gain_db": 0.3,
        "hf_air_freq_hz": 12000,
        "deesser_level": "medium",
        "segment_lra_target": 3.0,
        "il_target_lufs": IL_TARGET_SPEECH,
        "human_preserve": {**HUMAN_PROFILE_DEFAULTS,
            "pitch_tolerance_cents": 10,  # 旁白要准
            "keep_slur": False,          # 旁白不要滑音
            "loudness_tolerance_lufs": 0.8,  # 稳定
        },
    },
    "bedroom_demo": {    # 卧室 Demo → 人味最松，允许不准
        "denoise_strength": 0.2,
        "deverb_wet_retention": 0.45,
        "transient_target_db": 9.0,
        "transient_max_restore_db": 5.0,
        "hf_air_gain_db": -1.0,
        "hf_air_freq_hz": 6000,
        "deesser_level": "light",
        "segment_lra_target": 6.0,
        "il_target_lufs": IL_TARGET_SPEECH,
        "human_preserve": {**HUMAN_PROFILE_DEFAULTS,
            "pitch_tolerance_cents": 25,
            "keep_breath": True, "keep_slur": True,
            "loudness_tolerance_lufs": 2.0,
            "denoise_strength_mult": 0.4,  # 卧室本来就脏，降噪要轻
            "deverb_wet_retention_mult": 2.0,
        },
    },
    "podcast_dialogue": {  # 播客对话 → 人味全开（对话最重要的是"像人"）
        "denoise_strength": 0.7,
        "deverb_wet_retention": 0.15,
        "transient_target_db": 7.0,
        "transient_max_restore_db": 4.0,
        "hf_air_gain_db": 0.8,
        "hf_air_freq_hz": 10000,
        "deesser_level": "medium",
        "segment_lra_target": 4.0,
        "il_target_lufs": IL_TARGET_SPEECH,
        "human_preserve": {**HUMAN_PROFILE_DEFAULTS,
            "pitch_tolerance_cents": 15,
            "keep_breath": True,
            "loudness_tolerance_lufs": 1.5,
            "denoise_strength_mult": 0.5,  # 播客降噪不能太狠
        },
    },
    "short_video_voiceover": {  # 短视频口播 → 电台感优先，人味关大部分
        "denoise_strength": 0.65,
        "deverb_wet_retention": 0.10,
        "transient_target_db": 6.0,
        "transient_max_restore_db": 3.0,
        "hf_air_gain_db": 1.2,
        "hf_air_freq_hz": 8000,
        "deesser_level": "medium",
        "segment_lra_target": 3.0,
        "il_target_lufs": IL_TARGET_SHORT_VIDEO,
        "human_preserve": {**HUMAN_PROFILE_DEFAULTS,
            "enabled": False,              # 短视频不要人味保护，电台感
            "pitch_correct": True,
            "pitch_tolerance_cents": 5,    # 要准
            "keep_breath": False,
            "keep_slur": False,
            "dynamic_wide": False,
            "loudness_tolerance_lufs": 0.5,  # 响度精确到 ±0.5
            "denoise_strength_mult": 1.0,
            "deverb_wet_retention_mult": 1.0,
        },
    },
}

TEMPLATE_NAMES_ZH = {
    "studio_vocal": "录音棚人声",
    "live_band": "现场乐队感",
    "film_voiceover": "电影旁白",
    "bedroom_demo": "卧室 Demo",
    "podcast_dialogue": "播客对话",
    "short_video_voiceover": "短视频口播",
}

# 降噪强度 → atten_lim_db 映射
def denoise_strength_to_atten_lim(strength: float) -> float:
    """strength ∈ [0,1] → atten_lim_db ∈ [3,20]。"""
    lo, hi = DENOISE_ATTEN_LIM_DB_RANGE
    return lo + strength * (hi - lo)
