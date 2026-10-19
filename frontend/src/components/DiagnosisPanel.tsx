import { Eye, EyeOff, Gauge, Activity, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { DiagnosisInfo } from "../stores/sessionStore";

export function DiagnosisPanel({
  info, show, onToggle,
}: {
  info: DiagnosisInfo; show: boolean; onToggle: () => void;
}) {
  const phaseHealth = (() => {
    const e = info.phase_entropy;
    if (e >= 0.75) return { label: "自然", color: "text-notion-success", ratio: 1 };
    if (e >= 0.55) return { label: "轻度机械感", color: "text-[var(--color-warning)]", ratio: 0.7 };
    return { label: "强声码器残留", color: "text-notion-danger", ratio: 0.35 };
  })();

  const damageMap: Record<string, string> = {
    vocoder_residual: "声码器残留",
    over_compression: "过压缩瞬态",
    lossy_codec: "有损转码",
    training_data_artifact: "训练数据伪影",
    mixed: "混合",
  };

  const entropyPct = Math.round(info.phase_entropy * 100);

  return (
    <div className="notion-card">
      <button
        className="w-full flex items-center justify-between px-4 py-3 border-b border-notion-border hover:bg-notion-hover rounded-t-md"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-notion-muted" />
          <span className="text-[13px] font-medium">诊断分型</span>
        </div>
        {show ? (
          <Eye className="w-3.5 h-3.5 text-notion-faint" />
        ) : (
          <EyeOff className="w-3.5 h-3.5 text-notion-faint" />
        )}
      </button>

      {show && (
        <div className="p-4 space-y-4 text-[12px]">
          {/* 相位熵 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-notion-muted">相位熵</span>
              <span className={`font-medium ${phaseHealth.color}`}>{phaseHealth.label}</span>
            </div>
            <div className="h-1.5 bg-notion-panel rounded-full overflow-hidden">
              <div
                className="h-full bg-notion-accent rounded-full transition-all"
                style={{ width: `${entropyPct}%` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-[11px] text-notion-faint">
              <span>0</span><span>0.55</span><span>0.75</span><span>1.0</span>
            </div>
          </div>

          {/* 瞬态亏损 */}
          <div className="flex items-center justify-between">
            <span className="text-notion-muted flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5" /> 瞬态亏损
            </span>
            <span className={`font-mono ${info.transient_deficit_db > 3 ? "text-notion-danger" : "text-notion-success"}`}>
              {info.transient_deficit_db.toFixed(2)} dB
            </span>
          </div>

          {/* 损伤类型 */}
          <div className="pt-2 border-t border-notion-border">
            <div className="text-notion-muted mb-1.5">主要损伤类型</div>
            <div className="flex items-center gap-2">
              {info.clipping_detected ? (
                <AlertTriangle className="w-3.5 h-3.5 text-notion-danger" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-notion-success" />
              )}
              <span className="text-[13px]">{damageMap[info.dominant_damage_type] ?? info.dominant_damage_type}</span>
            </div>
            {info.clipping_detected && (
              <div className="text-[11px] text-notion-faint mt-1">检测到削波，已尝试稀疏重建修复</div>
            )}
          </div>

          {/* 扩展指标 */}
          {(info.hnr_db ?? 0) > 0 && (
            <div className="pt-2 border-t border-notion-border grid grid-cols-2 gap-2 text-[11px]">
              <MetricRow label="HNR" value={`${info.hnr_db!.toFixed(1)} dB`} />
              <MetricRow label="棋盘比" value={(info.checkerboard_ratio ?? 0).toFixed(2)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between bg-notion-panel/50 rounded px-2 py-1">
      <span className="text-notion-muted">{label}</span>
      <span className="font-mono text-notion-text">{value}</span>
    </div>
  );
}
