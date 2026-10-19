import { Sparkles, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useEngineStore } from "../../../stores/engineStore";
import { useUIStore } from "../../../stores/uiStore";
import { TemplateSelector } from "../../TemplateSelector";
import { listTemplates, processSession, type SessionResult } from "../../../api/engine";

/** 修复台右侧：模板选择器 + 一键变可听 + 诊断面板。 */
export function RepairRightPanel() {
  const selected_id = useEngineStore((s) => s.selected_session_id);
  const sess = useEngineStore((s) => s.repair_sessions.find((x) => x.session_id === selected_id));
  const setRepairStatus = useEngineStore((s) => s.setRepairStatus);
  const setRepairResult = useEngineStore((s) => s.setRepairResult);
  const setRepairError = useEngineStore((s) => s.setRepairError);
  const showToast = useUIStore((s) => s.showToast);

  const [templates, setTemplates] = useState<{ id: string; name_zh: string; params: Record<string, unknown> }[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("studio_vocal");

  useEffect(() => {
    listTemplates().then(setTemplates).catch(() => setTemplates([]));
  }, []);

  if (!sess) {
    return (
      <div className="p-4 text-[12px] text-notion-faint text-center">
        从左侧选择或新建一个修复会话，这里会显示诊断和模板选项
      </div>
    );
  }

  const runRepair = async () => {
    if (sess.status === "processing") return;
    setRepairStatus(sess.session_id, "processing", "正在理解音频结构…");

    try {
      // blob: URL → File → EngineClient.processSession → /api/process（真跑完整 Pipeline）
      const resp = await fetch(sess.audio_url);
      const blob = await resp.blob();
      const file = new File([blob], sess.input_name, { type: "audio/wav" });
      const result: SessionResult = await processSession(file, selectedTemplate);

      // 处理后波形：fetch /api/session/{backend_session_id}/waveform → blob_url
      let processed_url: string | undefined;
      try {
        const wf = await fetch(`/api/session/${result.session_id}/waveform`);
        if (wf.ok) processed_url = URL.createObjectURL(await wf.blob());
      } catch { /* waveform 端点未就绪时忽略 */ }

      // exports：后端返回的本地路径没用 → 替换成可下载的 /api/export URL
      const exports_clean: Record<string, string> = {};
      for (const [fmt] of Object.entries(result.exports)) {
        exports_clean[fmt] = `/api/export/${result.session_id}/${fmt}`;
      }

      setRepairResult(sess.session_id, {
        session_id: sess.session_id,           // 保留前端 uuid
        template_id: result.template_id,
        input_path: sess.input_path,
        input_name: sess.input_name,
        state: result.state,
        diagnosis: result.diagnosis as Record<string, unknown>,
        segments: result.segments,
        exports: exports_clean,                // 前端可下载 URL
        processed_url,                          // WaveSurfer A/B
      });
      showToast(`处理完成 · ${sess.input_name}（${result.segments.length} 段）`, "success", 3000);
    } catch (e: any) {
      const msg = e?.message ?? "处理失败";
      setRepairError(sess.session_id, msg);
      showToast(msg, "error", 4000);
    }
  };

  return (
    <div className="p-3 space-y-4">
      {/* 一键变可听 */}
      <button
        onClick={runRepair}
        disabled={sess.status === "processing"}
        className="notion-btn-primary w-full justify-center !py-2 text-[13px]"
      >
        <Sparkles className="w-3.5 h-3.5" />
        {sess.status === "processing" ? "处理中…" : "一键变可听"}
      </button>

      {/* 模板选择器（已修复：纯 props，不再绑旧 sessionStore） */}
      <TemplateSelector
        templates={templates}
        selected={selectedTemplate}
        onSelect={setSelectedTemplate}
      />

      {/* 错误提示 */}
      {sess.status === "error" && sess.error && (
        <div className="border border-notion-danger/30 rounded-lg p-3 flex gap-2 items-start text-[12px]">
          <AlertCircle className="w-3.5 h-3.5 text-notion-danger mt-0.5 shrink-0" />
          <span className="text-notion-danger break-all">{sess.error}</span>
        </div>
      )}

      {/* 诊断面板 */}
      {sess.status === "done" && Object.keys(sess.diagnosis).length > 0 && (
        <DiagnosisBlock diagnosis={sess.diagnosis} />
      )}
    </div>
  );
}

function DiagnosisBlock({ diagnosis }: { diagnosis: Record<string, unknown> }) {
  const rows: [string, unknown, (v: unknown) => string][] = [
    ["主导损伤",     diagnosis.dominant_damage_type, (v) => String(v)],
    ["相位熵",       diagnosis.phase_entropy,        (v) => Number(v).toFixed(3)],
    ["瞬态缺失(dB)", diagnosis.transient_deficit_db, (v) => Number(v).toFixed(2)],
    ["HNR(dB)",      diagnosis.hnr_db,               (v) => v == null ? "—" : Number(v).toFixed(2)],
    ["棋盘比",       diagnosis.checkerboard_ratio,   (v) => v == null ? "—" : Number(v).toFixed(2)],
    ["立体声相干",   diagnosis.stereo_phase_coherence,(v) => v == null ? "—" : Number(v).toFixed(3)],
    ["削波",         diagnosis.clipping_detected,    (v) => v ? "检测到" : "未检测到"],
  ];
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-notion-faint mb-2">诊断</div>
      <div className="notion-card p-3 space-y-2">
        {rows.map(([label, value, fmt]) => (
          <div key={label} className="flex justify-between items-baseline text-[12px]">
            <span className="text-notion-muted">{label}</span>
            <span className="font-mono text-notion-text">{value != null ? fmt(value) : "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
