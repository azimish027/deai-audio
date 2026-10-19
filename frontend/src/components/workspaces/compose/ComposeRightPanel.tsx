import { Sparkles, Wand2 } from "lucide-react";
import { useProjectStore } from "../../../stores/projectStore";
import { useUIStore } from "../../../stores/uiStore";
import { rootToName } from "../../../utils/music";
import { suggestChords } from "../../../api/engine";

/** 编曲台右侧：和弦建议 + 生成按钮 + 调性摘要。 */
export function ComposeRightPanel() {
  const bpm = useProjectStore((s) => s.musical_context.bpm);
  const key = useProjectStore((s) => s.musical_context.key);
  const mode = useProjectStore((s) => s.musical_context.mode);
  const tracks = useProjectStore((s) => s.tracks);
  const addClip = useProjectStore((s) => s.addClip);
  const addTrack = useProjectStore((s) => s.addTrack);
  const showToast = useUIStore((s) => s.showToast);

  // 预置情绪 → 和弦模板（mock，等后端 suggestChords 接入后替换）
  const MOOD_PRESETS: { mood: string; label: string; emoji: string }[] = [
    { mood: "happy", label: "明亮流行", emoji: "☀️" },
    { mood: "melancholy", label: "忧伤 ballad", emoji: "🌧️" },
    { mood: "tense", label: "紧张电影感", emoji: "🎬" },
    { mood: "chill", label: "Lo-fi 放松", emoji: "🛋️" },
  ];

  const progressPreset = async (mood: string) => {
    // mock 和弦模板（按情绪 + 调性偏移）
    const offset = key;
    const quality = mode === "minor" ? "min" : "maj";
    const rootOffsets: Record<string, number[]> = {
      happy:      [0, 5, 7, 4],               // I-IV-V-IV
      melancholy: [0, 3, 7, 5],               // i-IV-VI-III (minor)
      tense:      [0, 1, 7, 6],
      chill:      [0, 5, 7, 3, 4, 0, 7, 4],
    };
    const roots = rootOffsets[mood] ?? rootOffsets.happy;
    // 调式修正（小调 → iii 是 maj）
    const chordEvents = roots.map((r, i) => ({
      start_beat: i * 4,
      duration: 4,
      root: (r + offset) % 12,
      quality: (mode === "minor" && [4, 5].includes(i)) ? "maj" as const : quality as any,
      function_label: ["I", "IV", "V", "III", "IV", "I", "V", "IV"][i] ?? String(i + 1),
    }));

    // 加 chord 轨 → 加 chord clip
    let chordTrack = tracks.find((t) => t.instrument === "pad");
    if (!chordTrack) {
      chordTrack = { id: addTrack("和弦 Pad", "pad") } as any;
    }
    addClip(chordTrack.id, 0, { kind: "chord", events: chordEvents }, { origin: "generated", provenance: { model: "preset", prompt: mood } });
    showToast(`已生成 ${mood} 和弦进行（${chordEvents.length} 小节）`, "success", 2500);
  };

  return (
    <div className="p-3 space-y-4">
      {/* 生成按钮 */}
      <div className="notion-card p-3 space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-notion-faint">快速生成</div>
        <button
          onClick={async () => {
            // 等后端 suggestChords 真接，现在先用 preset
            const result = await suggestChords({ mood }, mode);
            void result;
            await progressPreset("happy");
          }}
          className="notion-btn-primary w-full justify-center !py-2 text-[13px]"
        >
          <Sparkles className="w-3.5 h-3.5" /> 一键出和弦
        </button>
      </div>

      {/* 情绪预设 */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-notion-faint mb-2 px-1">情绪预设</div>
        <div className="grid grid-cols-2 gap-1.5">
          {MOOD_PRESETS.map((p) => (
            <button
              key={p.mood}
              onClick={() => progressPreset(p.mood)}
              className="rounded-md border border-notion-border hover:border-notion-accent hover:bg-notion-hover px-2 py-1.5 text-[12px] flex items-center gap-1.5 transition-colors"
            >
              <span>{p.emoji}</span>
              <span className="truncate">{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 调性摘要 */}
      <div className="notion-card p-3 space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-notion-faint">当前调性</div>
        <div className="flex items-baseline gap-3">
          <div className="text-[24px] font-bold">
            {rootToName(key, mode)}<span className="text-[14px] text-notion-muted ml-1">{mode === "major" ? "大调" : "小调"}</span>
          </div>
        </div>
        <div className="text-[12px] text-notion-muted">
          BPM <span className="font-mono text-notion-text">{bpm}</span> · 拍号 4/4
        </div>
      </div>

      {/* 编曲进度 */}
      <div className="notion-card p-3 space-y-1.5">
        <div className="text-[11px] uppercase tracking-wider text-notion-faint">编曲进度</div>
        <StatRow label="轨道数" value={tracks.length.toString()} />
        <StatRow label="总 clips" value={tracks.reduce((s, t) => s + t.clips.length, 0).toString()} />
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline text-[12px]">
      <span className="text-notion-muted">{label}</span>
      <span className="font-mono text-notion-text">{value}</span>
    </div>
  );
}

export { Wand2 };
