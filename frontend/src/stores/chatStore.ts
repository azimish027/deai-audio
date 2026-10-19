/**
 * chatStore — AI 对话历史（右侧 AIChatPanel 用）。
 * 流式输出：当前 response 片段存在 current_stream。
 */
import { create } from "zustand";
import { produce } from "immer";

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: number;
  provenance?: string;
}

interface ChatStore {
  messages: ChatMessage[];
  current_stream: string | null;   // 正在流式输出的内容
  sending: boolean;

  addMessage: (m: Omit<ChatMessage, "id" | "timestamp">) => string;
  setCurrentStream: (chunk: string | null) => void;
  appendCurrentStream: (chunk: string) => void;
  finalizeStream: () => void;       // 把 current_stream 转成正式 assistant message
  setSending: (b: boolean) => void;
  clearAll: () => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  current_stream: null,
  sending: false,

  addMessage: (m) => {
    const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    set(produce((s: ChatStore) => {
      s.messages.push({ ...m, id, timestamp: Date.now() });
    }));
    return id;
  },
  setCurrentStream: (chunk) => set({ current_stream: chunk }),
  appendCurrentStream: (chunk) => set((s) => ({ current_stream: (s.current_stream ?? "") + chunk })),
  finalizeStream: () => {
    const cur = get().current_stream;
    if (cur) {
      const id = `msg_${Date.now()}`;
      set(produce((s: ChatStore) => {
        s.messages.push({ id, role: "assistant", content: cur, timestamp: Date.now() });
        s.current_stream = null;
      }));
    }
  },
  setSending: (b) => set({ sending: b }),
  clearAll: () => set({ messages: [], current_stream: null, sending: false }),
}));
