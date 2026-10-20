/**
 * GaugeDashboard — 一行指标仪表盘
 *
 * 5 个 gauge 并排：LUFS / True Peak / Phase Entropy / Transient Deficit / HNR
 * 每个 gauge 显示：before 值 → after 值 → delta → 达标状态色。
 * 目标值用虚线标出（LUFS=模板给的 / True Peak=-1.0 dBTP）。
 */
import { Gauge, TrendingUp, TrendingDown, Minus, Target } from 'lucide-react';
import type { RepairMeasurements, MetricSnapshot } from '../../types/project';

interface Props {
  measurements?: RepairMeasurements;
  diagnosis?: {
    transient_deficit_db?: number;
    hnr_db?: number;
  };
}

export function GaugeDashboard({ measurements, diagnosis }: Props) {
  if (!measurements && !diagnosis) {
    return null;
  }

  const before = measurements?.before;
  const after = measurements?.after;
  const lufsTarget = measurements?.lufs_target ?? -16.0;
  const tpLimit = measurements?.true_peak_limit_dbtp ?? -1.0;

  const gauges: GaugeDef[] = [
    {
      id: 'lufs',
      label: 'LUFS (响度)',
      before: before?.lufs,
      after: after?.lufs,
      target: lufsTarget,
      targetLabel: `${lufsTarget.toFixed(1)} LUFS`,
      unit: 'LUFS',
      good: (v, t) => v != null && t != null && Math.abs(v - t) <= 1.5,
      format: (v) => v != null ? v.toFixed(1) : '—',
    },
    {
      id: 'true_peak',
      label: 'True Peak',
      before: before?.true_peak_dbtp,
      after: after?.true_peak_dbtp,
      target: tpLimit,
      targetLabel: `≤ ${tpLimit.toFixed(1)} dBTP`,
      unit: 'dBTP',
      // True Peak 越低越好，≤ target 才算合格
      good: (v, t) => v != null && t != null && v <= t + 0.01,
      format: (v) => v != null ? v.toFixed(1) : '—',
    },
    {
      id: 'phase_entropy',
      label: '相位熵',
      before: before?.phase_entropy,
      after: after?.phase_entropy,
      target: 0.75,
      targetLabel: '≥ 0.75 自然',
      unit: '',
      good: (v, t) => v != null && t != null && v >= t,
      format: (v) => v != null ? v.toFixed(2) : '—',
    },
    {
      id: 'transient',
      label: '瞬态缺失',
      before: diagnosis?.transient_deficit_db,
      after: diagnosis?.transient_deficit_db,  // 跑完后诊断里的值
      target: 3.0,                              // ≤ 3 dB 合格
      targetLabel: '≤ 3 dB',
      unit: 'dB',
      good: (v, t) => v != null && t != null && v <= t,
      format: (v) => v != null ? v.toFixed(2) : '—',
    },
    {
      id: 'hnr',
      label: 'HNR (谐波噪声比)',
      before: null,  // 没在 before 里测 HNR
      after: diagnosis?.hnr_db,
      target: 20.0,  // 人声 ≥ 20 dB 合格
      targetLabel: '≥ 20 dB',
      unit: 'dB',
      good: (v, t) => v != null && t != null && v >= t,
      format: (v) => v != null ? v.toFixed(1) : '—',
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-notion-faint">
        <Gauge className="w-3 h-3" />
        <span>仪表盘 · 处理前后对比</span>
        <span className="text-notion-muted normal-case tracking-normal ml-auto">
          目标: {lufsTarget.toFixed(1)} LUFS · TP ≤ {tpLimit.toFixed(1)} dBTP
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {gauges.map((g) => (
          <GaugeCard key={g.id} g={g} />
        ))}
      </div>
    </div>
  );
}

interface GaugeDef {
  id: string;
  label: string;
  before: number | null | undefined;
  after: number | null | undefined;
  target: number;
  targetLabel: string;
  unit: string;
  good: (value: number, target: number) => boolean;
  format: (v: number | null | undefined) => string;
}

function GaugeCard({ g }: { g: GaugeDef }) {
  // 以 after 为准判断状态（没有 after 时用 before 或显示中性）
  const after = g.after ?? g.before;
  const hasAfter = g.after != null;
  const valid = after != null;
  const pass = valid && g.good(after, g.target);
  const near = valid && !pass && g.id === 'lufs' && Math.abs((g.after ?? g.before ?? 0) - g.target) <= 3;

  const statusColor = !valid ? 'text-notion-faint'
    : pass ? 'text-notion-success'
    : near ? 'text-[var(--color-warning)]'
    : 'text-notion-danger';

  const statusBg = !valid ? 'bg-notion-panel'
    : pass ? 'bg-green-50'
    : near ? 'bg-yellow-50'
    : 'bg-red-50';

  // Delta
  const delta = (g.after != null && g.before != null) ? g.after - g.before : null;
  const DeltaIcon = delta == null ? Minus : delta > 0.01 ? TrendingUp : delta < -0.01 ? TrendingDown : Minus;
  const deltaText = delta == null ? '—' : (delta > 0 ? '+' : '') + delta.toFixed(2);

  return (
    <div className={`notion-card p-2.5 ${statusBg} transition-colors`}>
      {/* label + status dot */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-notion-muted leading-tight">{g.label}</span>
        <span className={`w-1.5 h-1.5 rounded-full ${pass ? 'bg-notion-success' : near ? 'bg-[var(--color-warning)]' : 'bg-notion-danger'}`} />
      </div>

      {/* big after value */}
      <div className={`text-[18px] font-mono font-semibold leading-none ${statusColor}`}>
        {g.format(after)}
        {g.unit && <span className="text-[10px] font-normal ml-0.5 opacity-70">{g.unit}</span>}
      </div>

      {/* before → after + delta */}
      <div className="flex items-center justify-between mt-1.5 text-[10px] text-notion-faint gap-1">
        <span className="font-mono">
          {g.format(g.before)} → {hasAfter ? g.format(g.after) : '—'}
        </span>
        <span className="flex items-center gap-0.5 font-mono">
          <DeltaIcon className="w-2.5 h-2.5" />
          {deltaText}
        </span>
      </div>

      {/* target hint */}
      <div className="flex items-center gap-0.5 mt-1 text-[9px] text-notion-faint">
        <Target className="w-2 h-2" />
        {g.targetLabel}
      </div>
    </div>
  );
}
