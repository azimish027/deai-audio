/**
 * IntentPreview —— "一键变可听" 前弹的意图预演卡
 *
 * 点击 RepairRightPanel 的"一键变可听"按钮 → 先弹这张卡：
 *   "我理解这是一段人声音频，你选的是【录音棚人声】模板，
 *    准备跑 9 步处理链（DC→declip→诊断→分离→分段→降噪→去混响→瞬态→响度），
 *    目标 LUFS=-16.0，True Peak ≤-1.0 dBTP。确认执行？"
 *
 * 用户点"确认"才真的调后端 /api/process，"取消"则关弹窗。
 */
import { Sparkles, X, Check, AlertCircle, Wrench } from 'lucide-react';
import { TEMPLATE_NAMES_ZH } from '../../config/templates';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  templateId: string;
  fileName: string;
}

export function IntentPreview({ open, onClose, onConfirm, templateId, fileName }: Props) {
  if (!open) return null;

  const templateZH = TEMPLATE_NAMES_ZH[templateId] ?? templateId;

  // 模板对应的参数摘要（硬编码，和 constants.py 对齐）
  const targetLufs = templateId === 'short_video_voiceover' ? -14.0 : -16.0;
  const pipelineSteps = [
    'DC Offset 去除',
    '削波稀疏重建',
    'Demucs 源分离',
    'DeepFilterNet 降噪',
    '去混响',
    '瞬态恢复',
    '去齿音',
    '响度标准化 (EBU R128)',
    'True Peak 限幅',
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-[380px] max-w-[92vw] notion-card bg-notion-bg shadow-xl rounded-lg overflow-hidden">
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
        <div className="p-4 space-y-3">
          {/* 理解 */}
          <div>
            <div className="text-[11px] text-notion-faint mb-1">我理解你的输入</div>
            <div className="text-[12px] text-notion-text font-medium">
              {fileName}
            </div>
            <div className="text-[11px] text-notion-muted">
              使用模板：<span className="text-notion-accent font-medium">{templateZH}</span>
            </div>
          </div>

          {/* 计划 */}
          <div>
            <div className="text-[11px] text-notion-faint mb-1 flex items-center gap-1">
              <Wrench className="w-3 h-3" />
              准备跑以下处理链
            </div>
            <div className="notion-card p-2 space-y-0.5 bg-notion-panel/50">
              {pipelineSteps.map((s, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px] text-notion-muted">
                  <span className="w-4 h-4 rounded-full bg-notion-hover text-[9px] flex items-center justify-center text-notion-faint">
                    {i + 1}
                  </span>
                  {s}
                </div>
              ))}
            </div>
          </div>

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
            <span>
              这是音频信号处理，不是魔法。跑完后右侧仪表盘会告诉你每一步实际动了多少——不满意随时切模板重跑。
            </span>
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
