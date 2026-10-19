import { useUIStore } from "../../../stores/uiStore";

/** 其他工作区的空 RightPanel —— 显示选中对象状态或占位。 */
export function EmptyRightPanel({ workspace }: { workspace: string }) {
  return (
    <div className="p-4 text-[12px] text-notion-faint text-center space-y-2">
      <div>RightPanel · {workspace}</div>
      <div className="text-[11px]">Inspector / ChordSuggestion / TheoryCard 等 — 对应工作区实现后填充</div>
    </div>
  );
}
