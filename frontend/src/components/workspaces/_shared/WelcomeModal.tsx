/**
 * WelcomeModal —— 首次进入欢迎引导。
 *
 * 依据 PRODUCT-FRAMEWORK.md §0 统一入口与出口 + 空状态设计。
 * 首次访问显示完整引导，再次访问显示简化版。
 * 通过 localStorage 的 "deai_welcomed_v1" 标记控制。
 */
import { useEffect, useState } from "react";
import { X, Music, Sparkles, FileAudio, PenLine, BookOpen, Zap } from "lucide-react";
import { useUIStore } from "../../../stores/uiStore";

const WELCOME_KEY = "deai_welcomed_v1";

const STEPS = [
  { icon: Sparkles, title: "修复台", desc: "拖入音频 → 一键消除机械感、消削波、修瞬态，让它变可听。" },
  { icon: FileAudio, title: "拆解台", desc: "上传参考歌 → 自动识别调性、和弦、段落结构。" },
  { icon: Music, title: "编曲台", desc: "时间线拖 clip → 编排声部、锁定调性。" },
  { icon: PenLine, title: "词作台", desc: "段落导航 + 音节吸附 + 续写建议。" },
  { icon: BookOpen, title: "学习台", desc: "内置乐理卡，操作关联笔记随时点开。" },
];

export function WelcomeModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const setWs = useUIStore((s) => s.setWorkspace);

  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    const welcomed = localStorage.getItem(WELCOME_KEY);
    if (!welcomed) {
      // 首次访问 → 完整引导
      setOpen(true);
    } else {
      // 再次访问 → 可选：不自动弹
      // setOpen(true);  // 如需每次都显示简化版可启用
    }
  }, []);

  const close = () => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(WELCOME_KEY, new Date().toISOString());
    }
    setOpen(false);
  };

  if (!open) return null;

  const isLast = step === STEPS.length;

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="relative notion-card rounded-xl max-w-[480px] w-full p-5 shadow-lg">
        <button
          onClick={close}
          className="absolute top-3 right-3 p-1 rounded hover:bg-notion-hover text-notion-muted"
          aria-label="关闭"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-5 h-5 text-notion-accent" />
          <span className="text-[15px] font-semibold">留白</span>
        </div>
        <div className="text-[12px] text-notion-muted mb-5">从一段原始素材，到一个可编辑的音乐工程</div>

        {!isLast ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-notion-accent/10 flex items-center justify-center shrink-0">
                {(() => { const I = STEPS[step].icon; return <I className="w-5 h-5 text-notion-accent" />; })()}
              </div>
              <div>
                <div className="text-[14px] font-semibold">{STEPS[step].title}</div>
                <div className="text-[12px] text-notion-muted">{STEPS[step].desc}</div>
              </div>
            </div>
            {/* 进度点 */}
            <div className="flex gap-1.5">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-notion-accent" : "bg-notion-border"}`}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-[14px] font-semibold text-center">准备好了吗？</div>
            <div className="text-[12px] text-notion-muted text-center">从修复台开始，上传你的第一段音频试试</div>
            <button
              onClick={() => { setWs("repair"); close(); }}
              className="btn-primary w-full justify-center !py-2"
            >
              <Sparkles className="w-4 h-4" /> 开始修复
            </button>
          </div>
        )}

        {!isLast && (
          <div className="flex justify-between mt-5">
            <button onClick={close} className="btn-ghost !text-[12px] !h-7">跳过引导</button>
            <button onClick={() => setStep(step + 1)} className="btn-primary !py-1.5">
              下一步 →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
