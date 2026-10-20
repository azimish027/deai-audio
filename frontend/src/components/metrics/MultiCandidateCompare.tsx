/**
 * MultiCandidateCompare —— 同一个 session 的多 after-snapshot 并排对比面板
 *
 * 从 versionStore 读同一 session 的所有 after-snapshot，
 * 按 template_id 分组，每个候选显示：模板中文名 + 3 个核心指标（LUFS after / True Peak after / 相位熵 after）+ 一句结论。
 */
import { GitCompare, Trophy } from 'lucide-react';
import { TEMPLATE_NAMES_ZH } from '../../config/templates';
import { useVersionStore } from '../../stores/versionStore';

interface Props {
  sessionId: string;
}

export function MultiCandidateCompare({ sessionId }: Props) {
  const snapshots = useVersionStore((s) => s.getSnapshots(sessionId));
  const afterSnaps = snapshots.filter((s) => s.kind === 'after');

  if (afterSnaps.length < 2) return null;

  // 选"最佳"候选：优先 LUFS 离模板目标最近 + True Peak 最低
  const ranked = rankCandidates(afterSnaps);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-notion-faint">
        <GitCompare className="w-3 h-3" />
        <span>多候选并排对比</span>
        <span className="normal-case tracking-normal ml-auto text-[10px]">
          {afterSnaps.length} 版 · {ranked.length > 0 ? `推荐：${ranked[0].templateZH}` : ''}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {ranked.map((c, i) => (
          <CandidateCard key={c.snapshot.version_id} candidate={c} rank={i + 1} isBest={i === 0} />
        ))}
      </div>
    </div>
  );
}

interface Ranked {
  snapshot: ReturnType<typeof useVersionStore.getState>['snapshots'][string][number];
  templateZH: string;
  lufs: number | null;
  tp: number | null;
  score: number;  // 越小越好（LUFS 偏差 + TP）
}

function rankCandidates(snaps: ReturnType<typeof useVersionStore.getState>['snapshots'][string]): Ranked[] {
  const out: Ranked[] = [];
  for (const s of snaps) {
    const m = s.measurements;
    const after = m?.after;
    if (!after) continue;
    const lufs = after.lufs;
    const tp = after.true_peak_dbtp;
    const target = m?.lufs_target ?? -16.0;
    const score = Math.abs((lufs ?? 99) - target) + Math.max(0, (tp ?? 0) + 1.0) * 3;
    out.push({
      snapshot: s,
      templateZH: TEMPLATE_NAMES_ZH[s.template_id ?? ''] ?? s.template_id ?? '(未知)',
      lufs, tp, score,
    });
  }
  return out.sort((a, b) => a.score - b.score);
}

function CandidateCard({ candidate, rank, isBest }: { candidate: Ranked; rank: number; isBest: boolean }) {
  const { snapshot, templateZH, lufs, tp } = candidate;
  const m = snapshot.measurements;
  const target = m?.lufs_target ?? -16.0;
  const lufsGood = lufs != null && Math.abs(lufs - target) <= 1.5;
  const tpGood = tp != null && tp <= -1.0;

  const conclusion = (() => {
    const parts: string[] = [];
    if (lufs != null) parts.push(`LUFS ${lufs.toFixed(1)}${lufsGood ? ' 达标' : lufs > target + 1.5 ? ' 偏响' : ' 偏轻'}`);
    if (tp != null) parts.push(`TP ${tp.toFixed(1)} dBTP${tpGood ? ' 安全' : ' 过冲'}`);
    return parts.join(' · ');
  })();

  return (
    <div className={[
      'notion-card p-2.5 border-l-2 transition-colors',
      isBest ? 'border-l-notion-accent bg-notion-accent/5' : 'border-l-notion-border',
    ].join(' ')}>
      <div className="flex items-center gap-1.5 mb-1.5">
        {isBest ? (
          <Trophy className="w-3 h-3 text-yellow-500" />
        ) : (
          <span className="w-4 h-4 text-[9px] rounded-full bg-notion-hover text-notion-faint flex items-center justify-center font-mono">{rank}</span>
        )}
        <span className="text-[12px] font-medium text-notion-text-2 truncate">{templateZH}</span>
        {isBest && <span className="text-[9px] text-yellow-600 bg-yellow-50 rounded px-1 ml-auto">AI 推荐</span>}
      </div>

      <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
        <div className={`notion-card p-1.5 ${lufsGood ? 'bg-green-50' : 'bg-red-50'}`}>
          <div className="text-notion-faint text-[9px]">LUFS</div>
          <div className={`font-semibold ${lufsGood ? 'text-notion-success' : 'text-notion-danger'}`}>
            {lufs != null ? lufs.toFixed(1) : '—'}
            <span className="text-notion-faint text-[8px] ml-0.5">/ {target.toFixed(1)}</span>
          </div>
        </div>
        <div className={`notion-card p-1.5 ${tpGood ? 'bg-green-50' : 'bg-red-50'}`}>
          <div className="text-notion-faint text-[9px]">True Peak</div>
          <div className={`font-semibold ${tpGood ? 'text-notion-success' : 'text-notion-danger'}`}>
            {tp != null ? tp.toFixed(1) : '—'}
            <span className="text-notion-faint text-[8px] ml-0.5">dBTP</span>
          </div>
        </div>
      </div>

      <div className="mt-1.5 text-[10px] text-notion-muted leading-relaxed truncate">{conclusion}</div>
    </div>
  );
}
