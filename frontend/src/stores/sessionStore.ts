import { create } from "zustand";

export type PipelineState =
  | "IDLE"
  | "UPLOADED"
  | "DECODED"
  | "DIAGNOSED"
  | "SEPARATED"
  | "SEGMENTED"
  | "PROCESSING"
  | "NORMALIZED"
  | "EXPORTED"
  | "ERROR";

export interface DiagnosisInfo {
  phase_entropy: number;
  transient_deficit_db: number;
  dominant_damage_type: string;
  clipping_detected: boolean;
  hnr_db?: number;
  checkerboard_ratio?: number;
  stereo_phase_coherence?: number;
}

export interface SegmentInfo {
  start_s: number;
  end_s: number;
  scene_label: string;
  confidence: number;
}

export interface SessionInfo {
  session_id: string;
  state: PipelineState;
  template_id: string;
  diagnosis: DiagnosisInfo;
  segments: SegmentInfo[];
  exports: { wav?: string; m4a?: string; mp3?: string };
}

interface SessionStore {
  audioFile: File | null;
  session: SessionInfo | null;
  templates: { id: string; name_zh: string; params: Record<string, unknown> }[];
  selectedTemplate: string;
  isProcessing: boolean;
  progressText: string;
  error: string | null;

  setAudioFile: (f: File | null) => void;
  setTemplate: (id: string) => void;
  setSession: (s: SessionInfo | null) => void;
  setTemplates: (t: SessionStore["templates"]) => void;
  setIsProcessing: (v: boolean, text?: string) => void;
  setError: (e: string | null) => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  audioFile: null,
  session: null,
  templates: [],
  selectedTemplate: "studio_vocal",
  isProcessing: false,
  progressText: "",
  error: null,
  setAudioFile: (f) => set({ audioFile: f }),
  setTemplate: (id) => set({ selectedTemplate: id }),
  setSession: (s) => set({ session: s }),
  setTemplates: (t) => set({ templates: t }),
  setIsProcessing: (v, text) =>
    set({ isProcessing: v, progressText: text ?? "" }),
  setError: (e) => set({ error: e }),
}));
