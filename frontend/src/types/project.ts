/**
 * Project 数据模型 —— 五个工作区共享的单一事实来源。
 * 设计原则（来自重构方案 §1.2）：
 *   - 所有生成内容带 provenance，可追溯
 *   - AudioClip 用 blob_url 或文件路径，二进制不进 Zustand
 *   - 所有 Clip 都有 track_id、start_beat、length_beat
 */

// ============================================================
// 基础类型
// ============================================================

export type ProvedanceKind =
  | "recorded"
  | "generated"
  | "imported"
  | "recipe_applied"
  | "reference";

export interface Provenance {
  model?: string;           // 哪个模型生成的
  prompt?: string;          // 用户给的 prompt
  source_ref?: string;      // 参考 analysis_id
  recipe_id?: string;       // 应用的配方
  engine?: string;          // 哪个引擎模块产出的
}

export type ClipContent =
  | { kind: "audio"; blob_url: string; duration_beats: number }
  | { kind: "midi"; notes: Note[]; velocity_curve?: number[]; humanize_params?: HumanizeParams }
  | { kind: "chord"; events: ChordEvent[] }
  | { kind: "lyric"; section_ref: string }
  | { kind: "reference"; analysis_ref: string };

export interface Clip {
  id: string;
  track_id: string;
  start_beat: number;
  length_beat: number;
  content: ClipContent;
  origin: ProvedanceKind;
  provenance: Provenance;
  locked?: boolean;
  muted?: boolean;
}

export type InstrumentKind =
  | "vocals" | "drums" | "bass" | "pad" | "pluck" | "lead"
  | "guitar" | "keys" | "strings" | "fx" | "custom";

export interface Track {
  id: string;
  name: string;
  color: string;              // 时间线 Clip 底色，hex
  instrument: InstrumentKind;
  clips: Clip[];
  volume: number;             // 0-1
  pan: number;                // -1..1
  muted?: boolean;
  solo?: boolean;
  group?: string;             // 分组 id
}

// ============================================================
// MIDI 相关
// ============================================================

export interface Note {
  pitch: number;              // MIDI 音符号 0-127
  start_beat: number;
  duration_beat: number;
  velocity: number;           // 1-127
  articulation?: "staccato" | "tenuto" | "legato" | "accented";
}

export interface HumanizeParams {
  timing_jitter_ms: number;   // ±ms 时值抖动
  velocity_jitter: number;    // ±力度
  duration_jitter_pct: number; // ±% 持续时长抖动
}

// ============================================================
// 和弦
// ============================================================

export type ChordQuality =
  | "maj" | "min" | "dim" | "aug" | "sus4" | "sus2" | "7" | "maj7" | "min7"
  | "dim7" | "half_dim7" | "aug7" | "add9" | "add11" | "add13";

export interface ChordEvent {
  start_beat: number;
  duration: number;
  root: number;               // 0-11，半音号
  quality: ChordQuality;
  extensions?: number[];      // 额外扩展音
  voicing?: number[];         // 实际演奏音高集合
  function_label?: string;    // "I" "ii" "V/vi" 等罗马数字
}

// ============================================================
// 歌词
// ============================================================

export interface LyricSection {
  id: string;
  label: string;              // "Verse 1" "Chorus" 等
  lines: LyricLine[];
}

export interface LyricLine {
  id: string;
  text: string;
  syllables: Syllable[];
  emotion?: string;
}

export interface Syllable {
  text: string;
  start_beat: number;         // 音节吸附到的网格位置
  duration: number;
  end_rhyme_group?: number;   // 押韵组 id，同行末音节共享
}

export interface LyricDoc {
  sections: LyricSection[];
  rhyme_scheme: string;       // 如 "AABB"
  language: "zh" | "en" | "mixed";
}

// ============================================================
// 参考拆解
// ============================================================

export interface Section {
  label: string;               // "intro" / "verse" / "chorus" / "bridge" / "outro" / "drop"
  start_s: number;
  end_s: number;
  confidence: number;
}

export interface RhythmPattern {
  grid: number[][];            // 2D: 4 bars × 16 hits per bar, 0/1
  bpm: number;
  time_signature: [number, number];
}

export interface InstrumentTag {
  name: string;
  confidence: number;
  source?: "mfcc" | "spectral" | "model";
}

export interface ProductionNote {
  key: string;                 // "sidechain" / "reverb" / "width" / "loudness"
  value: string;
  evidence?: string;           // 量化依据
  confidence?: number;
}

export interface Recipe {
  id: string;
  name: string;
  tags: string[];
  chord_progression: ChordEvent[];
  rhythm: RhythmPattern;
  arrangement_template: TrackTemplate[];
  sound_palette: InstrumentTag[];
  mixing_notes: ProductionNote[];
  applicable_context: {
    genre: string[];
    mood: string[];
    bpm_range: [number, number];
  };
  provenance: Provenance;
}

export interface TrackTemplate {
  name: string;
  instrument: InstrumentKind;
  role: "chords" | "rhythm" | "pad" | "lead" | "bass" | "vocals";
  default_clip_density: number;  // 0-1，时间填充率
}

export interface ReferenceAnalysis {
  id: string;
  source_path: string;
  title?: string;
  artist?: string;
  bpm: number;
  key: number;                  // 根音 0-11
  mode: "major" | "minor";
  time_signature: [number, number];
  duration_s: number;
  structure: Section[];
  chords: ChordEvent[];
  melody_contour: number[];     // 每拍一个 F0 值
  rhythm_pattern: RhythmPattern;
  instrumentation: InstrumentTag[];
  production_notes: ProductionNote[];
  recipe?: Recipe;
  confidence: {
    bpm: number;
    key: number;
    chords: number;
    structure: number;
  };
  created_at: number;
}

// ============================================================
// 乐理学习
// ============================================================

export interface KnowledgeCard {
  id: string;
  topic: string;
  short_explanation: string;     // 一句话，新手可见
  deep_explanation: string;      // 展开后
  examples: {
    audio_snippet?: string;       // blob_url
    midi_snippet?: string;
    reference_id?: string;
  }[];
  linked_operations: string[];    // 触发它的用户操作 id
  user_authored: boolean;
  tags: string[];
  prerequisites?: string[];      // 先修知识卡 id
  related?: string[];
  learned?: boolean;
  created_at: number;
}

// ============================================================
// Project 根
// ============================================================

export type WorkspaceKind =
  | "repair"        // 修复台
  | "reference"     // 拆解台
  | "compose"       // 编曲台
  | "lyric"         // 词作台
  | "learn";        // 学习台

export interface MusicalContext {
  bpm: number;
  key: number;                   // 0-11
  mode: "major" | "minor";
  time_signature: [number, number];
}

export interface Project {
  id: string;
  name: string;
  musical_context: MusicalContext;
  tracks: Track[];
  arrangement: {
    length_beats: number;
    loop_region?: [number, number];   // 起止 beat
  };
  lyrics: LyricDoc;
  references: ReferenceAnalysis[];
  recipes: Recipe[];
  knowledge: KnowledgeCard[];
  audio_sessions: RepairSession[];    // 修复会话，多个
  created_at: number;
  updated_at: number;
}

// ============================================================
// 修复台挂到 Project 里（不单独建 engineStore）
// ============================================================

export interface RepairSession {
  session_id: string;
  template_id: string;
  input_path: string;              // 原音频路径或 blob_url
  input_name: string;
  state: string;                   // PipelineState 字符串
  diagnosis: { [k: string]: unknown };  // 与现有 SessionInfo.diagnosis 对齐
  segments: { start_s: number; end_s: number; scene_label: string; confidence: number }[];
  exports: { wav?: string; m4a?: string; mp3?: string };
  created_at: number;
  measurements?: RepairMeasurements;   // 新增：每步 before/after/step-deltas
}

/** 仪表盘 + 步骤卡共享的 measurements 类型（后端 pipeline.py 直接返回） */
export interface RepairMeasurements {
  before: MetricSnapshot;                  // 解码后第一次全量测量
  after: MetricSnapshot;                   // 全部跑完后的终态测量
  steps: StepMeasurement[];                // 每步 before/after/delta
  lufs_target: number;                     // 模板给的目标 LUFS
  true_peak_limit_dbtp: number;            // 模板给的真峰值限幅
  template_id: string;
}

export interface MetricSnapshot {
  lufs: number | null;
  true_peak_dbtp: number | null;
  phase_entropy: number | null;
  spectrum_flatness: number | null;
  rms_dbfs: number | null;
}

export interface StepMeasurement {
  step_id: string;
  name: string;                    // 人话名称，如 "降噪"
  explain: string;                 // 人话解释
  human: string;                   // 更具体的一句人话，带 before/after
  status: 'ok' | 'skipped' | 'error';
  note: string;                    // error 时的 message
  before: Partial<MetricSnapshot>;
  after: Partial<MetricSnapshot>;
  delta: Partial<Record<keyof MetricSnapshot, number | null>>;
}
