/**
 * RepairRightPanel —— 修复台右侧面板（完整版）
 *
 * ① 模板选择器 + "一键变可听"（先弹 IntentPreview 带 controls 摘要）
 * ② StepControls 状态由 RepairSessionUI.run_controls 持有，调 StepCards 实时更新
 * ③ 重跑时把 controls.enabled / controls.strengths 压缩成最小 params 传给后端
 * ④ AI 多候选：一键跑 studio / podcast / short_video 三个模板并排对比
 */
import { Sparkles, AlertCircle, Bot } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useEngineStore } from '../../../stores/engineStore';
import { useVersionStore } from '../../../stores/versionStore';
import { useUIStore } from '../../../stores/uiStore';
import { TemplateSelector } from '../../TemplateSelector';
import { GaugeDashboard } from '../../metrics/GaugeDashboard';
import { StepCards, type StepControls } from '../../metrics/StepCards';
import { IntentPreview } from '../../metrics/IntentPreview';
import { listTemplates, processSession, type SessionResult, type RepairRunParams } from '../../../api/engine';
import { controlsToParams, makeDefaultControls } from '../../../utils/repairControls';

/** AI 多候选用的三个模板 ID */
export const AI_CANDIDATE_TEMPLATES = ['studio_vocal', 'podcast_dialogue', 'short_video_voiceover'];

export function RepairRightPanel() {
  const selected_id = useEngineStore((s) => s.selected_session_id);
  const sess = useEngineStore((s) => s.repair_sessions.find((x) => x.session_id === selected_id));
  const setRepairStatus = useEngineStore((s) => s.setRepairStatus);
  const setRepairResult = useEngineStore((s) => s.setRepairResult);
  const setRepairError = useEngineStore((s) => s.setRepairError);
  const setRunControls = useEngineStore((s) => s.setRunControls);
  const showToast = useUIStore((s) => s.showToast);
  const addSnapshot = useVersionStore((s) => s.addSnapshot);

  const [templates, setTemplates] = useState<{ id: string; name_zh: string; params: Record<string, unknown> }[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('studio_vocal');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [multiPreviewOpen, setMultiPreviewOpen] = useState(false);

  useEffect(() => {
    listTemplates().then(setTemplates).catch(() => setTemplates([]));
  }, []);

  // controls 状态：从 store restore 或新建默认
  const controls: StepControls = sess?.run_controls ?? makeDefaultControls();
  const setControls = (next: StepControls) => sess && setRunControls(sess.session_id, next);

  if (!sess) {
    return (
      <div className="p-4 text-[12px] text-notion-faint text-center">
        从左侧选择或新建一个修复会话，这里会显示诊断和模板选项
      </div>
    );
  }

  const handleRunClick = () => {
    if (sess.status === 'processing') return;
    setPreviewOpen(true);
  };

  const fetchFile = async () => {
    const resp = await fetch(sess.audio_url);
    const blob = await resp.blob();
    return new File([blob], sess.input_name, { type: 'audio/wav' });
  };

  const confirmRun = async () => {
    setPreviewOpen(false);
    runOne(selectedTemplate);
  };

  /** 单模板跑一次 —— 共享核心流程 */
  const runOne = async (templateId: string, controlsOverride?: StepControls) => {
    const activeControls = controlsOverride ?? controls;
    const params: RepairRunParams = controlsToParams(activeControls);

    addSnapshot({
      session_id: sess.session_id,
      kind: 'before',
      audio_url: sess.audio_url,
      template_id: templateId,
      created_at: Date.now(),
    });

    setRepairStatus(sess.session_id, 'processing', '正在理解音频结构…');

    try {
      const file = await fetchFile();
      const result: SessionResult = await processSession(file, templateId, params);

      let processed_url: string | undefined;
      try {
        const wf = await fetch(`/api/session/${result.session_id}/waveform`);
        if (wf.ok) processed_url = URL.createObjectURL(await wf.blob());
      } catch { /* ignore */ }

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
        measurements: result.measurements as any,
      });
      if (controlsOverride) setRunControls(sess.session_id, activeControls);

      if (processed_url) {
        addSnapshot({
          session_id: sess.session_id,
          kind: 'after',
          audio_url: sess.audio_url,
          processed_url,
          measurements: result.measurements as any,
          template_id: templateId,
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

  /** AI 多候选：串行跑 3 个模板，每个新建独立 session */
  const runMultiConfirm = async () => {
    setMultiPreviewOpen(false);
    showToast('AI 多候选开始 · 串行跑 3 个模板…', 'info', 2500);

    for (const tid of AI_CANDIDATE_TEMPLATES) {
      try {
        const file = await fetchFile();
        setRepairStatus(sess.session_id, 'processing', `候选：跑 ${tid} …`);
        const result: SessionResult = await processSession(file, tid);
        const multiId = `${sess.session_id}::${tid}::multi`;
        let processed_url: string | undefined;
        try {
          const wf = await fetch(`/api/session/${result.session_id}/waveform`);
          if (wf.ok) processed_url = URL.createObjectURL(await wf.blob());
        } catch { /* ignore */ }

        // 不覆盖当前 session，存 versionStore 让 Center 并排显示
        if (processed_url) {
          addSnapshot({
            session_id: sess.session_id,
            kind: 'after',
            audio_url: sess.audio_url,
            processed_url,
            measurements: result.measurements as any,
            template_id: tid,
            created_at: Date.now(),
            note: `AI 候选 ${tid}`,
          });
        }
      } catch { /* 单候选失败不阻塞其他 */ }
    }
    setRepairStatus(sess.session_id, sess.status === 'processing' ? 'done' : sess.status);
    showToast('3 个候选跑完 · 下方并排对比', 'success', 3500);
  };

  const isDone = sess.status === 'done';

  return (
    <div className="p-3 space-y-3">
      {/* IntentPreview */}
      <IntentPreview
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onConfirm={confirmRun}
        templateId={selectedTemplate}
        fileName={sess.input_name}
        controls={controls}
      />

      <IntentPreview
        open={multiPreviewOpen}
        onClose={() => setMultiPreviewOpen(false)}
        onConfirm={runMultiConfirm}
        templateId={selectedTemplate}
        fileName={sess.input_name}
        multiRunCount={AI_CANDIDATE_TEMPLATES.length}
      />

      {/* 主按钮 */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleRunClick}
          disabled={sess.status === 'processing'}
          className="notion-btn-primary justify-center !py-2 text-[13px]"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {sess.status === 'processing' ? '处理中…' : isDone ? '重跑（用当前开关）' : '一键变可听'}
        </button>

        <button
          onClick={() => setMultiPreviewOpen(true)}
          disabled={sess.status === 'processing'}
          className="notion-btn-secondary justify-center !py-2 text-[13px]"
          title="AI 串行跑 3 个模板并排对比"
        >
          <Bot className="w-3.5 h-3.5" />
          AI 跑 3 版
        </button>
      </div>

      {/* 模板选择器 */}
      <TemplateSelector
        templates={templates}
        selected={selectedTemplate}
        onSelect={setSelectedTemplate}
      />

      {/* 错误提示 */}
      {sess.status === 'error' && sess.error && (
        <div className="border border-notion-danger/30 rounded-lg p-3 flex gap-2 items-start text-[12px]">
          <AlertCircle className="w-3.5 h-3.5 text-notion-danger mt-0.5 shrink-0" />
          <span className="text-notion-danger break-all">{sess.error}</span>
        </div>
      )}

      {/* 处理后：仪表盘 + 步骤卡（受控组件，调完直接影响重跑） */}
      {isDone && (
        <>
          <GaugeDashboard measurements={sess.measurements} diagnosis={sess.diagnosis as any} />
          <StepCards measurements={sess.measurements} controls={controls} onChange={setControls} />
        </>
      )}

      {/* 处理前：初始 controls 骨架 + 占位提示 */}
      {!isDone && sess.status !== 'processing' && (
        <div className="notion-card p-3 space-y-2">
          <div className="text-[11px] text-notion-muted font-medium">先调你的 pipeline（可选）</div>
          <div className="text-[10px] text-notion-faint leading-relaxed">
            处理完后这里会显示仪表盘+步骤卡，你可以调开关/强度点重跑。
            现在处理的话用模板默认值。
          </div>
        </div>
      )}
    </div>
  );
}
