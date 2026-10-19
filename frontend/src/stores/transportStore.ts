/**
 * transportStore — 播放头、循环、节拍器。
 * 关键约束（来自重构方案 §3.4）：
 *   - 播放头位置存在 ref，requestAnimationFrame 驱动不触发 React 重渲染
 */
import { create } from "zustand";
import type { MusicalContext } from "../types/project";

interface TransportStore {
  playing: boolean;
  playhead_beat: number;         // 当前播放头位置（beat，float）
  loop_region: [number, number] | null;
  metronome_on: boolean;
  musical_context: MusicalContext;

  // actions
  play: () => void;
  pause: () => void;
  toggle: () => void;
  setPlayhead: (beat: number) => void;
  seekTo: (beat: number) => void;
  setLoop: (region: [number, number] | null) => void;
  toggleMetronome: () => void;
  setMusicalContext: (ctx: Partial<MusicalContext>) => void;
}

export const useTransportStore = create<TransportStore>((set) => ({
  playing: false,
  playhead_beat: 0,
  loop_region: null,
  metronome_on: false,
  musical_context: { bpm: 120, key: 0, mode: "major", time_signature: [4, 4] },

  play: () => set({ playing: true }),
  pause: () => set({ playing: false }),
  toggle: () => set((s) => ({ playing: !s.playing })),
  setPlayhead: (beat) => set({ playhead_beat: beat }),
  seekTo: (beat) => set((s) => ({ playing: true, playhead_beat: beat })),
  setLoop: (region) => set({ loop_region: region }),
  toggleMetronome: () => set((s) => ({ metronome_on: !s.metronome_on })),
  setMusicalContext: (ctx) => set((s) => ({ musical_context: { ...s.musical_context, ...ctx } })),
}));
