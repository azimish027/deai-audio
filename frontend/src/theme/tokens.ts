/**
 * 主题引擎 · tokens.ts
 * 设计令牌 + 颜色工具函数
 *
 * 工具函数（hexToRgb/mixHex/rgba/luminance/primaryScale）拷贝自"精细时间块管理-设计复用完整包"。
 * 语义色板（LIGHT_TOKENS/DARK_TOKENS）改写为 Notion 简约风格——纯白底、细边框、低饱和文本。
 */

/* ============ 颜色工具 ============ */

export function normalizeHex(input: string): string | null {
  let v = input.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(v)) {
    v = v.split('').map((c) => c + c).join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(v)) return null;
  return `#${v.toLowerCase()}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = normalizeHex(hex) ?? '#1e6feb';
  return {
    r: parseInt(h.slice(1, 3), 16),
    g: parseInt(h.slice(3, 5), 16),
    b: parseInt(h.slice(5, 7), 16),
  };
}

/** 把 a 色向 b 色混合，t 为 b 的权重（0-1） */
export function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const to2 = (n: number) => n.toString(16).padStart(2, '0');
  return `#${to2(Math.round(ca.r + (cb.r - ca.r) * t))}${to2(
    Math.round(ca.g + (cb.g - ca.g) * t),
  )}${to2(Math.round(ca.b + (cb.b - ca.b) * t))}`;
}

export function rgba(hex: string, alpha: number): string {
  const c = hexToRgb(hex);
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
}

/** 相对亮度（0-1），用于推导按钮文字颜色 */
export function luminance(hex: string): number {
  const c = hexToRgb(hex);
  return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
}

/* ============ Notion 简约风浅色底语义色板 ============
 * 纯白底 + 细边框 + 低饱和文本。
 * 完全区别于原参考包的暖米白底（#f7f6f2）。
 */

export const LIGHT_TOKENS: Record<string, string> = {
  '--bg': '#ffffff',
  '--bg-gradient': 'none',
  '--canvas-bg': '#ffffff',
  '--card-bg': '#ffffff',
  '--surface-1': '#fafafa',
  '--surface-2': '#f4f4f4',
  '--surface-2-strong': '#ebebeb',
  '--surface-3': '#f0f0f0',
  '--border': '#e3e3e0',
  '--divider': '#ededed',
  '--divider-soft': '#f2f2f0',
  '--text': '#37352f',
  '--text-2': '#6b6b6b',
  '--text-3': '#9b9b9b',
  '--danger': '#e5484d',
  '--danger-tint': '#fdeeee',
  '--danger-border': '#f6c9cb',
  '--danger-text': '#b42324',
  '--success': '#2eb67d',
  '--glass': 'rgba(255, 255, 255, 0.96)',
  '--glass-soft': 'rgba(255, 255, 255, 0.92)',
  '--bg-glass': 'rgba(255, 255, 255, 0.96)',
  '--grid-bg': 'rgba(255, 255, 255, 0.82)',
  '--grid-minor': '#ececec',
  '--grid-major': '#e0e0e0',
  '--canvas-dot': '#e8e8e8',
  '--shadow-1': 'rgba(55, 53, 47, 0.06)',
  '--shadow-2': 'rgba(55, 53, 47, 0.10)',
  '--shadow-float': 'rgba(55, 53, 47, 0.12)',
  '--mask': 'rgba(55, 53, 47, 0.18)',
  '--mask-strong': 'rgba(55, 53, 47, 0.42)',
  '--overlay-strong': 'rgba(55, 53, 47, 0.82)',
  '--toast-bg': 'rgba(30, 30, 30, 0.92)',
  '--pattern-color': 'rgba(30, 111, 235, 0.04)',
  '--pattern-color-2': 'rgba(46, 182, 125, 0.03)',
};

/* ============ 深色底语义色板（Notion 风深色变体） ============ */

export const DARK_TOKENS: Record<string, string> = {
  '--bg': '#191919',
  '--bg-gradient': 'none',
  '--canvas-bg': '#191919',
  '--card-bg': '#202020',
  '--surface-1': '#252525',
  '--surface-2': '#2d2d2d',
  '--surface-2-strong': '#353535',
  '--surface-3': '#2a2a2a',
  '--border': '#333333',
  '--divider': '#2a2a2a',
  '--divider-soft': '#222222',
  '--text': '#e6e6e6',
  '--text-2': '#a0a0a0',
  '--text-3': '#707070',
  '--danger': '#f2555a',
  '--danger-tint': 'rgba(242, 85, 90, 0.14)',
  '--danger-border': 'rgba(242, 85, 90, 0.4)',
  '--danger-text': '#ff8a8e',
  '--success': '#34d399',
  '--glass': 'rgba(32, 32, 32, 0.96)',
  '--glass-soft': 'rgba(32, 32, 32, 0.92)',
  '--bg-glass': 'rgba(25, 25, 25, 0.96)',
  '--grid-bg': 'rgba(25, 25, 25, 0.82)',
  '--grid-minor': '#2a2a2a',
  '--grid-major': '#333333',
  '--canvas-dot': '#3a3a3a',
  '--shadow-1': 'rgba(0, 0, 0, 0.35)',
  '--shadow-2': 'rgba(0, 0, 0, 0.5)',
  '--shadow-float': 'rgba(0, 0, 0, 0.55)',
  '--mask': 'rgba(0, 0, 0, 0.5)',
  '--mask-strong': 'rgba(0, 0, 0, 0.62)',
  '--overlay-strong': 'rgba(0, 0, 0, 0.8)',
  '--toast-bg': 'rgba(20, 20, 20, 0.94)',
  '--pattern-color': 'rgba(255, 255, 255, 0.05)',
  '--pattern-color-2': 'rgba(255, 255, 255, 0.03)',
};

export const BASE_TOKENS: Record<'light' | 'dark', Record<string, string>> = {
  light: LIGHT_TOKENS,
  dark: DARK_TOKENS,
};

/* ============ 主色系推导（原封不动拷贝，这是精华） ============ */

/** 由主色推导主色系变量 */
export function primaryScale(primary: string, base: 'light' | 'dark'): Record<string, string> {
  const onPrimary = luminance(primary) > 0.58 ? '#37352f' : '#ffffff';
  if (base === 'dark') {
    return {
      '--primary': primary,
      '--primary-strong': mixHex(primary, '#ffffff', 0.12),
      '--primary-tint': rgba(primary, 0.16),
      '--primary-tint-strong': rgba(primary, 0.26),
      '--primary-tint-border': rgba(primary, 0.45),
      '--primary-deep': mixHex(primary, '#ffffff', 0.38),
      '--primary-soft': mixHex(primary, '#202020', 0.82),
      '--on-primary': onPrimary,
      '--primary-glow-1': rgba(primary, 0.3),
      '--primary-glow-2': rgba(primary, 0.55),
      '--primary-glow-3': rgba(primary, 0.22),
    };
  }
  return {
    '--primary': primary,
    '--primary-strong': mixHex(primary, '#000000', 0.16),
    '--primary-tint': mixHex(primary, '#ffffff', 0.9),
    '--primary-tint-strong': mixHex(primary, '#ffffff', 0.8),
    '--primary-tint-border': mixHex(primary, '#ffffff', 0.62),
    '--primary-deep': mixHex(primary, '#000000', 0.42),
    '--primary-soft': mixHex(primary, '#ffffff', 0.95),
    '--on-primary': onPrimary,
    '--primary-glow-1': rgba(primary, 0.28),
    '--primary-glow-2': rgba(primary, 0.55),
    '--primary-glow-3': rgba(primary, 0.18),
  };
}

/* ============ 字体 / 圆角 / 密度 ============ */

export const FONT_STACKS: Record<string, string> = {
  system: "'PingFang SC', 'HarmonyOS Sans SC', 'Segoe UI', system-ui, -apple-system, sans-serif",
  rounded: "'Yuanti SC', 'YouYuan', 'HarmonyOS Sans SC', 'PingFang SC', system-ui, sans-serif",
  serif: "'Songti SC', 'STSong', 'SimSun', 'Noto Serif CJK SC', serif",
  heiti: "'Heiti SC', 'SimHei', 'Noto Sans CJK SC', 'PingFang SC', sans-serif",
  kai: "'Kaiti SC', 'STKaiti', 'KaiTi', 'Noto Serif CJK SC', serif",
  mono: "ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, Consolas, monospace",
};

/** 圆角档位 —— 用 Notion 风格数值（standard 不是 18px，是 6px！） */
export const RADIUS_BY_LEVEL: Record<'compact' | 'standard' | 'rounded', { card: number; block: number; drawer: number; btn: number }> = {
  compact: { card: 4, block: 3, drawer: 6, btn: 4 },
  standard: { card: 6, block: 4, drawer: 8, btn: 6 },
  rounded: { card: 10, block: 6, drawer: 12, btn: 10 },
};

/** 密度档位 —— 用 Notion 风格数值（更宽松，更多留白） */
export const DENSITY_BY_LEVEL: Record<'compact' | 'comfort' | 'spacious', { pad: number; gap: number; panelGap: number }> = {
  compact: { pad: 10, gap: 8, panelGap: 8 },
  comfort: { pad: 14, gap: 12, panelGap: 12 },
  spacious: { pad: 20, gap: 16, panelGap: 16 },
};
