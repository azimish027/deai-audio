import { Wrench, Disc, Music, PenTool, GraduationCap } from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import type { WorkspaceKind } from "../../types/project";

const ITEMS: { id: WorkspaceKind; label: string; Icon: typeof Wrench; hint?: string }[] = [
  { id: "repair",    label: "修复台",   Icon: Wrench,        hint: "一键去 AI 化" },
  { id: "reference", label: "拆解台",   Icon: Disc,          hint: "拆解参考歌"   },
  { id: "compose",   label: "编曲台",   Icon: Music,         hint: "轨道 + 和弦"  },
  { id: "lyric",     label: "词作台",   Icon: PenTool,       hint: "音节对齐"     },
  { id: "learn",     label: "学习台",   Icon: GraduationCap, hint: "乐理卡片"     },
];

export function WorkspaceSwitcher() {
  const current = useUIStore((s) => s.currentWorkspace);
  const setWorkspace = useUIStore((s) => s.setWorkspace);

  return (
    <div className="flex items-center gap-0.5 bg-notion-hover rounded-lg p-0.5">
      {ITEMS.map(({ id, label, Icon }) => {
        const active = current === id;
        return (
          <button
            key={id}
            onClick={() => setWorkspace(id)}
            className={[
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors",
              active
                ? "bg-notion-bg text-notion-text shadow-sm"
                : "text-notion-muted hover:text-notion-text hover:bg-notion-hover-hover",
            ].join(" ")}
            title={ITEMS.find((i) => i.id === id)?.hint}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
