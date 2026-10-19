/**
 * useFeatureFlags —— Feature Flag 机制。
 *
 * 依据 PRODUCT-FRAMEWORK.md §3.2 Step 3「层级2：功能级降级」：
 *   "Feature Flag 机制：每个非核心功能可以独立关闭"
 *
 * 用法：
 *   // 1. 组件里读 flag
 *   const { flags, isEnabled, toggle } = useFeatureFlags();
 *   if (isEnabled("ai_chat")) { /* 渲染AI对话 *\/ }
 *
 *   // 2. env 变量覆盖（生产环境可用）
 *   // VITE_FLAG_AI_CHAT=true → 强制开启
 *
 *   // 3. localStorage 持久化（开发调试用）
 *   // deai_flags_v1 = { ai_chat: true, auto_inject_chords: false }
 *
 * 铁律：默认值全 false（保守开启），任何新增 flag 必须在此注册。
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

// ─── Flag 注册表（所有 flag 必须在此声明） ─────────────────────
export const FLAG_REGISTRY = {
  // 核心功能
  auto_inject_chords: { default: false, env: "VITE_FLAG_AUTO_INJECT_CHORDS", desc: "拆解台完成后自动把和弦注入编曲台时间线" },
  ai_chat:            { default: false, env: "VITE_FLAG_AI_CHAT",            desc: "启用 AI 对话（当前为 mock 占位）" },
  undo_redo:          { default: false, env: "VITE_FLAG_UNDO_REDO",          desc: "撤销/重做（zundo middleware）" },
  // 非核心
  track_apply_recipe: { default: false, env: "VITE_FLAG_APPLY_RECIPE",       desc: "拆解台配方一键应用到编曲台" },
  midi_keyboard:      { default: false, env: "VITE_FLAG_MIDI_KB",            desc: "Web MIDI 键盘输入" },
  cloud_sync:         { default: false, env: "VITE_FLAG_CLOUD_SYNC",         desc: "云端项目同步（P2推迟项）" },
} as const;

export type FeatureFlag = keyof typeof FLAG_REGISTRY;
export type FeatureFlags = Record<FeatureFlag, boolean>;

// ─── 初始值：env 变量 → 默认值 ──────────────────────────────
function computeInitial(): FeatureFlags {
  const out = {} as FeatureFlags;
  for (const [k, v] of Object.entries(FLAG_REGISTRY)) {
    const envVal = typeof import.meta !== "undefined" ? import.meta.env?.[v.env] : undefined;
    out[k as FeatureFlag] = envVal === "true" ? true : (v.default as boolean);
  }
  return out;
}

interface FlagStore {
  flags: FeatureFlags;
  isEnabled: (key: FeatureFlag) => boolean;
  set: (key: FeatureFlag, value: boolean) => void;
  toggle: (key: FeatureFlag) => void;
  reset: () => void;
}

export const useFeatureFlags = create<FlagStore>()(
  persist((set, get) => ({
    flags: computeInitial(),
    isEnabled: (key) => !!get().flags[key],
    set: (key, value) => set((s) => ({ flags: { ...s.flags, [key]: value } })),
    toggle: (key) => set((s) => ({ flags: { ...s.flags, [key]: !s.flags[key] } })),
    reset: () => set({ flags: computeInitial() }),
  }), {
    name: "deai_flags_v1",
    version: 1,
  })
);
