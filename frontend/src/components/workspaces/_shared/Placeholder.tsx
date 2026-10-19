import type { LucideIcon } from "lucide-react";

/** 各空工作区 Center 共用占位。 */
export function Placeholder({ hint, icon: Icon }: { hint: string; icon: LucideIcon }) {
  return (
    <div className="h-full flex items-center justify-center flex-col gap-3">
      <div className="w-14 h-14 rounded-2xl bg-notion-hover flex items-center justify-center">
        <Icon className="w-6 h-6 text-notion-muted" />
      </div>
      <div className="text-[13px] font-medium text-notion-text">{hint}</div>
      <div className="text-[11px] text-notion-faint">
        P0 占位 · 对应阶段实现后替换为 Canvas / Timeline / PianoRoll
      </div>
    </div>
  );
}
