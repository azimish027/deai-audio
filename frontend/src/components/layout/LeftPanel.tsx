import { PanelLeftClose, PanelLeft } from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import { useIsMobile } from "../../hooks/useResponsive";
import { RepairLeftPanel } from "../workspaces/repair/RepairLeftPanel";
import { ReferenceLeftPanel } from "../workspaces/reference/ReferenceLeftPanel";
import { ComposeLeftPanel } from "../workspaces/compose/ComposeWorkspace";
import { LyricLeftPanel } from "../workspaces/lyric/LyricWorkspace";
import { LearnLeftPanel } from "../workspaces/learn/LearnWorkspace";

export function LeftPanel() {
  const { panels, togglePanel, currentWorkspace } = useUIStore();
  const visible = panels.left.visible;
  const mobile = useIsMobile();

  const content = (() => {
    switch (currentWorkspace) {
      case "repair":    return <RepairLeftPanel />;
      case "reference": return <ReferenceLeftPanel />;
      case "compose":   return <ComposeLeftPanel />;
      case "lyric":     return <LyricLeftPanel />;
      case "learn":     return <LearnLeftPanel />;
    }
  })();

  // ===== 折叠态（桌面 & 移动端通用）=====
  if (!visible) {
    return (
      <div className="w-8 border-r border-notion-border bg-notion-bg flex flex-col items-center pt-2 gap-1 shrink-0 z-10">
        <button className="icon-btn" onClick={() => togglePanel("left")} title="展开左侧面板">
          <PanelLeft className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // ===== 移动端：抽屉 overlay =====
  if (mobile) {
    return (
      <>
        {/* 点击遮罩关闭 */}
        <div
          className="fixed inset-0 bg-black/40 z-30"
          onClick={() => togglePanel("left")}
        />
        <aside
          className="fixed top-12 left-0 bottom-12 w-[85vw] max-w-[320px] border-r border-notion-border bg-notion-bg z-40 flex flex-col shadow-xl animate-[slideIn_.2s_ease-out]"
        >
          <div className="h-9 border-b border-notion-border flex items-center justify-between px-3 shrink-0">
            <span className="text-[12px] font-medium text-notion-muted uppercase tracking-wider">面板</span>
            <button className="icon-btn" onClick={() => togglePanel("left")} title="折叠">
              <PanelLeftClose className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-auto">{content}</div>
        </aside>
      </>
    );
  }

  // ===== 桌面：固定侧栏 =====
  return (
    <aside
      className="border-r border-notion-border bg-notion-bg flex flex-col shrink-0 overflow-hidden z-10"
      style={{ width: panels.left.width }}
    >
      <div className="h-9 border-b border-notion-border flex items-center justify-between px-3">
        <span className="text-[12px] font-medium text-notion-muted uppercase tracking-wider">面板</span>
        <button className="icon-btn" onClick={() => togglePanel("left")} title="折叠">
          <PanelLeftClose className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-auto">{content}</div>
    </aside>
  );
}
