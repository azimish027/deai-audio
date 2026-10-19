/**
 * 编曲台 —— Center / LeftPanel / RightPanel 三件套。
 * Center:    TimelineView（时间线 + clip 方块 + 播放头 RAF）
 * LeftPanel: TrackList（轨道列表 + 调性锁定 + 加/删/改）
 * RightPanel: ComposeRightPanel（和弦生成 + 情绪预设 + 调性摘要）
 */
import { Plus } from "lucide-react";
import { useProjectStore } from "../../../stores/projectStore";
import { rootToName } from "../../../utils/music";
import { TimelineView } from "./TimelineView";

const INSTRUMENT_LABEL: Record<string, string> = {
  drums: "🥁 鼓组", bass: "🎸 贝斯", guitar: "🎸 吉他", keys: "🎹 键盘",
  pad: "🌫️ Pad", lead: "🎵 主音", vocals: "🎤 人声", pluck: "✨ Pluck",
  strings: "🎻 弦乐", fx: "💥 FX", custom: "自定义",
};

/** Center：时间线。 */
export function ComposeWorkspace() {
  return <TimelineView />;
}

/** LeftPanel：轨道列表 + 调性锁定 + 加轨道。 */
export function TrackList() {
  const tracks = useProjectStore((s) => s.tracks);
  const addTrack = useProjectStore((s) => s.addTrack);
  const removeTrack = useProjectStore((s) => s.removeTrack);
  const updateTrack = useProjectStore((s) => s.updateTrack);
  const bpm = useProjectStore((s) => s.musical_context.bpm);
  const key = useProjectStore((s) => s.musical_context.key);
  const mode = useProjectStore((s) => s.musical_context.mode);
  const ctx = useProjectStore((s) => s.musical_context);
  const setCtx = useProjectStore((s) => s.setMusicalContext);

  return (
    <div className="p-3 space-y-4">
      {/* 调性 / BPM 锁定 */}
      <div className="notion-card p-3 space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-notion-faint">调性锁定</div>
        <div className="flex items-center gap-3 text-[12px]">
          <span className="text-notion-muted">Key</span>
          <select
            value={key}
            onChange={(e) => setCtx({ key: Number(e.target.value) })}
            className="bg-notion-hover rounded px-2 py-0.5 text-[12px]"
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i} value={i}>{rootToName(i, mode)}</option>
            ))}
          </select>
          <select
            value={mode}
            onChange={(e) => setCtx({ mode: e.target.value as "major" | "minor" })}
            className="bg-notion-hover rounded px-2 py-0.5 text-[12px]"
          >
            <option value="major">大调</option>
            <option value="minor">小调</option>
          </select>
        </div>
        <div className="flex items-center gap-3 text-[12px]">
          <span className="text-notion-muted">BPM</span>
          <input
            type="number" min={40} max={220}
            value={bpm}
            onChange={(e) => setCtx({ bpm: Number(e.target.value) || 120 })}
            className="bg-notion-hover rounded px-2 py-0.5 text-[12px] w-16"
          />
        </div>
        <div className="text-[11px] text-notion-faint">拍号 {ctx.time_signature[0]}/{ctx.time_signature[1]}</div>
      </div>

      {/* 轨道列表 */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-notion-faint mb-2 px-1 flex items-center justify-between">
          <span>轨道 ({tracks.length})</span>
          <button
            className="flex items-center gap-0.5 text-notion-accent hover:underline text-[11px]"
            onClick={() => addTrack(`轨道 ${tracks.length + 1}`, "custom")}
          >
            <Plus className="w-3 h-3" /> 加轨道
          </button>
        </div>
        {tracks.length === 0 && (
          <div className="text-[12px] text-notion-faint text-center py-3">
            还没有轨道，加一条或从拆解台导入
          </div>
        )}
        <div className="space-y-1">
          {tracks.map((t) => (
            <div key={t.id} className="group rounded-md bg-notion-hover/40 px-2 py-1.5 border border-transparent hover:bg-notion-hover hover:border-notion-border transition-colors">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: t.color }} />
                <div className="flex-1 min-w-0">
                  <input
                    value={t.name}
                    onChange={(e) => updateTrack(t.id, { name: e.target.value })}
                    className="text-[12px] w-full bg-transparent outline-none"
                  />
                  <div className="text-[11px] text-notion-faint">{INSTRUMENT_LABEL[t.instrument] ?? t.instrument}</div>
                </div>
                <input
                  type="range" min={0} max={1} step={0.01}
                  value={t.volume}
                  onChange={(e) => updateTrack(t.id, { volume: Number(e.target.value) })}
                  className="w-12 h-1 accent-notion-accent"
                  title="音量"
                />
                <button
                  onClick={() => removeTrack(t.id)}
                  className="opacity-0 group-hover:opacity-100 text-notion-faint hover:text-notion-danger text-[14px] leading-none"
                  title="删除轨道"
                >×</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const ComposeLeftPanel = TrackList;
