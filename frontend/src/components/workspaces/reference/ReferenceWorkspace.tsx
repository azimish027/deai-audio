import { Disc, Upload, FileAudio } from "lucide-react";
import { useEngineStore } from "../../../stores/engineStore";
import { useProjectStore } from "../../../stores/projectStore";
import { useUIStore } from "../../../stores/uiStore";
import { rootToName } from "../../../utils/music";
import { AnalysisReportView } from "./AnalysisReportView";
import { NextStepCard } from "../_shared/NextStepCard";

/** 拆解台 Center：空 → 拆解中 → 完成 / 失败。 */
export function ReferenceWorkspace() {
  const analyzing = useEngineStore((s) => s.analyzing);
  const result = useEngineStore((s) => s.analyze_result);
  const importChords = useProjectStore((s) => s.importReferenceChords);
  const setProjectCtx = useProjectStore((s) => s.setMusicalContext);
  const showToast = useUIStore((s) => s.showToast);
  const progress = useEngineStore((s) => s.analyze_progress);
  const err = useEngineStore((s) => s.analyze_error);

  if (analyzing && !result) {
    return (
      <div className="h-full flex items-center justify-center flex-col gap-4">
        <div className="w-16 h-16 rounded-2xl bg-notion-hover flex items-center justify-center animate-pulse">
          <Disc className="w-7 h-7 text-notion-muted" />
        </div>
        <div className="text-[14px] font-medium text-notion-text">拆解中…</div>
        <div className="text-[12px] text-notion-faint">{progress ?? "解码音频 → 跑 beat tracking → 调性检测 → 结构分段 → 和弦 chroma"}</div>
        <div className="w-64 h-1 bg-notion-border rounded overflow-hidden">
          <div className="h-full w-1/2 bg-notion-accent animate-pulse" />
        </div>
      </div>
    );
  }

  if (err && !result) {
    return (
      <div className="h-full flex items-center justify-center flex-col gap-3 p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-notion-danger/10 flex items-center justify-center">
          <Upload className="w-6 h-6 text-notion-danger" />
        </div>
        <div className="text-[14px] font-semibold text-notion-danger">拆解失败</div>
        <div className="text-[12px] text-notion-muted max-w-md break-all">{err}</div>
        <div className="text-[11px] text-notion-faint">检查音频格式是否支持 · 后端 /analyze 端点是否可用</div>
      </div>
    );
  }

  if (!result) {
    // ─── 空状态：首次进入拆解台 ─────────────────────────────
    return (
      <div className="h-full flex items-center justify-center flex-col gap-4 p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-notion-hover flex items-center justify-center">
          <FileAudio className="w-7 h-7 text-notion-muted" />
        </div>
        <div>
          <div className="text-[15px] font-semibold text-notion-text">拆解台</div>
          <div className="text-[12px] text-notion-muted mt-1 max-w-sm">
            拖入或点击选择一段参考歌 → 自动识别 BPM、调性、和弦段落、结构分段、混音笔记
          </div>
        </div>
        <div className="flex flex-wrap gap-2 justify-center mt-1">
          <span className="notion-chip">Librosa beat tracking</span>
          <span className="notion-chip">K-S 调性检测</span>
          <span className="notion-chip">Chroma 和弦</span>
          <span className="notion-chip">SSM 分段</span>
        </div>
        <div className="text-[11px] text-notion-faint mt-2">左侧面板有上传入口</div>
      </div>
    );
  }

  // ─── 已有结果 → 展示报告 + 下一步引导 ──────────────────────
  return (
    <div className="h-full overflow-auto p-4 sm:p-6 max-w-[1100px] mx-auto space-y-6">
      <AnalysisReportView result={result} />
      <NextStepCard steps={[
        {
          label: "把和弦注入编曲台时间线",
          hint: `直接生成 ${result.chords.length} 个 chord clip → ${result.bpm} BPM · ${rootToName(result.key, result.mode)} ${result.mode === "major" ? "大调" : "小调"}`,
          target: "compose",
          primary: true,
          onClick: () => {
            if (!result) return;
            setProjectCtx({ bpm: result.bpm, key: result.key, mode: result.mode, time_signature: result.time_signature });
            const n = importChords(result.chords, result.id, result.bpm);
            showToast(`已注入 ${n} 个和弦 clip · ${result.bpm} BPM · ${rootToName(result.key, result.mode)}`, "success", 3000);
          },
        },
        { label: "去学习台看 K-S 调性检测原理", hint: "拆解用到的乐理知识关联卡", target: "learn" },
      ]} />
    </div>
  );
}
