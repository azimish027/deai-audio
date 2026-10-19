/**
 * knowledgeStore — 学习进度。
 * Project.knowledge 存完整卡片内容；这里只存学习态（learned / last_viewed）和筛选条件。
 */
import { create } from "zustand";

interface KnowledgeStore {
  learned_ids: string[];
  last_viewed: Record<string, number>;   // card_id → timestamp
  filter: {
    show_learned: boolean;
    show_user_authored: boolean;
    search_tag?: string;
  };
  setLearned: (id: string, learned: boolean) => void;
  recordView: (id: string) => void;
  setFilter: (patch: Partial<KnowledgeStore["filter"]>) => void;
}

export const useKnowledgeStore = create<KnowledgeStore>((set) => ({
  learned_ids: [],
  last_viewed: {},
  filter: { show_learned: true, show_user_authored: true },

  setLearned: (id, learned) => set((s) => ({
    learned_ids: learned
      ? [...new Set([...s.learned_ids, id])]
      : s.learned_ids.filter((x) => x !== id),
  })),
  recordView: (id) => set((s) => ({
    last_viewed: { ...s.last_viewed, [id]: Date.now() },
  })),
  setFilter: (patch) => set((s) => ({ filter: { ...s.filter, ...patch } })),
}));
