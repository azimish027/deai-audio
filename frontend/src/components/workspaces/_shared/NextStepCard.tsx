/**
 * NextStepCard —— 下一步引导卡。
 *
 * 依据 PRODUCT-PLAN-v1.md §5 每个核心操作闭环的最后一步。
 * 铁律：纯展示组件，通过 onClick 回调触发操作，不依赖任何 store。
 */
import { ArrowRight, Sparkles, FileAudio, Music, PenLine, BookOpen, Download } from "lucide-react";
import { useUIStore } from "../../../stores/uiStore";

export type NextStep = {
  label: string;
  hint: string;
  target?: "reference" | "compose" | "lyric" | "learn" | "repair";  // 切换到哪个workspace
  onClick?: () => void;                                            // 自定义回调
  primary?: boolean;                                               // 是否高亮为主推
};

const iconMap = {
  reference: FileAudio,
  compose: Music,
  lyric: PenLine,
  learn: BookOpen,
  repair: Sparkles,
} as const;

export function NextStepCard({ steps, title = "接下来可以 →" }: { steps: NextStep[]; title?: string }) {
  const setWorkspace = useUIStore((s) => s.setWorkspace);

  if (steps.length === 0) return null;

  return (
    <div className="notion-card p-3 space-y-2">
      <div className="text-[11px] uppercase tracking-wider text-notion-faint">{title}</div>
      {steps.map((s, i) => {
        const Icon = s.target ? iconMap[s.target] : Download;
        const primaryCls = s.primary ? "border-notion-accent/30 bg-notion-accent/5" : "border-notion-border bg-notion-hover/40 hover:bg-notion-hover";
        return (
          <button
            key={i}
            onClick={() => {
              if (s.target) setWorkspace(s.target);
              s.onClick?.();
            }}
            className={`w-full text-left rounded-md border px-3 py-2 transition-colors flex items-center gap-2 ${primaryCls}`}
          >
            <Icon className={`w-3.5 h-3.5 shrink-0 ${s.primary ? "text-notion-accent" : "text-notion-muted"}`} />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium truncate">{s.label}</div>
              <div className="text-[11px] text-notion-muted truncate">{s.hint}</div>
            </div>
            <ArrowRight className="w-3 h-3 text-notion-faint shrink-0" />
          </button>
        );
      })}
    </div>
  );
}
