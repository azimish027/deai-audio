/**
 * projectStore — Project 主状态（修复台 ↔ 编曲台 ↔ 词作台 共享单一事实来源）。
 * 所有更新走 Immer 的 produce，保证不可变。
 * 约束（来自重构方案 §3.3）：
 *   - 音频/MIDI 二进制不进 Zustand，只放 blob_url
 *   - Undo/Redo 后续用 zundo 中间件挂进来（P2 再做）
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { produce } from "immer";
import { v4 as uuid } from "uuid";
import type {
  Project, Track, Clip, Note, ChordEvent, LyricSection,
  ReferenceAnalysis, Recipe, KnowledgeCard, MusicalContext, ClipContent,
} from "../types/project";

interface ProjectActions {
  // ---- 项目 ----
  newProject: (name?: string) => void;
  loadProject: (p: Project) => void;
  setMusicalContext: (ctx: Partial<MusicalContext>) => void;
  setLengthBeats: (n: number) => void;

  // ---- Track ----
  addTrack: (name?: string, instrument?: Track["instrument"]) => string; // 返回新 track_id
  removeTrack: (id: string) => void;
  reorderTrack: (fromIndex: number, toIndex: number) => void;
  updateTrack: (id: string, patch: Partial<Track>) => void;

  // ---- Clip ----
  addClip: (track_id: string, start_beat: number, content: ClipContent, opts?: Partial<Clip>) => string;
  removeClip: (clip_id: string) => void;
  moveClip: (clip_id: string, newStart: number, newTrackId?: string) => void;
  updateClip: (clip_id: string, patch: Partial<Clip>) => void;

  // ---- Notes（MIDI clip 内部）----
  addNote: (clip_id: string, note: Note) => void;
  removeNote: (clip_id: string, notePitch: number, startBeat: number) => void;

  // ---- Chord / Lyric / Reference / Recipe / Knowledge ----
  addChordEvent: (clip_id: string, ev: ChordEvent) => void;
  addLyricSection: (s: LyricSection) => void;
  removeLyricSection: (id: string) => void;
  updateLyricLine: (sectionId: string, lineId: string, text: string) => void;
  addLyricLine: (sectionId: string) => void;
  removeLyricLine: (sectionId: string, lineId: string) => void;
  importReferenceChords: (chords: ChordEvent[], analysisId: string) => number; // 返回注入的 clip 数
  addReferenceAnalysis: (a: ReferenceAnalysis) => void;
  addRecipe: (r: Recipe) => void;
  addKnowledgeCard: (c: KnowledgeCard) => void;
  markKnowledgeLearned: (cardId: string, learned: boolean) => void;
}

function makeEmptyProject(name: string): Project {
  return {
    id: uuid(),
    name,
    musical_context: { bpm: 120, key: 0, mode: "major", time_signature: [4, 4] },
    tracks: [],
    arrangement: { length_beats: 64 },
    lyrics: { sections: [], rhyme_scheme: "", language: "zh" },
    references: [],
    recipes: [],
    knowledge: [],
    audio_sessions: [],
    created_at: Date.now(),
    updated_at: Date.now(),
  };
}

interface ProjectStore extends Project, ProjectActions {}

const COLOR_PALETTE = [
  "#4E83C1", "#E8805C", "#6DBF8F", "#C46CC4", "#E6B347", "#5EB5D6",
];

export const useProjectStore = create<ProjectStore>()(
  persist((set, get) => ({
  ...makeEmptyProject("未命名项目"),

  newProject: (name) => set(produce((s: ProjectStore) => Object.assign(s, makeEmptyProject(name ?? "未命名项目")))),
  loadProject: (p) => set(produce((s: ProjectStore) => Object.assign(s, p))),

  setMusicalContext: (ctx) => set(produce((s: ProjectStore) => { Object.assign(s.musical_context, ctx); s.updated_at = Date.now(); })),
  setLengthBeats: (n) => set(produce((s: ProjectStore) => { s.arrangement.length_beats = n; s.updated_at = Date.now(); })),

  addTrack: (name, instrument) => {
    const id = uuid();
    const idx = get().tracks.length % COLOR_PALETTE.length;
    const t: Track = {
      id,
      name: name ?? `轨道 ${get().tracks.length + 1}`,
      color: COLOR_PALETTE[idx],
      instrument: instrument ?? "custom",
      clips: [],
      volume: 1,
      pan: 0,
    };
    set(produce((s: ProjectStore) => { s.tracks.push(t); s.updated_at = Date.now(); }));
    return id;
  },
  removeTrack: (id) => set(produce((s: ProjectStore) => {
    s.tracks = s.tracks.filter((t: Track) => t.id !== id);
    s.updated_at = Date.now();
  })),
  reorderTrack: (fromIndex, toIndex) => set(produce((s: ProjectStore) => {
    const t = s.tracks.splice(fromIndex, 1)[0];
    s.tracks.splice(toIndex, 0, t);
  })),
  updateTrack: (id, patch) => set(produce((s: ProjectStore) => {
    const t = s.tracks.find((x: Track) => x.id === id);
    if (t) Object.assign(t, patch);
    s.updated_at = Date.now();
  })),

  addClip: (track_id, start_beat, content, opts) => {
    const id = uuid();
    const length_beat = content.kind === "audio"
      ? Math.max(1, Math.round(content.duration_beats))
      : content.kind === "chord"
        ? Math.max(1, ...content.events.map((e: ChordEvent) => e.start_beat + e.duration))
        : 4;
    const clip: Clip = {
      id,
      track_id,
      start_beat,
      length_beat,
      content,
      origin: opts?.origin ?? "generated",
      provenance: opts?.provenance ?? {},
      locked: opts?.locked,
      muted: opts?.muted,
    };
    set(produce((s: ProjectStore) => {
      const t = s.tracks.find((x: Track) => x.id === track_id);
      if (t) { t.clips.push(clip); s.updated_at = Date.now(); }
    }));
    return id;
  },
  removeClip: (clip_id) => set(produce((s: ProjectStore) => {
    for (const t of s.tracks) t.clips = t.clips.filter((c: Clip) => c.id !== clip_id);
    s.updated_at = Date.now();
  })),
  moveClip: (clip_id, newStart, newTrackId) => set(produce((s: ProjectStore) => {
    for (const t of s.tracks) {
      const c = t.clips.find((x: Clip) => x.id === clip_id);
      if (c) {
        c.start_beat = newStart;
        if (newTrackId && newTrackId !== t.id) {
          t.clips = t.clips.filter((x: Clip) => x.id !== clip_id);
          const dst = s.tracks.find((x: Track) => x.id === newTrackId);
          if (dst) dst.clips.push(c);
        }
        s.updated_at = Date.now();
      }
    }
  })),
  updateClip: (clip_id, patch) => set(produce((s: ProjectStore) => {
    for (const t of s.tracks) {
      const c = t.clips.find((x: Clip) => x.id === clip_id);
      if (c) Object.assign(c, patch);
    }
    s.updated_at = Date.now();
  })),

  addNote: (clip_id, note) => set(produce((s: ProjectStore) => {
    for (const t of s.tracks) {
      for (const c of t.clips) {
        if (c.id === clip_id && c.content.kind === "midi") {
          c.content.notes.push(note);
          s.updated_at = Date.now();
        }
      }
    }
  })),
  removeNote: (clip_id, pitch, startBeat) => set(produce((s: ProjectStore) => {
    for (const t of s.tracks) {
      for (const c of t.clips) {
        if (c.id === clip_id && c.content.kind === "midi") {
          c.content.notes = c.content.notes.filter(
            (n: Note) => !(n.pitch === pitch && n.start_beat === startBeat)
          );
          s.updated_at = Date.now();
        }
      }
    }
  })),

  addChordEvent: (clip_id, ev) => set(produce((s: ProjectStore) => {
    for (const t of s.tracks) {
      for (const c of t.clips) {
        if (c.id === clip_id && c.content.kind === "chord") {
          c.content.events.push(ev);
          s.updated_at = Date.now();
        }
      }
    }
  })),
  addLyricSection: (sec) => set(produce((s: ProjectStore) => {
    s.lyrics.sections.push(sec);
    s.updated_at = Date.now();
  })),
  removeLyricSection: (id) => set(produce((s: ProjectStore) => {
    s.lyrics.sections = s.lyrics.sections.filter((x: LyricSection) => x.id !== id);
    s.updated_at = Date.now();
  })),
  updateLyricLine: (sectionId, lineId, text) => set(produce((s: ProjectStore) => {
    const sec = s.lyrics.sections.find((x: LyricSection) => x.id === sectionId);
    if (!sec) return;
    const ln = sec.lines.find((l: any) => l.id === lineId);
    if (!ln) return;
    ln.text = text;
    ln.syllables = text ? text.split(/[，。！？、\s]+/).map((w) => ({ text: w || "♪", start_beat: 0, duration: 1 })) : [];
    s.updated_at = Date.now();
  })),
  addLyricLine: (sectionId) => set(produce((s: ProjectStore) => {
    const sec = s.lyrics.sections.find((x: LyricSection) => x.id === sectionId);
    if (!sec) return;
    sec.lines.push({ id: uuid(), text: "", syllables: [] });
    s.updated_at = Date.now();
  })),
  removeLyricLine: (sectionId, lineId) => set(produce((s: ProjectStore) => {
    const sec = s.lyrics.sections.find((x: LyricSection) => x.id === sectionId);
    if (!sec) return;
    sec.lines = sec.lines.filter((l: any) => l.id !== lineId);
    s.updated_at = Date.now();
  })),
  importReferenceChords: (chords, analysisId) => {
    if (!chords || chords.length === 0) return 0;
    const trackId = get().addTrack(`参考和弦 #${analysisId.slice(0, 6)}`, "keys");
    let count = 0;
    for (const ev of chords) {
      get().addClip(trackId, Math.round(ev.start_beat ?? 0), {
        kind: "chord",
        events: [{ root: ev.root, quality: ev.quality, duration: ev.duration, function_label: ev.function_label }],
      }, {
        origin: "reference",
        provenance: { source_ref: analysisId, model: "librosa", engine: "analyzer" },
      });
      count++;
    }
    return count;
  },
  addReferenceAnalysis: (a) => set(produce((s: ProjectStore) => {
    s.references.push(a);
    s.updated_at = Date.now();
  })),
  addRecipe: (r) => set(produce((s: ProjectStore) => {
    s.recipes.push(r);
    s.updated_at = Date.now();
  })),
  addKnowledgeCard: (c) => set(produce((s: ProjectStore) => {
    s.knowledge.push(c);
    s.updated_at = Date.now();
  })),
  markKnowledgeLearned: (cardId, learned) => set(produce((s: ProjectStore) => {
    const k = s.knowledge.find((c: KnowledgeCard) => c.id === cardId);
    if (k) k.learned = learned;
  })),
  }), {
    name: "deai_project_v1",
    version: 1,
    // 全部字段可序列化（Project里全是纯数据，没有blob URL）
  })
);
