/**
 * StepCards —— 处理链每步骤一张卡 + 人味保护子面板
 *
 * 顶部 HumanPreservePanel（默认展开）→ 5 项人味子开关
 * 下面 9 张步骤卡 → 每张卡独立 toggle 开关 + 强度滑条
 *
 * 两套 params 通过 controlsToParams(c, human) 压缩传给后端：
 *   Pipeline.run(params={enabled, strengths, human_preserve})
 *
 * human_preserve 在 Pipeline.run() 里覆盖模板默认值：
 *   denoise_strength ×0.6 / deverb_wet_retention ×1.5 / pitch tolerance / loudness tolerance
 */
import { CheckCircle2, AlertTriangle, CircleMinus, AudioWaveform, Volume2, Zap, Waves, Mic, Gauge, Power, PowerOff, Dna, ChevronDown, ChevronUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { RepairMeasurements, StepMeasurement } from '../../types/project';
import type { HumanPreserveControls } from '../../utils/repairControls';

export interface StepControls {
  enabled: Record<string, boolean>;
  strengths: Record<string, number>;
}

interface Props {
  measurements?: RepairMeasurements;
  controls: StepControls;
  human?: HumanPreserveControls;
  onControlsChange: (next: StepControls) => void;
  onHumanChange?: (next: HumanPreserveControls) => void;
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

const STRENGTH_CONFIG: Record<string, { min: number; max: number; step: number; label: string }> = {
  denoise:            { min: 0, max: 2.0, step: 0.1, label: '降噪强度' },
  deverb:             { min: 0, max: 2.0, step: 0.1, label: '去混响激进度' },
  transient_restore:  { min: 0, max: 2.0, step: 0.1, label: '瞬态恢复力度' },
  deesser:            { min: 0, max: 1.5, step: 0.1, label: '去齿音强度' },
  loudness_normalize: { min: 0, max: 2.0, step: 0.1, label: '响度偏移' },
};

function StepIcon({ id }: { id: string }) {
  const Ic = STEP_ICON[id] ?? AudioWaveform;
  return <Ic className="w-3.5 h-3.5" />;
}

function BoolSwitch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`w-7 h-4 rounded-full relative transition-colors shrink-0 ${on ? 'bg-notion-accent/70' : 'bg-notion-border'}`}
    >
      <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${on ? 'left-3.5' : 'left-0.5'}`} />
    </button>
  );
}

export function StepCards({ measurements, controls, human, onControlsChange, onHumanChange }: Props) {
  const steps = measurements?.steps ?? [];
  const { enabled, strengths } = controls;
  const [hpOpen, setHpOpen] = useState(true);

  const allOn = useMemo(
    () => steps.length > 0 && steps.every((s) => enabled[s.step_id] ?? true),
    [steps, enabled],
  );

  const toggle = (id: string) => onControlsChange({ ...controls, enabled: { ...enabled, [id]: !(enabled[id] ?? true) } });
  const setStrength = (id: string, v: number) => onControlsChange({ ...controls, strengths: { ...strengths, [id]: v } });
  const toggleAll = () => {
    const next: Record<string, boolean> = {};
    for (const s of steps) next[s.step_id] = !allOn;
    onControlsChange({ ...controls, enabled: next });
  };

  if (!steps.length && !human) return null;

  return (
    <div className="space-y-2">
      {/* ── 人味保护面板 ── */}
      {human && onHumanChange && (
        <div className="notion-card p-2.5 border-l-2 border-l-notion-accent bg-notion-accent/[0.03]">
          <button
            className="w-full flex items-center justify-between text-[11px] uppercase tracking-wider text-notion-muted hover:text-notion-text-2"
            onClick={() => setHpOpen((o) => !o)}
          >
            <span className="flex items-center gap-1.5">
              <Dna className="w-3 h-3 text-notion-accent" />
              🧬 人味保护（默认开）
              <span className={`normal-case tracking-normal text-[10px] ${human.enabled ? 'text-notion-accent' : 'text-notion-danger'}`}>
                {human.enabled ? '启用' : '关闭'}
              </span>
            </span>
            {hpOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {hpOpen && (
            <div className="mt-2 space-y-1.5 text-[11px]">
              {/* 总开关 */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-notion-faint w-[80px] shrink-0">总开关</span>
                <BoolSwitch on={human.enabled} onChange={(v) => onHumanChange({ ...human, enabled: v })} />
                <span className="text-[10px] text-notion-muted">
                  {human.enabled
                    ? '开启：降噪砍 40%，混响保留 50%，修音 ±15 cents 容忍'
                    : '关闭：电台感优先，降噪/去混响/修音精确到模板默认'}
                </span>
              </div>

              {human.enabled && (
                <>
                  <HumanRow
                    label="修音强度"
                    hint={`±${human.pitch_tolerance_cents} cents 内不修`}
                  >
                    <input
                      type="range"
                      min={0}
                      max={30}
                      step={1}
                      value={human.pitch_tolerance_cents}
                      onChange={(e) => onHumanChange({ ...human, pitch_tolerance_cents: parseInt(e.target.value) })}
                      className="flex-1 accent-notion-accent h-1"
                    />
                    <span className="text-[10px] font-mono w-14 text-right text-notion-muted">
                      {human.pitch_tolerance_cents === 0 ? '关闭' : `±${human.pitch_tolerance_cents}c`}
                    </span>
                  </HumanRow>

                  <HumanRow label="气口保留" hint="降噪时不衰减吸气段">
                    <BoolSwitch on={human.keep_breath} onChange={(v) => onHumanChange({ ...human, keep_breath: v })} />
                  </HumanRow>

                  <HumanRow label="滑音保留" hint="pitch 检测不量化滑音段">
                    <BoolSwitch on={human.keep_slur} onChange={(v) => onHumanChange({ ...human, keep_slur: v })} />
                  </HumanRow>

                  <HumanRow label="动态范围" hint="不过度压缩，保留自然起伏">
                    <BoolSwitch on={human.dynamic_wide} onChange={(v) => onHumanChange({ ...human, dynamic_wide: v })} />
                  </HumanRow>

                  <HumanRow label="响度容忍" hint={`±${human.loudness_tolerance_lufs.toFixed(1)} LUFS（越精确越像电台）`}>
                    <input
                      type="range"
                      min={0.5}
                      max={3.0}
                      step={0.1}
                      value={human.loudness_tolerance_lufs}
                      onChange={(e) => onHumanChange({ ...human, loudness_tolerance_lufs: parseFloat(e.target.value) })}
                      className="flex-1 accent-notion-accent h-1"
                    />
                    <span className="text-[10px] font-mono w-14 text-right text-notion-muted">
                      ±{human.loudness_tolerance_lufs.toFixed(1)} LU
                    </span>
                  </HumanRow>
                </>
              )}

              <div className="text-[10px] text-notion-faint leading-relaxed pt-1 border-t border-notion-border/40 mt-1">
                💡 "修音修到 100% 准，人味就死了" —— 允许微偏差 + 保留气口滑音 = 像一个活人在唱。
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 步骤卡列表 ── */}
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-notion-faint">
        <AudioWaveform className="w-3 h-3" />
        <span>处理链 · 每步动作 + 控制</span>
        <span className="normal-case tracking-normal ml-auto text-[10px]">
          {steps.filter((s) => s.status === 'ok' && (enabled[s.step_id] ?? true)).length} 启用 ·
          {steps.filter((s) => !(enabled[s.step_id] ?? true)).length} 关闭
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
        💡 调完人味开关/步骤开关/强度 → 点"重跑"即可——后端 Pipeline 会根据你关的步骤跳过、
        根据强度倍率覆盖模板默认值、根据人味保护砍降噪/保混响/放宽容忍度。
      </div>
    </div>
  );
}

function HumanRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-notion-faint w-[80px] shrink-0 leading-snug">{label}</span>
      <div className="flex-1 flex items-center gap-2 min-w-0">{children}</div>
      {hint && <span className="text-[9px] text-notion-faint max-w-[140px] truncate">{hint}</span>}
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

  return (
    <div className={[
      'notion-card p-2.5 pl-3 border-l-2 transition-all',
      statusColor,
      !enabled && 'grayscale opacity-60',
    ].filter(Boolean).join(' ')}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="w-4 h-4 text-[9px] rounded bg-notion-hover text-notion-faint flex items-center justify-center shrink-0 font-mono">{index + 1}</span>
        <StepIcon id={step.step_id} />
        <span className="text-[12px] font-medium text-notion-text-2">{step.name}</span>
        <StatusIcon className={`w-3 h-3 ml-auto ${step.status === 'ok' ? 'text-notion-success' : step.status === 'skipped' ? 'text-notion-faint' : 'text-notion-danger'}`} />
        <BoolSwitch on={enabled} onChange={onToggle} />
      </div>

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
