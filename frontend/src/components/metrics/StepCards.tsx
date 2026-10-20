/**
 * StepCards —— 处理链每步骤一张卡
 *
 * 展示 pipeline 里实际跑过的每一步（来自 measurements.steps），每张卡：
 *   - 状态色条（ok=绿 / skipped=灰 / error=红）
 *   - 步骤名 + icon + 独立开关骨架
 *   - before → after 关键指标变化（2-3 个最相关的）
 *   - 一句人话解释（human / explain）
 *
 * 开关骨架：前端本地 useState 管理，当前只做视觉（关了卡片变淡），后端暂时 ignore。
 * 未来后端做 per-step 独立可调用后，把 enabled 上提到 engineStore 并在 processSession 时传参。
 */
import { CheckCircle2, AlertTriangle, CircleMinus, AudioWaveform, Volume2, Zap, Waves, Mic, Gauge, Power, PowerOff } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { RepairMeasurements, StepMeasurement } from '../../types/project';

interface Props {
  measurements?: RepairMeasurements;
}

/** step_id → icon 映射 */
const STEP_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  dc_offset:          Gauge,
  declip:           AudioWaveform,
  separation:       AudioWaveform,
  denoise:          Waves,
  deverb:           Volume2,
  transient_restore: Zap,
  deesser:          Mic,
  loudness_normalize: Volume2,
  true_peak_limit:  AudioWaveform,
};

function StepIcon({ id }: { id: string }) {
  const Ic = STEP_ICON[id] ?? AudioWaveform;
  return <Ic className="w-3.5 h-3.5" />;
}

export function StepCards({ measurements }: Props) {
  const steps = measurements?.steps ?? [];

  // 每步开关骨架：默认 ok 的 step = 开，skipped/error = 关（本来就没跑）
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(steps.map((s) => [s.step_id, s.status === 'ok'])),
  );

  const allOn = useMemo(
    () => steps.length > 0 && steps.every((s) => enabled[s.step_id] ?? true),
    [steps, enabled],
  );

  const toggle = (id: string) => setEnabled((m) => ({ ...m, [id]: !(m[id] ?? true) }));
  const toggleAll = () => setEnabled(() => Object.fromEntries(steps.map((s) => [s.step_id, !allOn])));

  if (!steps.length) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-notion-faint">
        <AudioWaveform className="w-3 h-3" />
        <span>处理链 · 每步动作</span>
        <span className="normal-case tracking-normal ml-auto text-[10px]">
          {steps.filter((s) => s.status === 'ok').length} 成功 ·
          {steps.filter((s) => s.status === 'skipped').length} 跳过 ·
          {steps.filter((s) => s.status === 'error').length} 失败
        </span>
        <button
          onClick={toggleAll}
          className="ml-1 text-[10px] px-1.5 py-0.5 rounded border border-notion-border hover:border-notion-accent text-notion-muted hover:text-notion-accent transition-colors"
          title={allOn ? '全部关闭（视觉骨架）' : '全部开启'}
        >
          {allOn ? <PowerOff className="w-3 h-3" /> : <Power className="w-3 h-3" />}
        </button>
      </div>

      <div className="space-y-1.5">
        {steps.map((step, i) => (
          <StepCard
            key={step.step_id + i}
            step={step}
            index={i}
            enabled={enabled[step.step_id] ?? true}
            onToggle={() => toggle(step.step_id)}
          />
        ))}
      </div>

      {/* 开关骨架的未来说明 */}
      <div className="text-[10px] text-notion-faint px-1 pt-1 leading-relaxed">
        💡 顶部开关是视觉骨架：当前后端处理链还不支持 per-step 独立调用，
        按钮只影响卡片显隐不影响实际处理。等后端 pipeline 拆成可单独调用的子模块后，
        开关就会传递到 /api/process 真正控制每步。
      </div>
    </div>
  );
}

interface StepCardProps {
  step: StepMeasurement;
  index: number;
  enabled: boolean;
  onToggle: () => void;
}

function StepCard({ step, index, enabled, onToggle }: StepCardProps) {
  const statusColor = step.status === 'ok' ? 'border-l-notion-success'
    : step.status === 'skipped' ? 'border-l-notion-faint opacity-60'
    : 'border-l-notion-danger';

  const StatusIcon = step.status === 'ok' ? CheckCircle2
    : step.status === 'skipped' ? CircleMinus
    : AlertTriangle;

  // 选 2-3 个最相关的 delta 展示
  const deltas: { label: string; before: string; after: string; delta: string; good: boolean }[] = [];
  const { before, after, delta } = step;

  if (step.step_id === 'loudness_normalize') {
    deltas.push(metricRow('LUFS', before.lufs, after.lufs, delta.lufs, { target: -16.0, tolerance: 1.5 }));
  } else if (step.step_id === 'true_peak_limit' || step.step_id === 'declip') {
    deltas.push(metricRow('True Peak', before.true_peak_dbtp, after.true_peak_dbtp, delta.true_peak_dbtp, { target: -1.0 }));
  } else if (step.step_id === 'transient_restore') {
    deltas.push(metricRow('相位熵', before.phase_entropy, after.phase_entropy, delta.phase_entropy, { direction: 'up', target: 0.75 }));
  } else if (step.step_id === 'denoise') {
    deltas.push(metricRow('频谱平坦度', before.spectrum_flatness, after.spectrum_flatness, delta.spectrum_flatness, { direction: 'down', target: 0 }));
  }
  deltas.push(metricRow('RMS', before.rms_dbfs, after.rms_dbfs, delta.rms_dbfs, {}));

  const disabled = !enabled;

  return (
    <div className={[
      'notion-card p-2.5 pl-3 border-l-2 transition-all',
      statusColor,
      disabled && 'grayscale opacity-60',
    ].filter(Boolean).join(' ')}>
      {/* 顶部：序号 + icon + name + status + 开关 */}
      <div className="flex items-center gap-1.5 mb-1">
        <span className="w-4 h-4 text-[9px] rounded bg-notion-hover text-notion-faint flex items-center justify-center shrink-0 font-mono">
          {index + 1}
        </span>
        <StepIcon id={step.step_id} />
        <span className="text-[12px] font-medium text-notion-text-2">{step.name}</span>
        <StatusIcon className={`w-3 h-3 ml-auto ${step.status === 'ok' ? 'text-notion-success' : step.status === 'skipped' ? 'text-notion-faint' : 'text-notion-danger'}`} />

        {/* 独立开关骨架 */}
        <button
          onClick={onToggle}
          className={`w-7 h-4 rounded-full relative transition-colors ${enabled ? 'bg-notion-accent/60' : 'bg-notion-border'}`}
          title={enabled ? '关闭此步（视觉骨架）' : '开启此步'}
        >
          <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${enabled ? 'left-3.5' : 'left-0.5'}`} />
        </button>
      </div>

      {/* 指标行 */}
      {step.status === 'ok' && enabled && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10.5px] font-mono text-notion-muted mb-1.5">
          {deltas.map((d, i) => (
            <span key={i} className={`${d.good ? 'text-notion-success' : ''}`}>
              {d.label} {d.before} → {d.after}
              {d.delta && <span className={`ml-0.5 ${d.good ? 'text-notion-success' : 'text-notion-faint'}`}>{d.delta}</span>}
            </span>
          ))}
        </div>
      )}

      {/* 人话解释 */}
      <div className="text-[11px] text-notion-muted leading-relaxed">
        {!enabled ? (
          <span className="text-notion-faint italic">（已关闭 · 视觉骨架）</span>
        ) : step.status === 'ok' ? (
          step.human || step.explain
        ) : step.status === 'skipped' ? (
          step.note ? `跳过：${step.note}` : '（未执行）'
        ) : (
          step.note ? `失败：${step.note}` : '处理出错'
        )}
      </div>
    </div>
  );
}

/** helper：把 (before, after, delta) 三元组格式化成一个可展示的 row，带 good/bad 判断 */
function metricRow(
  label: string,
  b: number | null | undefined,
  a: number | null | undefined,
  d: number | null | undefined,
  check: { target?: number; tolerance?: number; direction?: 'up' | 'down' },
) {
  const fmt = (v: number | null | undefined) => v != null ? (Math.abs(v) < 0.01 ? v.toFixed(3) : v.toFixed(2)) : '—';
  const deltaStr = d != null ? (d > 0 ? '+' : '') + d.toFixed(2) : '';

  let good = false;
  if (a != null && check.target != null) {
    if (check.direction === 'down') good = a <= check.target + (check.tolerance ?? 0);
    else if (check.direction === 'up') good = a >= check.target;
    else good = Math.abs(a - check.target) <= (check.tolerance ?? 0);
  }

  return { label, before: fmt(b), after: fmt(a), delta: deltaStr, good };
}
