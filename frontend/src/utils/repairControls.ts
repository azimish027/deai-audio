/**
 * repairControls —— StepControls + HumanPreserveControls 工厂
 *
 * 两套 controls：
 *   StepControls       → 9 步 pipeline enabled + strengths（真开关）
 *   HumanPreserveControls → 人味保护子开关（5 项）
 *       enabled / pitch_correct / pitch_tolerance_cents / keep_breath / keep_slur /
 *       dynamic_wide / loudness_tolerance_lufs / denoise_strength_mult / deverb_wet_retention_mult
 *
 * 压缩规则：StepControls 只传非默认值；HumanPreserveControls 同理。
 */

export interface StepControls {
  enabled: Record<string, boolean>;
  strengths: Record<string, number>;
}

export interface HumanPreserveControls {
  enabled: boolean;
  pitch_correct: boolean;
  pitch_tolerance_cents: number;
  keep_breath: boolean;
  keep_slur: boolean;
  dynamic_wide: boolean;
  loudness_tolerance_lufs: number;
}

export const ALL_STEP_IDS = [
  'dc_offset',
  'declip',
  'separation',
  'denoise',
  'deverb',
  'transient_restore',
  'deesser',
  'loudness_normalize',
  'true_peak_limit',
];

export const STEP_NAMES_ZH: Record<string, string> = {
  dc_offset: 'DC Offset 去除',
  declip: '削波修复',
  separation: 'Demucs 源分离',
  denoise: 'DeepFilterNet 降噪',
  deverb: '去混响',
  transient_restore: '瞬态恢复',
  deesser: '去齿音',
  loudness_normalize: '响度标准化 (EBU R128)',
  true_peak_limit: 'True Peak 限幅',
};

export function makeDefaultControls(): StepControls & { human: HumanPreserveControls } {
  const enabled: Record<string, boolean> = {};
  const strengths: Record<string, number> = {};
  for (const id of ALL_STEP_IDS) {
    enabled[id] = true;
    strengths[id] = 1.0;
  }
  return { enabled, strengths, human: makeDefaultHuman() };
}

export function makeDefaultHuman(): HumanPreserveControls {
  return {
    enabled: true,
    pitch_correct: true,
    pitch_tolerance_cents: 15,      // ±15 cents 不修音（反直觉点）
    keep_breath: true,              // 气口保留
    keep_slur: true,                // 滑音保留
    dynamic_wide: true,             // 动态宽
    loudness_tolerance_lufs: 1.5,   // ±1.5 LUFS 容忍度
  };
}

/** 合并两套 controls 压缩成最小后端 params */
export function controlsToParams(c: StepControls & { human?: HumanPreserveControls }) {
  const out: {
    enabled?: Record<string, boolean>;
    strengths?: Record<string, number>;
    human_preserve?: Record<string, unknown>;
  } = {};

  // StepControls
  const enabled: Record<string, boolean> = {};
  const strengths: Record<string, number> = {};
  let changedE = false, changedS = false;
  for (const id of ALL_STEP_IDS) {
    if (c.enabled[id] !== true) { enabled[id] = c.enabled[id]; changedE = true; }
    if (Math.abs((c.strengths[id] ?? 1.0) - 1.0) > 0.01) { strengths[id] = c.strengths[id]; changedS = true; }
  }
  if (changedE) out.enabled = enabled;
  if (changedS) out.strengths = strengths;

  // HumanPreserveControls
  const human = c.human;
  if (human) {
    const hpOut: Record<string, unknown> = {};
    const hpDef = makeDefaultHuman();
    for (const key of Object.keys(human) as (keyof HumanPreserveControls)[]) {
      if (human[key] !== hpDef[key]) hpOut[key] = human[key];
    }
    // human_preserve.enabled 总是要传（用户可能明确关了）
    hpOut.enabled = human.enabled;
    out.human_preserve = hpOut;
  }

  return out;
}

/** 生成人类可读摘要（给 IntentPreview 显示） */
export function summarizeControls(c: StepControls & { human?: HumanPreserveControls }): {
  stepOff: string[];
  stepModified: { id: string; name: string; value: number }[];
  human: HumanPreserveControls | null;
  summary: string;
} {
  const stepOff = ALL_STEP_IDS.filter((id) => c.enabled[id] === false);
  const stepModified = ALL_STEP_IDS
    .filter((id) => Math.abs((c.strengths[id] ?? 1.0) - 1.0) > 0.01)
    .map((id) => ({ id, name: STEP_NAMES_ZH[id] ?? id, value: c.strengths[id] ?? 1.0 }));

  const parts: string[] = [];
  if (stepOff.length) parts.push(`关 ${stepOff.map((id) => STEP_NAMES_ZH[id] ?? id).join('、')}`);
  if (stepModified.length) parts.push(stepModified.map((m) => `${m.name} ${m.value.toFixed(1)}x`).join('；'));

  return {
    stepOff,
    stepModified,
    human: c.human ?? null,
    summary: parts.length ? parts.join('，') : '全部启用，模板默认',
  };
}

/** 生成人味摘要（IntentPreview 单独显示） */
export function summarizeHuman(hp: HumanPreserveControls): string {
  if (!hp.enabled) return '❌ 人味保护关闭（电台感优先）';
  const parts: string[] = [];
  parts.push(`修音 ±${hp.pitch_tolerance_cents} cents`);
  parts.push(hp.keep_breath ? '保留气口' : '气口不保留');
  parts.push(hp.keep_slur ? '保留滑音' : '滑音量化');
  parts.push(hp.dynamic_wide ? '动态宽' : '动态压缩');
  parts.push(`±${hp.loudness_tolerance_lufs.toFixed(1)} LUFS 容忍`);
  return '🧬 人味保护 · ' + parts.join(' · ');
}
