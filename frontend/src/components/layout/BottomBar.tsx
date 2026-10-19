import { useIsMobile } from "../../hooks/useResponsive";
import { useUIStore } from "../../stores/uiStore";
import { Wrench, Disc, Music3, PenTool, GraduationCap } from "lucide-react";
import type { WorkspaceKind } from "../../types/project";

/** BottomBar —— 桌面：Transient 辅助条；移动端：Tab Bar（5 个工作区）。 */
export function BottomBar() {
  const mobile = useIsMobile();
  const ws = useUIStore((s) => s.currentWorkspace);
  const setWs = useUIStore((s) => s.setWorkspace);

  if (mobile) {
    const tabs: { key: WorkspaceKind; label: string; icon: React.ReactNode }[] = [
      { key: "repair",    label: "修复",  icon: <Wrench className="w-5 h-5" /> },
      { key: "reference", label: "拆解",  icon: <Disc className="w-5 h-5" /> },
      { key: "compose",   label: "编曲",  icon: <Music3 className="w-5 h-5" /> },
      { key: "lyric",     label: "词作",  icon: <PenTool className="w-5 h-5" /> },
      { key: "learn",     label: "学习",  icon: <GraduationCap className="w-5 h-5" /> },
    ];
    return (
      <nav className="h-12 border-t border-notion-border bg-notion-bg flex items-center justify-around shrink-0 z-20 pb-[env(safe-area-inset-bottom)]">
        {tabs.map((t) => {
          const active = ws === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setWs(t.key)}
              className={[
                "flex flex-col items-center gap-0.5 h-full flex-1 justify-center transition-colors",
                active ? "text-notion-accent" : "text-notion-muted",
              ].join(" ")}
            >
              {t.icon}
              <span className="text-[10px] leading-none">{t.label}</span>
            </button>
          );
        })}
      </nav>
    );
  }

  // 桌面：Toast 容器 + 后端状态（TopBar 已有）—— 暂放空占位保持高度
  return (
    <footer className="h-6 border-t border-notion-border bg-notion-bg flex items-center justify-between px-4 text-[11px] text-notion-faint shrink-0 z-10">
      <span>DeAI Audio · 0.1.0</span>
      <span className="hidden sm:inline">桌面端体验最佳 · 移动端预览版</span>
    </footer>
  );
}
