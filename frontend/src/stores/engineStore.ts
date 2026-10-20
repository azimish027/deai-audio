/**
 * engineStore — 引擎调用状态、加载、错误。
 * 把原 sessionStore 的 repair 相关状态迁入这里。
 */
import { create } from "zustand";
import { produce } from "immer";
import { v4 as uuid } from "uuid";
import type { RepairSession } from "../types/project";
import type { ReferenceAnalysisResult } from "../api/engine";
import type { StepControls, HumanPreserveControls } from "../utils/repairControls";

export type RepairStatus = "idle" | "uploading" | "processing" | "done" | "error";

export interface RepairSessionUI extends RepairSession {
  audio_url: string;
  processed_url?: string;
  error?: string;
  status: RepairStatus;
  progress_text?: string;
  run_controls?: StepControls & { human?: HumanPreserveControls };
}

interface EngineStore {
  // 修复台
  repair_sessions: RepairSessionUI[];     // 一个项目可以有多个修复会话
  selected_session_id: string | null;     // 当前查看的会话

  // 拆解台
  analyzing: boolean;
  analyze_progress?: string;
  analyze_error?: string;
  analyze_result?: ReferenceAnalysisResult;   // 最近一次分析结果（Center AnalysisReportView 用）

  // 生成引擎
  generating: boolean;
  generate_progress?: string;
  generate_error?: string;

  // 通用
  backend_ok: boolean | null;

  // actions
  // —— repair ——
  startRepair: (file: File, template_id?: string) => string;      // 返回 session_id
  setRepairStatus: (session_id: string, status: RepairStatus, progressText?: string) => void;
  setRepairResult: (session_id: string, result: Omit<RepairSession, "session_id" | "created_at">) => void;
  setRepairError: (session_id: string, error: string) => void;
  setRunControls: (session_id: string, controls: StepControls) => void;
  selectSession: (session_id: string | null) => void;
  removeSession: (session_id: string) => void;

  // —— analyze ——
  startAnalyze: () => void;
  setAnalyzeProgress: (t: string) => void;
  setAnalyzeResult: (r: ReferenceAnalysisResult) => void;
  setAnalyzeError: (e: string | null) => void;

  // —— generate ——
  startGenerate: () => void;
  setGenerateProgress: (t: string) => void;
  setGenerateError: (e: string | null) => void;

  // —— 通用 ——
  setBackendOk: (ok: boolean | null) => void;
}

export const useEngineStore = create<EngineStore>((set) => ({
  repair_sessions: [],
  selected_session_id: null,
  analyzing: false,
  analyze_progress: undefined,
  analyze_error: undefined,
  generating: false,
  generate_progress: undefined,
  generate_error: undefined,
  backend_ok: null,

  startRepair: (file, template_id) => {
    const id = uuid();
    const url = URL.createObjectURL(file);
    const sess: RepairSessionUI = {
      session_id: id,
      template_id: template_id ?? "studio_vocal",
      input_path: file.name,
      input_name: file.name,
      state: "UPLOADED",
      diagnosis: {},
      segments: [],
      exports: {},
      created_at: Date.now(),
      audio_url: url,
      status: "uploading",
    };
    set(produce((s: EngineStore) => {
      s.repair_sessions.push(sess);
      s.selected_session_id = id;
    }));
    return id;
  },
  setRepairStatus: (session_id, status, progressText) => set(produce((s: EngineStore) => {
    const sess = s.repair_sessions.find((x) => x.session_id === session_id);
    if (sess) { sess.status = status; sess.progress_text = progressText; }
  })),
  setRepairResult: (session_id, result) => set(produce((s: EngineStore) => {
    const sess = s.repair_sessions.find((x) => x.session_id === session_id);
    if (sess) Object.assign(sess, { ...result, status: "done" as RepairStatus });
  })),
  setRepairError: (session_id, error) => set(produce((s: EngineStore) => {
    const sess = s.repair_sessions.find((x) => x.session_id === session_id);
    if (sess) { sess.status = "error"; sess.error = error; }
  })),
  setRunControls: (session_id, controls) => set(produce((s: EngineStore) => {
    const sess = s.repair_sessions.find((x) => x.session_id === session_id);
    if (sess) sess.run_controls = controls;
  })),
  selectSession: (id) => set({ selected_session_id: id }),
  removeSession: (session_id) => set(produce((s: EngineStore) => {
    // 清理 blob URL
    const sess = s.repair_sessions.find((x) => x.session_id === session_id);
    if (sess && sess.audio_url.startsWith("blob:")) URL.revokeObjectURL(sess.audio_url);
    s.repair_sessions = s.repair_sessions.filter((x) => x.session_id !== session_id);
    if (s.selected_session_id === session_id) s.selected_session_id = s.repair_sessions[0]?.session_id ?? null;
  })),

  startAnalyze: () => set({ analyzing: true, analyze_progress: undefined, analyze_error: undefined, analyze_result: undefined }),
  setAnalyzeProgress: (t) => set({ analyze_progress: t }),
  setAnalyzeResult: (r) => set({ analyzing: false, analyze_result: r, analyze_progress: undefined }),
  setAnalyzeError: (e) => set({ analyzing: false, analyze_error: e ?? undefined }),

  startGenerate: () => set({ generating: true, generate_progress: undefined, generate_error: undefined }),
  setGenerateProgress: (t) => set({ generate_progress: t }),
  setGenerateError: (e) => set({ generating: false, generate_error: e ?? undefined }),

  setBackendOk: (ok) => set({ backend_ok: ok }),
}));
