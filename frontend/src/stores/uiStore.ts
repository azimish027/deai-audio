import { create } from "zustand";
import type { WorkspaceKind } from "../types/project";
import { useIsMobile } from "../hooks/useResponsive";

type PanelSide = "left" | "right" | "bottom";

interface UIStore {
  currentWorkspace: WorkspaceKind;
  panels: Record<PanelSide, { visible: boolean; width: number; height: number }>;

  setWorkspace: (w: WorkspaceKind) => void;
  togglePanel: (side: PanelSide) => void;
  setPanel: (side: PanelSide, visible: boolean) => void;
  showToast: (msg: string, level?: "info" | "success" | "error", ms?: number) => void;
  closeToast: () => void;
  toast?: { msg: string; level: "info" | "success" | "error" };
}

// 初始值：桌面默认侧面板展开；移动端（useEffect 里检测）默认折叠
function initialState(): UIStore {
  const mobile = typeof window !== "undefined" && window.innerWidth < 768;
  return {
    currentWorkspace: "repair",
    panels: {
      left:   { visible: !mobile, width: 280, height: 0 },
      right:  { visible: !mobile, width: 320, height: 0 },
      bottom: { visible: false, width: 0, height: 160 },
    },
    showToast: () => {},
    closeToast: () => {},
  };
}

export const useUIStore = create<UIStore>((set, get) => ({
  ...initialState(),

  setWorkspace: (w) => set({ currentWorkspace: w }),
  togglePanel: (side) => set((s) => ({ panels: { ...s.panels, [side]: { ...s.panels[side], visible: !s.panels[side].visible } } })),
  setPanel: (side, visible) => set((s) => ({ panels: { ...s.panels, [side]: { ...s.panels[side], visible } } })),

  showToast: (msg, level = "info", ms = 2500) => {
    set({ toast: { msg, level } });
    window.setTimeout(() => {
      if (get().toast?.msg === msg) set({ toast: undefined });
    }, ms);
  },
  closeToast: () => set({ toast: undefined }),
}));

// 移动端自动折叠侧面板（组件层 useEffect 挂载时触发）
export function useResponsiveInit() {
  const mobile = useIsMobile();
  const setPanel = useUIStore((s) => s.setPanel);
  if (mobile) {
    setPanel("left", false);
    setPanel("right", false);
  } else {
    setPanel("left", true);
    setPanel("right", true);
  }
}
