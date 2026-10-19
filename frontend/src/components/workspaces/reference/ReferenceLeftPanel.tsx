import { Upload, Trash2, FileAudio } from "lucide-react";
import { useEngineStore } from "../../../stores/engineStore";
import { useUIStore } from "../../../stores/uiStore";
import { analyzeReference } from "../../../api/engine";
import { rootToName } from "../../../utils/music";

/** 拆解台左侧：ImportZone + 历史参考库（占位）。 */
export function ReferenceLeftPanel() {
  const analyzing = useEngineStore((s) => s.analyzing);
  const progress = useEngineStore((s) => s.analyze_progress);
  const result = useEngineStore((s) => s.analyze_result);
  const startAnalyze = useEngineStore((s) => s.startAnalyze);
  const setAnalyzeProgress = useEngineStore((s) => s.setAnalyzeProgress);
  const setAnalyzeResult = useEngineStore((s) => s.setAnalyzeResult);
  const setAnalyzeError = useEngineStore((s) => s.setAnalyzeError);
  const showToast = useUIStore((s) => s.showToast);

  const onFile = async (file: File) => {
    startAnalyze();
    setAnalyzeProgress("解码中…");
    try {
      setAnalyzeProgress("跑全链：beat → key → structure → chord → production_notes…");
      const r = await analyzeReference(file);
      setAnalyzeResult(r);
      showToast(`分析完成 · ${r.bpm} BPM · ${rootToName(r.key, r.mode)} ${r.mode === "major" ? "大调" : "小调"}`, "success", 3000);
    } catch (e: any) {
      setAnalyzeError(e?.message ?? "分析失败");
      showToast(e?.message ?? "分析失败", "error", 4000);
    }
  };

  return (
    <div className="p-3 space-y-4">
      {/* ImportZone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
        className="notion-drag-zone min-h-[96px] flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-notion-border hover:border-notion-accent hover:bg-notion-hover cursor-pointer transition-colors"
        onClick={() => document.getElementById("ref-file-input")?.click()}
      >
        <Upload className="w-4 h-4 text-notion-muted" />
        <div className="text-[12px] text-notion-muted text-center leading-snug px-4">
          拖入参考歌（任意格式）<br />
          <span className="text-[11px]">或点击选择</span>
        </div>
        <input
          id="ref-file-input"
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
        />
      </div>

      {/* 分析状态 */}
      {analyzing && (
        <div className="border border-notion-accent/30 bg-notion-accent/5 rounded-lg px-3 py-2 text-[12px] flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse shrink-0" />
          <span className="text-notion-muted">{progress ?? "分析中…"}</span>
        </div>
      )}

      {/* 最近结果（点击可重新渲染 Center） */}
      {!analyzing && result && (
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-wider text-notion-faint mb-1 px-1">
            最近分析
          </div>
          <div className="rounded-md border border-notion-border hover:bg-notion-hover cursor-pointer px-2 py-1.5 flex gap-2 items-center">
            <FileAudio className="w-3.5 h-3.5 text-notion-muted shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] truncate font-medium">参考 #{result.id.slice(0, 12)}</div>
              <div className="text-[11px] text-notion-muted">
                {result.bpm} BPM · {rootToName(result.key, result.mode)} {result.mode === "major" ? "大调" : "小调"} · {result.duration_s}s
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 历史参考库（占位） */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-notion-faint mb-2 px-1">
          参考库（占位）
        </div>
        <div className="text-[12px] text-notion-faint text-center py-4">
          拆解保存的参考歌会出现在这里
        </div>
      </div>
    </div>
  );
}
