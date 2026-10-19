/**
 * EngineClient —— 方案 §3.2 定义的前端 ↔ 后端统一接口。
 * 所有后端调用走这里；组件层不再直接 fetch。
 *
 * 方法分组：
 *   修复   createSession / processSession / exportSession
 *   拆解   analyzeReference / buildRecipe
 *   编曲   generateMidi / humanizeMidi / suggestChords
 *   写词   countSyllables / findRhymes / continueLyrics
 *   学习   getTheoryCards / createKnowledgeCard / applyRecipe
 *   AI     chat (AsyncIterable 流式)
 *
 * 约束（方案原文）：所有方法幂等（generateMidi 和 chat 带随机性），所有返回对象带 provenance。
 * 失败走降级矩阵（方案 §3.5）——调用方负责 UI 体现。
 */

// ---- 共用类型 ----
export type PipelineState =
  | "IDLE" | "UPLOADED" | "DECODED" | "DIAGNOSED" | "SEPARATED"
  | "SEGMENTED" | "PROCESSING" | "NORMALIZED" | "EXPORTED" | "ERROR";

export interface DiagnosisInfo {
  phase_entropy: number;
  transient_deficit_db: number;
  dominant_damage_type: string;
  clipping_detected: boolean;
  hnr_db?: number;
  checkerboard_ratio?: number;
  stereo_phase_coherence?: number;
}

export interface SessionResult {
  session_id: string;
  state: PipelineState;
  template_id: string;
  diagnosis: DiagnosisInfo;
  segments: { start_s: number; end_s: number; scene_label: string; confidence: number }[];
  exports: { wav?: string; m4a?: string; mp3?: string };
}

// ---- 基础 HTTP ----
const BASE = "/api";

async function fetchJson(path: string, init?: RequestInit): Promise<any> {
  const r = await fetch(`${BASE}${path}`, init);
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text().catch(() => "")}`);
  return r.json();
}

async function fetchBlob(path: string, init?: RequestInit): Promise<Blob> {
  const r = await fetch(`${BASE}${path}`, init);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.blob();
}

// ============================================================
// 修复 —— 现有 FastAPI /process 已有
// ============================================================

/** listTemplates —— 修复台模板列表。 */
export async function listTemplates(): Promise<{ id: string; name_zh: string; params: Record<string, unknown> }[]> {
  const d = await fetchJson("/templates");
  return d.templates;
}

/** healthCheck —— TopBar 后端就绪绿点。 */
export async function healthCheck(): Promise<boolean> {
  try {
    const d = await fetchJson("/health");
    return !!d?.ok;
  } catch { return false; }
}

/** createSession —— 上传音频创建修复会话（后端还没有这个端点，先占位，走 /process 合成返回）。 */
export async function createSession(file: File, templateId: string = "studio_vocal"): Promise<SessionResult> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("template_id", templateId);
  return fetchJson("/process", { method: "POST", body: fd });
}

/** processSession —— 重新处理已有会话（后端同 /process，前端传同一个 file 即可）。 */
export async function processSession(file: File, templateId: string): Promise<SessionResult> {
  return createSession(file, templateId);
}

/** exportSession —— 下载导出文件（后端 /export 还没实现，走 Blob 占位）。 */
export async function exportSession(sessionId: string, format: "wav" | "m4a" | "mp3"): Promise<Blob> {
  return fetchBlob(`/export/${sessionId}/${format}`);
}

// ============================================================
// 拆解 —— P1-C 实现后端 /analyze 后接通
// ============================================================

export interface ReferenceAnalysisResult {
  id: string;
  title?: string;
  artist?: string;
  bpm: number;
  key: number;
  mode: "major" | "minor";
  time_signature: [number, number];
  duration_s: number;
  structure: { label: string; start_s: number; end_s: number; confidence: number }[];
  chords: { start_beat: number; duration: number; root: number; quality: string; function_label?: string }[];
  production_notes: { key: string; value: string; evidence?: string; confidence?: number }[];
  recipe?: unknown;
  confidence: { bpm: number; key: number; chords: number; structure: number };
}

export async function analyzeReference(file: File): Promise<ReferenceAnalysisResult> {
  const fd = new FormData();
  fd.append("file", file);
  return fetchJson("/analyze", { method: "POST", body: fd });
}

export async function buildRecipe(analysisId: string): Promise<unknown> {
  return fetchJson(`/recipe/build/${analysisId}`);
}

// ============================================================
// 编曲 / 写词 / 学习 / AI —— P2/P3/P4 实现后端后接通
// ============================================================

/** 占位——返回空 Clip，调用方按降级矩阵处理。 */
function notImplemented<T>(label: string, fallback: T): Promise<T> {
  console.warn(`[EngineClient] ${label} not implemented yet, returning fallback`);
  return Promise.resolve(fallback);
}

export interface ComposeRequest {
  mood?: string;
  reference_id?: string;
  length_bars?: number;
  tracks?: string[];
}
export interface ChordSuggestion { chord: string; explanation?: string; emotion?: string }

export async function generateMidi(req: ComposeRequest): Promise<unknown> {
  return notImplemented("generateMidi", null);
}
export async function humanizeMidi(clip: unknown, params: unknown): Promise<unknown> {
  return notImplemented("humanizeMidi", clip);
}
export async function suggestChords(context: unknown, mood: string): Promise<ChordSuggestion[]> {
  return notImplemented("suggestChords", []);
}

export async function countSyllables(text: string, lang: string): Promise<number[]> {
  return notImplemented("countSyllables", []);
}
export async function findRhymes(word: string, lang: string): Promise<string[]> {
  return notImplemented("findRhymes", []);
}
export async function continueLyrics(req: unknown): Promise<unknown> {
  return notImplemented("continueLyrics", null);
}

export async function getTheoryCards(operationId: string): Promise<unknown[]> {
  return notImplemented("getTheoryCards", []);
}
export async function createKnowledgeCard(input: string): Promise<unknown> {
  return notImplemented("createKnowledgeCard", null);
}
export async function applyRecipe(recipeId: string, projectId: string, targetTracks: string[]): Promise<unknown[]> {
  return notImplemented("applyRecipe", []);
}

export interface ChatMessage { role: "user" | "assistant" | "system"; content: string }
export async function* chat(messages: ChatMessage[], context?: unknown): AsyncGenerator<string> {
  // 占位实现——直接返回 mock 回复，调用方用 appendCurrentStream → finalizeStream 处理
  yield "（AI 对话后端尚未接入，这是占位回复）";
  void messages; void context;
}
