import { ArrowRight, Check, AlertTriangle } from "lucide-react";
import { useProjectStore } from "../../../stores/projectStore";
import { useUIStore } from "../../../stores/uiStore";
import { v4 as uuid } from "uuid";
import type { ReferenceAnalysisResult } from "../../../api/engine";
import { rootToName, qualityLabel, sectionColor } from "../../../utils/music";

/** 拆解台核心：结构图色块 + 和弦条 + 生产笔记 + 置信度 badge + 发送到编曲台。 */
export function AnalysisReportView({ result }: { result: ReferenceAnalysisResult }) {
  const addTrack = useProjectStore((s) => s.addTrack);
  const addClip = useProjectStore((s) => s.addClip);
  const setCtx = useProjectStore((s) => s.setMusicalContext);
  const showToast = useUIStore((s) => s.showToast);

  const sendToCompose = () => {
    // 1. 把分析的调性/BPM 写入项目 MusicalContext
    setCtx({ bpm: result.bpm, key: result.key, mode: result.mode, time_signature: result.time_signature as any });

    // 2. 生成 chord track + chord clip
    const trackId = addTrack(`参考 ${rootToName(result.key, result.mode)} ${result.mode === "major" ? "大调" : "小调"}`, "pad");
    addClip(
      trackId,
      0,
      {
        kind: "chord",
        events: result.chords.map((c, i) => ({
          start_beat: i * (c.duration || 4),
          duration: c.duration || 4,
          root: c.root,
          quality: c.quality as any,
          function_label: (c as any).function_label,
        })),
      },
      { origin: "reference", provenance: { source_ref: result.id, engine: "reference/analyzer" } },
    );

    // 3. 把生产笔记存进 recipes（作为 mock recipe）
    useProjectStore.getState().addRecipe({
      id: uuid(),
      name: `参考配方 · ${rootToName(result.key, result.mode)} ${Math.round(result.bpm)} BPM`,
      tags: ["reference", result.mode, `${Math.round(result.bpm)} BPM`],
      chord_progression: result.chords as any,
      rhythm: { grid: [[0]], bpm: result.bpm, time_signature: result.time_signature as any },
      arrangement_template: [],
      sound_palette: [],
      mixing_notes: result.production_notes as any,
      applicable_context: { genre: [], mood: [], bpm_range: [result.bpm - 10, result.bpm + 10] },
      provenance: { source_ref: result.id, engine: "reference/analyzer" },
    });

    showToast(`已发送到编曲台 · ${result.chords.length} 小节和弦 + ${result.production_notes.length} 条生产笔记`, "success", 3000);
    // 自动切到编曲台
    useUIStore.getState().setWorkspace("compose");
  };

  return (
    <div className="space-y-6">
      {/* ====== Header + 发送按钮 ====== */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <HeaderStrip result={result} />
        <button
          onClick={sendToCompose}
          className="notion-btn-primary !py-2 text-[13px] shrink-0"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          发送到编曲台
        </button>
      </div>

      {/* ====== 结构图：按时长比例渲染色块 ====== */}
      <StructureBar result={result} />

      {/* ====== 和弦行 ====== */}
      {result.chords.length > 0 && <ChordStrip result={result} />}

      {/* ====== 置信度 ====== */}
      <ConfidenceGrid confidence={result.confidence} />

      {/* ====== 生产笔记 ====== */}
      {result.production_notes.length > 0 && <ProductionNoteBlock notes={result.production_notes} />}
    </div>
  );
}

// ---------- Header ----------

function HeaderStrip({ result }: { result: ReferenceAnalysisResult }) {
  return (
    <div className="flex flex-wrap items-baseline gap-6 pt-2">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-notion-faint">BPM</div>
        <div className="text-[28px] font-bold tabular-nums">{result.bpm}</div>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-notion-faint">调性</div>
        <div className="text-[22px] font-semibold tabular-nums">
          {rootToName(result.key, result.mode)}
          <span className="ml-1 text-notion-muted text-[14px] font-normal">
            {result.mode === "major" ? "大调" : "小调"}
          </span>
        </div>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-notion-faint">拍号</div>
        <div className="text-[20px] font-semibold">{result.time_signature[0]}/{result.time_signature[1]}</div>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-notion-faint">时长</div>
        <div className="text-[20px] font-semibold tabular-nums">{result.duration_s}s</div>
      </div>
    </div>
  );
}

// ---------- 结构图色块 ----------

function StructureBar({ result }: { result: ReferenceAnalysisResult }) {
  const totalEnd = Math.max(...result.structure.map((s) => s.end_s), result.duration_s);

  return (
    <section>
      <h3 className="text-[12px] font-medium text-notion-muted uppercase tracking-wider mb-2">结构</h3>
      <div
        className="notion-card p-3 space-y-2"
        style={{ minHeight: 64 }}
      >
        <div className="w-full flex h-10 rounded overflow-hidden border border-notion-border">
          {result.structure.map((s, i) => {
            const widthPct = ((s.end_s - s.start_s) / totalEnd) * 100;
            return (
              <div
                key={i}
                title={`${s.label} · ${s.start_s.toFixed(1)}s → ${s.end_s.toFixed(1)}s (置信度 ${(s.confidence * 100).toFixed(0)}%)`}
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: sectionColor(s.label),
                  minWidth: widthPct < 2 ? 24 : undefined,
                }}
                className="relative flex items-center justify-center text-[11px] font-medium text-white/90 shrink-0"
              >
                {widthPct >= 6 && s.label}
              </div>
            );
          })}
        </div>
        {/* 图例 */}
        <div className="flex flex-wrap gap-3 pt-1">
          {Array.from(new Set(result.structure.map((s) => s.label))).map((label) => (
            <div key={label} className="flex items-center gap-1.5 text-[11px] text-notion-muted">
              <span className="w-3 h-3 rounded" style={{ backgroundColor: sectionColor(label) }} />
              {label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- 和弦条 ----------

function ChordStrip({ result }: { result: ReferenceAnalysisResult }) {
  const widthPx = 800;
  const beatSpan = result.chords.length ? result.chords[result.chords.length - 1].start_beat + (result.chords[0]?.duration ?? 4) : 0;

  return (
    <section>
      <h3 className="text-[12px] font-medium text-notion-muted uppercase tracking-wider mb-2">和弦进行</h3>
      <div className="notion-card p-3 overflow-x-auto">
        <div className="relative" style={{ width: beatSpan ? `${(beatSpan / 4) * 120}px` : "100%", minWidth: 400 }}>
          {/* 小节网格 */}
          <div className="absolute inset-0 flex pointer-events-none">
            {result.chords.map((_, i) => (
              <div key={i} className="flex-1 border-r border-notion-border last:border-0 h-full" />
            ))}
          </div>
          {/* 和弦 label */}
          <div className="relative flex">
            {result.chords.map((c, i) => (
              <div key={i} className="flex-1 text-center py-2 text-[13px] font-medium">
                <span className="text-notion-text">{rootToName(c.root, result.mode)}{qualityLabel(c.quality)}</span>
                {c.function_label && (
                  <span className="ml-1 text-[11px] text-notion-faint">{c.function_label}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- 置信度 grid ----------

function ConfidenceGrid({ confidence }: { confidence: Record<string, number> }) {
  const rows: { k: string; label: string }[] = [
    { k: "bpm", label: "BPM" },
    { k: "key", label: "调性" },
    { k: "chords", label: "和弦" },
    { k: "structure", label: "结构" },
  ];

  return (
    <section>
      <h3 className="text-[12px] font-medium text-notion-muted uppercase tracking-wider mb-2">识别置信度</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {rows.map(({ k, label }) => {
          const v = confidence[k] ?? 0;
          return <ConfidenceBadge key={k} label={label} value={v} />;
        })}
      </div>
    </section>
  );
}

function ConfidenceBadge({ label, value }: { label: string; value: number }) {
  const high = value >= 0.7;
  const mid = value >= 0.4 && value < 0.7;
  return (
    <div className="notion-card p-2.5 flex items-center gap-2">
      {high ? (
        <Check className="w-3.5 h-3.5 text-notion-success shrink-0" />
      ) : mid ? (
        <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
      ) : (
        <AlertTriangle className="w-3.5 h-3.5 text-notion-danger shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-notion-muted">{label}</div>
        <div className="text-[12px] font-medium tabular-nums">{(value * 100).toFixed(0)}%</div>
      </div>
      {/* 进度条 */}
      <div className="w-12 h-1.5 bg-notion-hover rounded overflow-hidden shrink-0">
        <div
          className={[
            "h-full",
            high ? "bg-notion-success" : mid ? "bg-yellow-500" : "bg-notion-danger",
          ].join(" ")}
          style={{ width: `${value * 100}%` }}
        />
      </div>
    </div>
  );
}

// ---------- 生产笔记 ----------

function ProductionNoteBlock({ notes }: { notes: { key: string; value: string; evidence?: string; confidence?: number }[] }) {
  return (
    <section>
      <h3 className="text-[12px] font-medium text-notion-muted uppercase tracking-wider mb-2">生产笔记</h3>
      <div className="notion-card p-3 space-y-2">
        {notes.map((n, i) => (
          <div key={i} className="flex justify-between items-baseline gap-4 text-[12px]">
            <span className="text-notion-muted shrink-0">{formatKey(n.key)}</span>
            <span className="font-mono text-notion-text text-right break-all">{n.value}</span>
            {n.confidence != null && (
              <span className="text-[11px] text-notion-faint shrink-0">· {(n.confidence * 100).toFixed(0)}%</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function formatKey(k: string): string {
  const map: Record<string, string> = {
    rms_level: "RMS 电平",
    peak: "峰值",
    stereo_width: "立体声宽度",
    dynamic_range: "动态范围",
    sample_rate: "采样率",
    duration: "时长",
  };
  return map[k] ?? k;
}
