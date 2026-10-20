/**
 * repairControls —— StepControls 默认值工厂 + 摘要工具
 *
 * 9 个已知 step_id 列表，加上默认 enabled=true + strength=1.0。
 * StepCards 的 STRENGTH_CONFIG 里有 5 个 step 支持强度滑条。
 */
import type { StepControls } from '../components/metrics/StepCards';

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

export function makeDefaultControls(): StepControls {
  const enabled: Record<string, boolean> = {};
  const strengths: Record<string, number> = {};
  for (const id of ALL_STEP_IDS) {
    enabled[id] = true;
    strengths[id] = 1.0;
  }
  return { enabled, strengths };
}

/** 把完整 controls 压缩成最小 params 结构（只传非默认值，省带宽） */
export function controlsToParams(c: StepControls): { enabled?: Record<string, boolean>; strengths?: Record<string, number> } {
  const enabled: Record<string, boolean> = {};
  const strengths: Record<string, number> = {};
  let enabledChanged = false;
  let strengthsChanged = false;
  for (const id of ALL_STEP_IDS) {
    if (c.enabled[id] !== true) { enabled[id] = c.enabled[id]; enabledChanged = true; }
    if (Math.abs((c.strengths[id] ?? 1.0) - 1.0) > 0.01) { strengths[id] = c.strengths[id]; strengthsChanged = true; }
  }
  return {
    enabled: enabledChanged ? enabled : undefined,
    strengths: strengthsChanged ? strengths : undefined,
  };
}

/** 生成人类可读摘要（给 IntentPreview 显示） */
export function summarizeControls(c: StepControls): {
  off: string[];
  modified: { id: string; name: string; value: number }[];
  summary: string;  // "全部启用，无强度调整" / "关了降噪、去齿音；deverb 1.3x"
} {
  const off = ALL_STEP_IDS.filter((id) => c.enabled[id] === false);
  const modified = ALL_STEP_IDS
    .filter((id) => Math.abs((c.strengths[id] ?? 1.0) - 1.0) > 0.01)
    .map((id) => ({ id, name: STEP_NAMES_ZH[id] ?? id, value: c.strengths[id] ?? 1.0 }));

  const parts: string[] = [];
  if (off.length) parts.push(`关 ${off.map((id) => STEP_NAMES_ZH[id] ?? id).join('、')}`);
  if (modified.length) parts.push(modified.map((m) => `${m.name} ${m.value.toFixed(1)}x`).join('；'));

  return {
    off,
    modified,
    summary: parts.length ? parts.join('，') : '全部启用，强度模板默认',
  };
}
