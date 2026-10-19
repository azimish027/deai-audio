import { Clock, Tag } from "lucide-react";
import type { SegmentInfo } from "../stores/sessionStore";

const sceneLabelMap: Record<string, { zh: string; color: string }> = {
  monologue:   { zh: "独白", color: "bg-[var(--scene-monologue-bg)] text-[var(--scene-monologue-fg)]" },
  dialogue:    { zh: "对话", color: "bg-[var(--scene-dialogue-bg)] text-[var(--scene-dialogue-fg)]" },
  music:       { zh: "音乐", color: "bg-[var(--scene-music-bg)] text-[var(--scene-music-fg)]" },
  ambience:    { zh: "环境", color: "bg-[var(--scene-ambience-bg)] text-[var(--scene-ambience-fg)]" },
  sfx:         { zh: "音效", color: "bg-[var(--scene-sfx-bg)] text-[var(--scene-sfx-fg)]" },
};

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function SegmentList({ segments }: { segments: SegmentInfo[] }) {
  const total = segments.reduce((a, b) => a + (b.end_s - b.start_s), 0);

  return (
    <div className="notion-card">
      <div className="px-4 py-3 border-b border-notion-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-notion-muted" />
          <span className="text-[13px] font-medium">分段</span>
        </div>
        <div className="text-[11px] text-notion-faint">
          {segments.length} 段 · 合计 {fmtTime(total)}
        </div>
      </div>

      <div className="divide-y divide-notion-border">
        {segments.map((seg, i) => {
          const meta = sceneLabelMap[seg.scene_label] ?? { zh: seg.scene_label, color: "bg-notion-panel text-notion-muted" };
          const dur = seg.end_s - seg.start_s;
          return (
            <div
              key={i}
              className="px-4 py-2.5 flex items-center justify-between hover:bg-notion-panel/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-[11px] text-notion-faint w-6 text-right">{i + 1}</span>
                <span className="text-[12px] font-mono text-notion-muted w-24">
                  {fmtTime(seg.start_s)} – {fmtTime(seg.end_s)}
                </span>
                <span className={`notion-chip ${meta.color} border-transparent`}>
                  {meta.zh}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-notion-faint">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {dur.toFixed(1)}s
                </span>
                <div className="flex items-center gap-1">
                  <span className="inline-block w-8 h-1 bg-notion-border rounded-full overflow-hidden">
                    <span
                      className="block h-full bg-notion-accent"
                      style={{ width: `${seg.confidence * 100}%` }}
                    />
                  </span>
                  <span>{Math.round(seg.confidence * 100)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
