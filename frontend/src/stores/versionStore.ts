/**
 * versionStore —— 修复会话的版本快照
 *
 * 每次 processSession 前自动存一版 before-snapshot（原始 audio_url + diagnosis），
 * 处理完存 after-snapshot。支持 UI 上：
 *   - 切版本对比波形（WaveformPlayer 的 altUrl 换成对应 snapshot 的 processed_url）
 *   - 并排对比两组 measurements（before vs after）
 */
import { create } from 'zustand';
import type { RepairMeasurements } from '../types/project';

export interface SessionSnapshot {
  session_id: string;
  version_id: string;       // v1 / v2 / ...
  kind: 'before' | 'after';
  audio_url: string;        // blob url —— 注意换浏览器就失效，纯前端 session 内有效
  processed_url?: string;
  measurements?: RepairMeasurements;
  template_id?: string;
  created_at: number;
  note?: string;
}

interface VersionStore {
  // session_id → snapshots[]
  snapshots: Record<string, SessionSnapshot[]>;

  addSnapshot: (snap: Omit<SessionSnapshot, 'version_id'>) => void;
  getSnapshots: (session_id: string) => SessionSnapshot[];
  getLatest: (session_id: string, kind: 'before' | 'after') => SessionSnapshot | undefined;
  clear: (session_id: string) => void;
}

export const useVersionStore = create<VersionStore>((set, get) => ({
  snapshots: {},

  addSnapshot: (snap) =>
    set((state) => {
      const existing = state.snapshots[snap.session_id] ?? [];
      const version_id = `v${existing.filter((s) => s.kind === snap.kind).length + 1}-${snap.kind}`;
      const full = { ...snap, version_id };
      return {
        snapshots: {
          ...state.snapshots,
          [snap.session_id]: [...existing, full],
        },
      };
    }),

  getSnapshots: (session_id) => get().snapshots[session_id] ?? [],

  getLatest: (session_id, kind) => {
    const all = get().snapshots[session_id] ?? [];
    return [...all].reverse().find((s) => s.kind === kind);
  },

  clear: (session_id) =>
    set((state) => {
      const copy = { ...state.snapshots };
      delete copy[session_id];
      return { snapshots: copy };
    }),
}));
