/**
 * selectionStore — 当前选中对象（Clip / Track / Note / ChordEvent / LyricLine）。
 * 选中驱动 RightPanel Inspector 显示什么。
 */
import { create } from "zustand";

export type SelectionKind =
  | { kind: "nothing" }
  | { kind: "track"; track_id: string }
  | { kind: "clip"; clip_id: string; track_id: string }
  | { kind: "note"; clip_id: string; pitch: number; start_beat: number }
  | { kind: "chord"; clip_id: string; chord_index: number }
  | { kind: "lyric_section"; section_id: string }
  | { kind: "lyric_line"; line_id: string }
  | { kind: "reference"; analysis_id: string }
  | { kind: "recipe"; recipe_id: string }
  | { kind: "knowledge"; card_id: string }
  | { kind: "repair_session"; session_id: string };

interface SelectionStore {
  selection: SelectionKind;
  multiClip: string[];          // 多选 Clip id 列表
  setSelection: (s: SelectionKind) => void;
  clear: () => void;
  toggleMultiClip: (clip_id: string) => void;
  clearMultiClip: () => void;
}

export const useSelectionStore = create<SelectionStore>((set) => ({
  selection: { kind: "nothing" },
  multiClip: [],
  setSelection: (s) => set({ selection: s }),
  clear: () => set({ selection: { kind: "nothing" }, multiClip: [] }),
  toggleMultiClip: (clip_id) => set((s) => ({
    multiClip: s.multiClip.includes(clip_id)
      ? s.multiClip.filter((x) => x !== clip_id)
      : [...s.multiClip, clip_id],
  })),
  clearMultiClip: () => set({ multiClip: [] }),
}));
