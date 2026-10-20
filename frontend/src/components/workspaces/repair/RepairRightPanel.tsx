/**
 * RepairRightPanel —— 修复台右侧面板
 *
 * 新版布局（按处理状态切换）：
 *   [上传前]  模板选择器 + "一键变可听"按钮
 *   [处理中]  进度条
 *   [完成后]  仪表盘 (GaugeDashboard) + 处理链步骤卡 (StepCards) + 模板选择器 + 重跑按钮
 *
 * 关键新行为：点"一键变可听" → 先弹 IntentPreview 意图预演卡 → 用户点"确认执行"才真跑。
 * 跑完后自动存版本快照（versionStore）。
 */
import { Sparkles, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useEngineStore } from '../../../stores/engineStore';
import { useVersionStore } from '../../../stores/versionStore';
import { useUIStore } from '../../../stores/uiStore';
import { TemplateSelector } from '../../TemplateSelector';
import { GaugeDashboard } from '../../metrics/GaugeDashboard';
import { StepCards } from '../../metrics/StepCards';
import { IntentPreview } from '../../metrics/IntentPreview';
import { listTemplates, processSession, type SessionResult } from '../../../api/engine';

export function RepairRightPanel() {
  const selected_id = useEngineStore((s) => s.selected_session_id);
  const sess = useEngineStore((s) => s.repair_sessions.find((x) => x.session_id === selected_id));
  const setRepairStatus = useEngineStore((s) => s.setRepairStatus);
  const setRepairResult = useEngineStore((s) => s.setRepairResult);
  const setRepairError = useEngineStore((s) => s.setRepairError);
  const showToast = useUIStore((s) => s.showToast);
  const addSnapshot = useVersionStore((s) => s.addSnapshot);

  const [templates, setTemplates] = useState<{ id: string; name_zh: string; params: Record<string, unknown> }[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('studio_vocal');
  const [previewOpen, setPreviewOpen] = useState(false);

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

  const handleRunClick = () => {
    if (sess.status === 'processing') return;
    setPreviewOpen(true);   // 先弹意图预演，用户确认才真跑
  };

  const confirmRun = async () => {
    setPreviewOpen(false);

    // 跑之前：存一版 before-snapshot
    addSnapshot({
      session_id: sess.session_id,
      kind: 'before',
      audio_url: sess.audio_url,
      template_id: selectedTemplate,
      created_at: Date.now(),
    });

    setRepairStatus(sess.session_id, 'processing', '正在理解音频结构…');

    try {
      // blob: URL → File → EngineClient.processSession → /api/process
      const resp = await fetch(sess.audio_url);
      const blob = await resp.blob();
      const file = new File([blob], sess.input_name, { type: 'audio/wav' });
      const result: SessionResult = await processSession(file, selectedTemplate);

      // 处理后波形
      let processed_url: string | undefined;
      try {
        const wf = await fetch(`/api/session/${result.session_id}/waveform`);
        if (wf.ok) processed_url = URL.createObjectURL(await wf.blob());
      } catch { /* waveform 端点未就绪时忽略 */ }

      // exports 转成前端可下载 URL
      const exports_clean: Record<string, string> = {};
      for (const [fmt] of Object.entries(result.exports)) {
        exports_clean[fmt] = `/api/export/${result.session_id}/${fmt}`;
      }

      setRepairResult(sess.session_id, {
        session_id: sess.session_id,
        template_id: result.template_id,
        input_path: sess.input_path,
        input_name: sess.input_name,
        state: result.state,
        diagnosis: result.diagnosis as unknown as Record<string, unknown>,
        segments: result.segments,
        exports: exports_clean,
        processed_url,
        measurements: result.measurements as any,   // 新增！后端 pipeline.py 返回
      });

      // 跑完后：存一版 after-snapshot
      if (processed_url) {
        addSnapshot({
          session_id: sess.session_id,
          kind: 'after',
          audio_url: sess.audio_url,
          processed_url,
          measurements: result.measurements as any,
          template_id: selectedTemplate,
          created_at: Date.now(),
        });
      }

      showToast(`处理完成 · ${sess.input_name}（${result.segments.length} 段）`, 'success', 3000);
    } catch (e: any) {
      const msg = e?.message ?? '处理失败';
      setRepairError(sess.session_id, msg);
      showToast(msg, 'error', 4000);
    }
  };

  const isDone = sess.status === 'done';

  return (
    <div className="p-3 space-y-3">
      {/* ── 意图预演弹窗 ── */}
      <IntentPreview
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onConfirm={confirmRun}
        templateId={selectedTemplate}
        fileName={sess.input_name}
      />

      {/* ── 主按钮 ── */}
      <button
        onClick={handleRunClick}
        disabled={sess.status === 'processing'}
        className="notion-btn-primary w-full justify-center !py-2 text-[13px]"
      >
        <Sparkles className="w-3.5 h-3.5" />
        {sess.status === 'processing' ? '处理中…' : isDone ? '换个模板重跑' : '一键变可听'}
      </button>

      {/* ── 模板选择器 ── */}
      <TemplateSelector
        templates={templates}
        selected={selectedTemplate}
        onSelect={setSelectedTemplate}
      />

      {/* ── 错误提示 ── */}
      {sess.status === 'error' && sess.error && (
        <div className="border border-notion-danger/30 rounded-lg p-3 flex gap-2 items-start text-[12px]">
          <AlertCircle className="w-3.5 h-3.5 text-notion-danger mt-0.5 shrink-0" />
          <span className="text-notion-danger break-all">{sess.error}</span>
        </div>
      )}

      {/* ── 处理后：仪表盘 + 步骤卡 ── */}
      {isDone && (
        <>
          <GaugeDashboard
            measurements={sess.measurements}
            diagnosis={sess.diagnosis as any}
          />
          <StepCards measurements={sess.measurements} />
        </>
      )}

      {/* ── 处理前：占位提示 ── */}
      {!isDone && sess.status !== 'processing' && (
        <div className="notion-card p-3 text-[11px] text-notion-faint space-y-1.5 bg-notion-panel/30">
          <div className="text-notion-muted font-medium">处理后这里会显示</div>
          <div>• <span className="text-notion-text">仪表盘</span> — LUFS / True Peak / 相位熵 等 5 个指标的 before→after 对比</div>
          <div>• <span className="text-notion-text">步骤卡</span> — 每一步（降噪/去混响/瞬态…）动了什么、为什么动</div>
          <div>• <span className="text-notion-text">人话解释</span> — "响度从 -17.8 LUFS 抬到 -16.2，在目标 -16.0 ±1.5 范围内"</div>
        </div>
      )}
    </div>
  );
}
