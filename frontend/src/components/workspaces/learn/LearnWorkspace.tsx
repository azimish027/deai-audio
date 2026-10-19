/** 学习台 Center —— KnowledgeCardGrid（简化版，用原生 details/summary）。 */
import { useEffect } from "react";
import { useProjectStore } from "../../../stores/projectStore";
import { v4 as uuid } from "uuid";

const BUILTIN_CARDS = [
  {
    topic: "相位熵 vs 可听度",
    short: "相位熵 > 0.9 时，单声道听起来像噪音。",
    deep: "相位熵衡量左右声道的相关性。高熵值意味着声像在频率上完全散开（典型现场/后期立体声处理的副产物）。修复台通过 SMPTE 180° 反相检测、瞬时相干重构 + mid-side 权重重分配来解决。",
    tags: ["phase", "修复台", "相位"],
    ops: ["run_repair"],
  },
  {
    topic: "Krumhansl-Schmuckler 调性检测",
    short: "通过音高分布与大小调特征向量的相关性判定调性。",
    deep: "K-S 算法计算 chroma 特征向量，与大调/小调 profile 做 Pearson 相关，取最大相关的旋转位置作为调性。缺点：半音阶作品 / 转调段落容易误判；方案里用 chord-extractor 的 HMM 状态转移来补强。",
    tags: ["key_detect", "拆解台"],
    ops: ["analyze_reference"],
  },
  {
    topic: "ii-V 进行为什么好听",
    short: "大调里 ii-V 是次属 → 属的解决链。",
    deep: "ii 是下属功能（Dm = ii），V 是属功能（G = V）。从 ii 到 V 的低音做了上四度跳进（A→D），这个运动有强烈的「要解决到 I」的惯性。如果中间加一个 vi，就变成经典的 pop ii-V-I-vi 循环（俗称 4536）。",
    tags: ["chord", "编曲台"],
    ops: ["suggest_chords"],
  },
  {
    topic: "响度归一化 ≠ 音量放大",
    short: "LUFS 是感知响度的国际标准，峰值是工程指标。",
    deep: "Spotify/Youtube 都用 Integrated Loudness（LUFS）。归一化是把整轨的 LUFS 拉到目标（如 -16 LUFS for Spotify），如果原始动态范围大，归一化后峰值可能仍超过 true peak -1 dBTP——这时需要真峰值限幅器（方案 §2.2 的 truepeak_limiter）。",
    tags: ["loudness", "修复台"],
    ops: ["loudness_normalize"],
  },
  {
    topic: "时间线 clip 布局约束",
    short: "同轨同位置多 clip 会冲突；方案允许 overlap → 取优先级最高的。",
    deep: "Clip 碰撞分两种：硬碰撞（同一轨完全重叠）走 priority 规则；软碰撞（不同轨同位置）合法（叠加和弦 + MIDI）。方案里 Timeline Canvas 用 O(N log N) sweep-line 检测。",
    tags: ["timeline", "编曲台"],
    ops: ["add_clip", "move_clip"],
  },
];

export function LearnWorkspace() {
  const knowledge = useProjectStore((s) => s.knowledge);
  const addCard = useProjectStore((s) => s.addKnowledgeCard);

  // 首次渲染注入内置卡（只注入一次）
  useEffect(() => {
    if (knowledge.length === 0) {
      BUILTIN_CARDS.forEach((b) => {
        addCard({
          id: uuid(),
          topic: b.topic,
          short_explanation: b.short,
          deep_explanation: b.deep,
          examples: [],
          linked_operations: b.ops,
          user_authored: false,
          tags: b.tags,
          created_at: Date.now(),
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <div className="max-w-[960px] mx-auto space-y-4">
        <div>
          <div className="text-[18px] font-semibold">乐理 & 操作笔记</div>
          <div className="text-[12px] text-notion-muted">
            内置 {BUILTIN_CARDS.length} 张 · 用户生成 {knowledge.filter((c) => c.user_authored).length} 张 · 总 {knowledge.length} 张
          </div>
        </div>

        {knowledge.length === 0 ? (
          <div className="text-[12px] text-notion-faint text-center py-8">加载中…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {knowledge.map((card) => (
              <details key={card.id} className="notion-card p-3 group">
                <summary className="cursor-pointer select-none flex items-baseline justify-between gap-3">
                  <span className="text-[13px] font-semibold text-notion-text">{card.topic}</span>
                  <span className="text-[11px] text-notion-faint shrink-0">
                    {card.tags.slice(0, 2).map((t) => `#${t}`).join(" ")}
                  </span>
                </summary>
                <div className="mt-3 space-y-2">
                  <p className="text-[12px] text-notion-muted leading-relaxed">{card.short_explanation}</p>
                  <p className="text-[12px] text-notion-text leading-relaxed whitespace-pre-wrap">{card.deep_explanation}</p>
                  {card.linked_operations.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {card.linked_operations.map((op) => (
                        <span key={op} className="text-[10px] px-1.5 py-0.5 rounded bg-notion-hover text-notion-faint font-mono">
                          {op}
                        </span>
                      ))}
                    </div>
                  )}
                  {card.user_authored && (
                    <span className="text-[10px] text-notion-accent font-mono">user-authored</span>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// LeftPanel 里引用的 LearnLeftPanel（保持原组件导出）
export function LearnLeftPanel() {
  return (
    <div className="p-3 space-y-3">
      <div className="notion-card p-3">
        <div className="text-[11px] uppercase tracking-wider text-notion-faint mb-2">学习进度</div>
        <div className="text-[12px] text-notion-muted">卡片会从你的操作自动生成。拆解台、编曲台、修复台跑完后，这里会出现关联的乐理笔记。</div>
      </div>
      <div className="text-[11px] text-notion-faint text-center py-2">← 点中心卡片展开详情</div>
    </div>
  );
}
