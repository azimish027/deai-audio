/**
 * IntentPreview —— "一键变可听" 前弹的意图预演卡（完整版）
 *
 * 接受完整 controls（StepControls + HumanPreserveControls），显示两步摘要：
 *   ① 步骤开关/强度摘要
 *   ② 🧬 人味保护摘要（"修音 ±15 cents · 保留气口滑音 · ±1.5 LUFS 容忍"）
 */
import { Sparkles, X, Check, AlertCircle, Wrench, Gauge, Dna } from 'lucide-react';
import { TEMPLATE_NAMES_ZH } from '../../config/templates';
import type { HumanPreserveControls } from '../../utils/repairControls';
import { summarizeHuman, summarizeControls } from '../../utils/repairControls';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  templateId: string;
  fileName: string;
  controls?: { enabled: Record<string, boolean>; strengths: Record<string, number>; human?: HumanPreserveControls };
  multiRunCount?: number;
}

export function IntentPreview({ open, onClose, onConfirm, templateId, fileName, controls, multiRunCount }: Props) {
  if (!open) return null;

  const templateZH = TEMPLATE_NAMES_ZH[templateId] ?? templateId;
  const targetLufs = templateId === 'short_video_voiceover' ? -14.0 : -16.0;
  const controlSummary = controls ? summarizeControls(controls) : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-[400px] max-w-[94vw] notion-card bg-notion-bg shadow-xl rounded-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-notion-border bg-notion-hover/50">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-notion-accent" />
            <span className="text-[13px] font-semibold text-notion-text">AI 意图预演</span>
          </div>
          <button className="icon-btn p-0.5" onClick={onClose}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3 max-h-[70vh] overflow-auto">
          {/* 理解 */}
          <div>
            <div className="text-[11px] text-notion-faint mb-1">我理解你的输入</div>
            <div className="text-[12px] text-notion-text font-medium break-all">{fileName}</div>
            <div className="text-[11px] text-notion-muted">
              {multiRunCount
                ? <>AI 将自动跑 <span className="text-notion-accent font-medium">{multiRunCount}</span> 个模板并排对比</>
                : <>使用模板：<span className="text-notion-accent font-medium">{templateZH}</span></>}
            </div>
          </div>

          {/* 计划 */}
          <div>
            <div className="text-[11px] text-notion-faint mb-1 flex items-center gap-1">
              <Wrench className="w-3 h-3" />
              准备跑以下处理链
            </div>
            <div className="notion-card p-2 space-y-0.5 bg-notion-panel/50 max-h-[180px] overflow-auto">
              <div className="flex items-center gap-1.5 text-[11px] text-notion-muted"><span className="w-4">#</span>DC Offset → 削波修复 → 诊断 → 分离 → 降噪 → 去混响 → 瞬态恢复 → 去齿音 → 响度标准化 → True Peak 限幅</div>
            </div>
          </div>

          {/* 用户自定义 controls 摘要 */}
          {controlSummary && (
            <div>
              <div className="text-[11px] text-notion-faint mb-1 flex items-center gap-1">
                <Gauge className="w-3 h-3" />
                你的自定义
              </div>
              <div className="text-[11px] bg-notion-panel/50 rounded px-2 py-1.5 text-notion-text-2 leading-relaxed">
                {controlSummary.summary}
                {controlSummary.stepOff.length > 0 && (
                  <div className="text-notion-muted text-[10px] mt-0.5">
                    关闭：{controlSummary.stepOff.join('、')}
                  </div>
                )}
                {controlSummary.stepModified.length > 0 && (
                  <div className="text-notion-muted text-[10px]">
                    强度调整：{controlSummary.stepModified.map((m) => `${m.name} ${m.value.toFixed(1)}x`).join('；')}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 🧬 人味保护摘要（单独一块，因为比步骤开关重要得多） */}
          {controlSummary?.human && (
            <div>
              <div className="text-[11px] text-notion-faint mb-1 flex items-center gap-1">
                <Dna className="w-3 h-3 text-notion-accent" />
                🧬 人味保护
              </div>
              <div className={`text-[11px] rounded px-2 py-1.5 leading-relaxed border-l-2 ${
                controlSummary.human.enabled
                  ? 'bg-notion-accent/[0.06] border-l-notion-accent text-notion-text-2'
                  : 'bg-notion-danger/[0.05] border-l-notion-danger text-notion-faint'
              }`}>
                {summarizeHuman(controlSummary.human)}
              </div>
              <div className="text-[9px] text-notion-faint mt-1 leading-relaxed">
                💡 "修音修到 100% 准，人味就死了" ——人味保护默认开，砍降噪 40% / 保混响 50% / 修音 ±15 cents 内不动
              </div>
            </div>
          )}

          {/* 目标指标 */}
          <div>
            <div className="text-[11px] text-notion-faint mb-1">预期结果</div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="notion-card p-2 bg-notion-panel/50">
                <div className="text-notion-faint text-[10px]">目标响度</div>
                <div className="font-mono text-notion-text">{targetLufs.toFixed(1)} LUFS</div>
              </div>
              <div className="notion-card p-2 bg-notion-panel/50">
                <div className="text-notion-faint text-[10px]">真峰值限制</div>
                <div className="font-mono text-notion-text">≤ -1.0 dBTP</div>
              </div>
            </div>
          </div>

          {/* 免责声明 */}
          <div className="flex gap-1.5 items-start text-[10.5px] text-notion-faint bg-notion-panel/50 rounded px-2 py-1.5">
            <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
            <span>这是音频信号处理，不是魔法。跑完后仪表盘会告诉你每步实际动了多少——不满意随时调开关/强度重跑。</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-4 py-3 border-t border-notion-border bg-notion-hover/30">
          <button
            onClick={onClose}
            className="flex-1 text-[12px] py-1.5 rounded border border-notion-border hover:border-notion-accent transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 notion-btn-primary !py-1.5 justify-center text-[12px]"
          >
            <Check className="w-3 h-3" />
            确认执行
          </button>
        </div>
      </div>
    </div>
  );
}
