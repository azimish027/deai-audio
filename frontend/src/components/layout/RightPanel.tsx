import { PanelRightClose, PanelRight } from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import { useIsMobile } from "../../hooks/useResponsive";
import { RepairRightPanel } from "../workspaces/repair/RepairRightPanel";
import { ComposeRightPanel } from "../workspaces/compose/ComposeRightPanel";
import { EmptyRightPanel } from "../workspaces/_shared/EmptyRightPanel";

/** 右侧面板路由 —— 按 currentWorkspace 分发 + 移动端变抽屉。 */
export function RightPanel() {
  const { panels, togglePanel, currentWorkspace } = useUIStore();
  const visible = panels.right.visible;
  const mobile = useIsMobile();

  let content: React.ReactNode;
  switch (currentWorkspace) {
    case "repair":    content = <RepairRightPanel />; break;
    case "compose":   content = <ComposeRightPanel />; break;
    default:          content = <EmptyRightPanel workspace={currentWorkspace} />;
  }

  if (!visible) {
    return (
      <div className="w-8 border-l border-notion-border bg-notion-bg flex flex-col items-center pt-2 gap-1 shrink-0 z-10">
        <button className="icon-btn" onClick={() => togglePanel("right")} title="展开右侧面板">
          <PanelRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  if (mobile) {
    return (
      <>
        <div
          className="fixed inset-0 bg-black/40 z-30"
          onClick={() => togglePanel("right")}
        />
        <aside
          className="fixed top-12 right-0 bottom-12 w-[85vw] max-w-[320px] border-l border-notion-border bg-notion-bg z-40 flex flex-col shadow-xl"
        >
          <div className="h-9 border-b border-notion-border flex items-center justify-between px-3 shrink-0">
            <span className="text-[12px] font-medium text-notion-muted uppercase tracking-wider">面板</span>
            <button className="icon-btn" onClick={() => togglePanel("right")} title="折叠">
              <PanelRightClose className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-auto">{content}</div>
        </aside>
      </>
    );
  }

  return (
    <aside
      className="border-l border-notion-border bg-notion-bg flex flex-col shrink-0 overflow-hidden z-10"
      style={{ width: panels.right.width }}
    >
      <div className="h-9 border-b border-notion-border flex items-center justify-between px-3">
        <span className="text-[12px] font-medium text-notion-muted uppercase tracking-wider">面板</span>
        <button className="icon-btn" onClick={() => togglePanel("right")} title="折叠">
          <PanelRightClose className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-auto">{content}</div>
    </aside>
  );
}
