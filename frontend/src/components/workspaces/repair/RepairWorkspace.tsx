import { AudioLines, Upload, Zap } from "lucide-react";
import { WaveformPlayer } from "../../WaveformPlayer";
import { SegmentList } from "../../SegmentList";
import { ExportBar } from "../../ExportBar";
import { useEngineStore } from "../../../stores/engineStore";
import { useUIStore } from "../../../stores/uiStore";
import { NextStepCard } from "../_shared/NextStepCard";

/** 修复台 Center：空状态 → 处理中 → 完成。 */
export function RepairWorkspace() {
  const selected_id = useEngineStore((s) => s.selected_session_id);
  const sess = useEngineStore((s) => s.repair_sessions.find((x) => x.session_id === selected_id));
  const setWs = useUIStore((s) => s.setWorkspace);

  // ─── 空状态：没有选中的会话 ──────────────────────────────────
  if (!sess) {
    return <EmptyRepairState onNavigate={(w) => setWs(w)} />;
  }

  // ─── 处理中：骨架屏 ─────────────────────────────────────────
  if (sess.status === "processing" || sess.status === "uploading") {
    return <RepairLoadingState progress={sess.progress_text} />;
  }

  // ─── 错误状态 ───────────────────────────────────────────────
  if (sess.status === "error") {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-6">
        <div className="w-14 h-14 rounded-2xl bg-notion-danger/10 flex items-center justify-center">
          <Upload className="w-6 h-6 text-notion-danger" />
        </div>
        <div className="text-[14px] font-semibold text-notion-danger">修复失败</div>
        <div className="text-[12px] text-notion-muted max-w-md break-all">{sess.error ?? "未知错误"}</div>
        <div className="text-[11px] text-notion-faint mt-1">检查后端是否在 http://127.0.0.1:8765 运行</div>
      </div>
    );
  }

  // ─── 已处理完成 ─────────────────────────────────────────────
  const isDone = sess.status === "done";

  return (
    <div className="h-full overflow-auto p-4 sm:p-6 max-w-[1200px] mx-auto">
      {/* 波形 */}
      <WaveformPlayer
        inputUrl={sess.audio_url} altUrl={sess.processed_url}
        disabled={!isDone}
      />

      {/* 分段 + 导出 + 引导 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2 space-y-4">
          <SegmentList segments={sess.segments.map((s) => ({
            start_s: s.start_s,
            end_s: s.end_s,
            scene_label: s.scene_label,
            confidence: s.confidence,
          }))} />
          {isDone && Object.keys(sess.exports).length > 0 && (
            <ExportBar exports={sess.exports} />
          )}
          {/* 下一步引导 */}
          {isDone && (
            <div className="hidden lg:block">
              <NextStepCard steps={[
                { label: "去拆解台分析和弦/调性", hint: "上传同一段音频，自动跑 beat tracking + K-S 调性检测", target: "reference", primary: true },
                { label: "继续修复另一段", hint: "从左侧面板新建会话", target: "repair" },
              ]} />
            </div>
          )}
        </div>
        <div className="hidden lg:block text-[12px] text-notion-faint pt-1">
          诊断详情在右侧面板
        </div>
      </div>

      {/* 移动端底部引导 */}
      {isDone && (
        <div className="lg:hidden mt-4">
          <NextStepCard steps={[
            { label: "去拆解台", hint: "下一步：分析和弦/调性", target: "reference", primary: true },
          ]} />
        </div>
      )}
    </div>
  );
}

/** 首次进入修复台的空状态引导。 */
function EmptyRepairState({ onNavigate }: { onNavigate: (w: "repair" | "reference" | "learn") => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-notion-hover flex items-center justify-center">
        <AudioLines className="w-7 h-7 text-notion-muted" />
      </div>
      <div>
        <div className="text-[15px] font-semibold text-notion-text">从这里开始</div>
        <div className="text-[12px] text-notion-muted mt-1 max-w-sm">
          拖入或点击选择一段需要修复的音频，右侧面板选模板 → 一键消除机械感、消削波、修瞬态
        </div>
      </div>
      <div className="flex flex-wrap gap-2 justify-center mt-1">
        <span className="notion-chip">支持 WAV</span>
        <span className="notion-chip">MP3</span>
        <span className="notion-chip">M4A</span>
        <span className="notion-chip">FLAC</span>
      </div>
      <div className="text-[11px] text-notion-faint mt-2">
        左侧面板有上传入口 · 或 <button className="text-notion-accent underline" onClick={() => onNavigate("learn")}>去学习台</button> 了解修复原理
      </div>
    </div>
  );
}

/** 处理中的骨架屏。 */
function RepairLoadingState({ progress }: { progress?: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-notion-hover flex items-center justify-center animate-pulse">
        <Zap className="w-7 h-7 text-notion-accent" />
      </div>
      <div className="text-[14px] font-medium text-notion-text">修复处理中…</div>
      {progress && <div className="text-[12px] text-notion-muted">{progress}</div>}
      <div className="text-[11px] text-notion-faint">Pipeline：DC → declip → deverb → separate → denoise → pitch → transient → normalize</div>
      <div className="w-64 h-1 bg-notion-border rounded overflow-hidden">
        <div className="h-full w-1/3 bg-notion-accent animate-pulse" />
      </div>
    </div>
  );
}

// lint-friendly 未使用
