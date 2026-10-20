/**
 * StepCards —— 处理链每步骤一张卡（完整版）
 *
 * 受控组件：enabled + strengths 由父组件持有，每步 toggle 开关 + 强度滑条实时调。
 * 调完后父组件可以直接把两个 dict 传给 processSession → 后端 Pipeline 真正感知。
 */
import { CheckCircle2, AlertTriangle, CircleMinus, AudioWaveform, Volume2, Zap, Waves, Mic, Gauge, Power, PowerOff } from 'lucide-react';
import { useMemo } from 'react';
import type { RepairMeasurements, StepMeasurement } from '../../types/project';

export interface StepControls {
  enabled: Record<string, boolean>;
  strengths: Record<string, number>;  // step_id → 强度倍率（0~2）
}

interface Props {
  measurements?: RepairMeasurements;
  controls: StepControls;
  onChange: (next: StepControls) => void;
}

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

/** 哪些 step 有 strength 滑条 + 滑条范围 */
const STRENGTH_CONFIG: Record<string, { min: number; max: number; step: number; label: string }> = {
  denoise:            { min: 0, max: 2.0, step: 0.1, label: '降噪强度' },
  deverb:             { min: 0, max: 2.0, step: 0.1, label: '去混响激进度' },
  transient_restore:  { min: 0, max: 2.0, step: 0.1, label: '瞬态恢复力度' },
  deesser:            { min: 0, max: 1.5, step: 0.1, label: '去齿音强度' },
  loudness_normalize: { min: 0, max: 2.0, step: 0.1, label: '响度偏移（±1LU/0.5×）' },
};

function StepIcon({ id }: { id: string }) {
  const Ic = STEP_ICON[id] ?? AudioWaveform;
  return <Ic className="w-3.5 h-3.5" />;
}

export function StepCards({ measurements, controls, onChange }: Props) {
  const steps = measurements?.steps ?? [];
  const { enabled, strengths } = controls;

  const allOn = useMemo(
    () => steps.length > 0 && steps.every((s) => enabled[s.step_id] ?? true),
    [steps, enabled],
  );

  const toggle = (id: string) => onChange({ ...controls, enabled: { ...enabled, [id]: !(enabled[id] ?? true) } });
  const setStrength = (id: string, v: number) => onChange({ ...controls, strengths: { ...strengths, [id]: v } });
  const toggleAll = () => {
    const next: Record<string, boolean> = {};
    for (const s of steps) next[s.step_id] = !allOn;
    onChange({ ...controls, enabled: next });
  };

  if (!steps.length) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-notion-faint">
        <AudioWaveform className="w-3 h-3" />
        <span>处理链 · 每步动作 + 控制</span>
        <span className="normal-case tracking-normal ml-auto text-[10px]">
          {steps.filter((s) => s.status === 'ok' && (enabled[s.step_id] ?? true)).length} 启用 ·
          {steps.filter((s) => !(enabled[s.step_id] ?? true)).length} 关闭 ·
          {steps.filter((s) => s.status === 'skipped' && (enabled[s.step_id] ?? true)).length} 运行时跳过
        </span>
        <button
          onClick={toggleAll}
          className="ml-1 text-[10px] px-1.5 py-0.5 rounded border border-notion-border hover:border-notion-accent text-notion-muted hover:text-notion-accent transition-colors"
          title={allOn ? '全部关闭' : '全部开启'}
        >
          {allOn ? <PowerOff className="w-3 h-3" /> : <Power className="w-3 h-3" />}
        </button>
      </div>

      <div className="space-y-1.5">
        {steps.map((step, i) => {
          const on = enabled[step.step_id] ?? true;
          return (
            <StepCard
              key={step.step_id + i}
              step={step}
              index={i}
              enabled={on}
              strength={strengths[step.step_id] ?? 1.0}
              hasStrength={step.step_id in STRENGTH_CONFIG}
              strengthConfig={STRENGTH_CONFIG[step.step_id]}
              onToggle={() => toggle(step.step_id)}
              onStrengthChange={(v) => setStrength(step.step_id, v)}
            />
          );
        })}
      </div>

      <div className="text-[10px] text-notion-faint px-1 pt-1 leading-relaxed">
        💡 调完开关和强度后点"重跑"即可生效——后端 Pipeline 会根据你关的步骤跳过、
        根据强度倍率覆盖模板默认值。<span className="text-notion-muted">关了 DC offset / declip / separation 也生效。</span>
      </div>
    </div>
  );
}

interface StepCardProps {
  step: StepMeasurement;
  index: number;
  enabled: boolean;
  strength: number;
  hasStrength: boolean;
  strengthConfig?: { min: number; max: number; step: number; label: string };
  onToggle: () => void;
  onStrengthChange: (v: number) => void;
}

function StepCard({ step, index, enabled, strength, hasStrength, strengthConfig, onToggle, onStrengthChange }: StepCardProps) {
  const statusColor = step.status === 'ok' ? 'border-l-notion-success'
    : step.status === 'skipped' ? 'border-l-notion-faint opacity-60'
    : 'border-l-notion-danger';

  const StatusIcon = step.status === 'ok' ? CheckCircle2
    : step.status === 'skipped' ? CircleMinus
    : AlertTriangle;

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
      {/* 顶部 */}
      <div className="flex items-center gap-1.5 mb-1">
        <span className="w-4 h-4 text-[9px] rounded bg-notion-hover text-notion-faint flex items-center justify-center shrink-0 font-mono">{index + 1}</span>
        <StepIcon id={step.step_id} />
        <span className="text-[12px] font-medium text-notion-text-2">{step.name}</span>
        <StatusIcon className={`w-3 h-3 ml-auto ${step.status === 'ok' ? 'text-notion-success' : step.status === 'skipped' ? 'text-notion-faint' : 'text-notion-danger'}`} />
        <button
          onClick={onToggle}
          className={`w-7 h-4 rounded-full relative transition-colors ${enabled ? 'bg-notion-accent/60' : 'bg-notion-border'}`}
          title={enabled ? '关闭此步（下次运行跳过）' : '开启此步'}
        >
          <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${enabled ? 'left-3.5' : 'left-0.5'}`} />
        </button>
      </div>

      {/* 强度滑条（有的 step 有） */}
      {hasStrength && strengthConfig && (
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-[10px] text-notion-muted w-[110px] shrink-0">{strengthConfig.label}</span>
          <input
            type="range"
            min={strengthConfig.min}
            max={strengthConfig.max}
            step={strengthConfig.step}
            value={strength}
            onChange={(e) => onStrengthChange(parseFloat(e.target.value))}
            disabled={!enabled}
            className="flex-1 accent-notion-accent h-1"
          />
          <span className="text-[10px] font-mono w-10 text-right text-notion-muted">
            {strength === 1.0 ? '默认' : strength.toFixed(1) + 'x'}
          </span>
        </div>
      )}

      {/* 指标行 */}
      {step.status === 'ok' && enabled && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10.5px] font-mono text-notion-muted mb-1">
          {deltas.map((d, i) => (
            <span key={i} className={`${d.good ? 'text-notion-success' : ''}`}>
              {d.label} {d.before} → {d.after}
              {d.delta && <span className={`ml-0.5 ${d.good ? 'text-notion-success' : 'text-notion-faint'}`}>{d.delta}</span>}
            </span>
          ))}
        </div>
      )}

      {/* 人话 */}
      <div className="text-[11px] text-notion-muted leading-relaxed">
        {!enabled ? (
          <span className="text-notion-faint italic">（用户关闭 —— 下次运行跳过此步）</span>
        ) : step.status === 'ok' ? (
          step.human || step.explain
        ) : step.status === 'skipped' ? (
          step.note ? `运行时跳过：${step.note}` : '（未执行）'
        ) : (
          step.note ? `失败：${step.note}` : '处理出错'
        )}
      </div>
    </div>
  );
}

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
