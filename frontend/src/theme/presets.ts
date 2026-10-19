/**
 * 主题引擎 · presets.ts
 * 主题类型 + 5套 Notion 简约风预设 + 自定义主题配置接口 + 校验
 *
 * 设计哲学：
 *   - 预设体现作者审美（干净、留白、Notion简约）
 *   - 自定义完全开放，用户想怎么DIY就怎么DIY，零限制
 *   - normalizeCustomTheme 只做技术兜底（非法值回退默认），不做审美限制
 */

export type BaseMode = 'light' | 'dark';
export type BorderLevel = 'none' | 'thin' | 'bold';
export type RadiusLevel = 'compact' | 'standard' | 'rounded';
export type DensityLevel = 'compact' | 'comfort' | 'spacious';
export type PanelArrangement = 'duo' | 'single';
export type CardStyle = 'solid' | 'glass';
export type PatternType =
  | 'none'
  | 'dots'
  | 'paper'
  | 'glow'
  | 'stripes'
  | 'grid'
  | 'checker'
  | 'crosshatch'
  | 'waves'
  | 'rings'
  | 'halftone';
/** 自定义背景图显示模式 —— 直连 CSS background-size 语义 */
export type BgSizeMode = 'cover' | 'contain' | 'auto' | 'stretch';

/** 主题预设 = 配色 + 布局档位 + 背景图案 */
export interface ThemePreset {
  id: string;
  name: string;
  desc: string;
  swatches: string[];
  primary: string;
  base: BaseMode;
  layout: {
    density: DensityLevel;
    arrangement: PanelArrangement;
    cardStyle: CardStyle;
    borderLevel: BorderLevel;
    radiusLevel: RadiusLevel;
  };
  pattern: PatternType;
  patternOpacity: number;
}

/**
 * 5 套 Notion 简约风预设（只有主色/背景有微差，其余几乎相同）
 * 每套最多变化 3 个变量，体现"克制的审美"
 */
export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'default',
    name: 'Default · 蓝',
    desc: '纯白底 + 蓝主色 + 细边框 · Notion 风格基线',
    swatches: ['#1e6feb', '#ffffff', '#37352f', '#e3e3e0'],
    primary: '#1e6feb',
    base: 'light',
    layout: { density: 'comfort', arrangement: 'duo', cardStyle: 'solid', borderLevel: 'thin', radiusLevel: 'standard' },
    pattern: 'none',
    patternOpacity: 0,
  },
  {
    id: 'mint',
    name: 'Mint · 薄荷',
    desc: '纯白底 + 薄荷绿主色 · 冷静柔和',
    swatches: ['#2eb67d', '#ffffff', '#37352f', '#e3e3e0'],
    primary: '#2eb67d',
    base: 'light',
    layout: { density: 'comfort', arrangement: 'duo', cardStyle: 'solid', borderLevel: 'thin', radiusLevel: 'standard' },
    pattern: 'none',
    patternOpacity: 0,
  },
  {
    id: 'paper',
    name: 'Paper · 米纸',
    desc: '暖米白底 + 淡点状肌理 · 微有温度',
    swatches: ['#1e6feb', '#faf8f5', '#4a4a45', '#e3e0da'],
    primary: '#1e6feb',
    base: 'light',
    layout: { density: 'comfort', arrangement: 'duo', cardStyle: 'solid', borderLevel: 'thin', radiusLevel: 'standard' },
    pattern: 'dots',
    patternOpacity: 3,
  },
  {
    id: 'focus',
    name: 'Focus · 专注',
    desc: '冷白底 + 深色文字 + 稍深边框 · 长时间阅读',
    swatches: ['#1e6feb', '#f7f7f5', '#2c2b27', '#d4d4d0'],
    primary: '#1e6feb',
    base: 'light',
    layout: { density: 'comfort', arrangement: 'duo', cardStyle: 'solid', borderLevel: 'bold', radiusLevel: 'standard' },
    pattern: 'none',
    patternOpacity: 0,
  },
  {
    id: 'cream',
    name: 'Cream · 暖白',
    desc: '暖米白底 + 软文字 · 更有温度',
    swatches: ['#1e6feb', '#faf8f5', '#4a4a45', '#e3e0da'],
    primary: '#1e6feb',
    base: 'light',
    layout: { density: 'comfort', arrangement: 'duo', cardStyle: 'solid', borderLevel: 'thin', radiusLevel: 'standard' },
    pattern: 'none',
    patternOpacity: 0,
  },
];

/* ============ 自定义主题配置（完全开放，零审美限制） ============ */

export interface CustomThemeConfig {
  id: string;
  name: string;
  base: BaseMode;
  primary: string;
  borderLevel: BorderLevel;
  radiusLevel: RadiusLevel;
  density: DensityLevel;
  arrangement: PanelArrangement;
  cardStyle: CardStyle;
  pattern: PatternType;
  patternOpacity: number;
  btnOpacity: number;
  fontColor: string;
  fontSizeLevel: 'standard' | 'large';
  fontFamily: 'system' | 'rounded' | 'serif' | 'heiti' | 'kai' | 'mono';
  /** 预设 id（如果是从预设派生的，记录来源） */
  presetId?: string;

  /* ===== 自定义背景图（全部可选，不传则不渲染背景图层） ===== */

  /** 上传图片的 dataURL（由 FileReader 读入）；undefined = 无自定义背景图 */
  bgImage?: string;
  /** 背景图层透明度 0-100（只作用于独立背景层，绝不作用于容器） */
  bgOpacity: number;
  /** 背景图层高斯模糊 0-30px */
  bgBlur: number;
  /** 显示模式 —— 直连 CSS background-size */
  bgSize: BgSizeMode;
  /** 背景位置 —— 标准 CSS background-position 值 */
  bgPosition: string;
}

/** 默认值 —— 即 Default 预设的完整展开 */
export const DEFAULT_CUSTOM_THEME: CustomThemeConfig = {
  id: 'default',
  name: 'Default',
  base: 'light',
  primary: '#1e6feb',
  borderLevel: 'thin',
  radiusLevel: 'standard',
  density: 'comfort',
  arrangement: 'duo',
  cardStyle: 'solid',
  pattern: 'none',
  patternOpacity: 0,
  btnOpacity: 100,
  fontColor: '',
  fontSizeLevel: 'standard',
  fontFamily: 'system',
  presetId: 'default',
  bgImage: undefined,
  bgOpacity: 100,
  bgBlur: 0,
  bgSize: 'cover',
  bgPosition: 'center center',
};

/** 从 ThemePreset 转成 CustomThemeConfig */
export function presetToCustomTheme(preset: ThemePreset): CustomThemeConfig {
  return {
    id: preset.id,
    name: preset.name,
    base: preset.base,
    primary: preset.primary,
    borderLevel: preset.layout.borderLevel,
    radiusLevel: preset.layout.radiusLevel,
    density: preset.layout.density,
    arrangement: preset.layout.arrangement,
    cardStyle: preset.layout.cardStyle,
    pattern: preset.pattern,
    patternOpacity: preset.patternOpacity,
    btnOpacity: 100,
    fontColor: '',
    fontSizeLevel: 'standard',
    fontFamily: 'system',
    presetId: preset.id,
    // 预设默认不带背景图，保持干净
    bgImage: undefined,
    bgOpacity: 100,
    bgBlur: 0,
    bgSize: 'cover',
    bgPosition: 'center center',
  };
}

/* ============ 归一化（技术兜底，零审美限制） ============ */

const isOneOf = <T,>(v: unknown, list: readonly T[]): v is T => list.includes(v as T);

/**
 * 兼容校验历史存档
 * - 只做格式校验（非法值回退默认）
 * - 不做任何审美层面的限制（patternOpacity 100% 也允许）
 */
export function normalizeCustomTheme(value: unknown, id: string, fallbackName: string): CustomThemeConfig {
  const v = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  const base: BaseMode = v.base === 'dark' ? 'dark' : 'light';
  const clampNum = (val: unknown, max: number, fallback: number) =>
    typeof val === 'number' && Number.isFinite(val) ? Math.min(max, Math.max(0, val)) : fallback;
  const isString = (x: unknown): x is string => typeof x === 'string';
  return {
    id,
    name: isString(v.name) && v.name.trim() ? v.name.trim() : fallbackName,
    base,
    primary:
      isString(v.primary) && /^#[0-9a-fA-F]{6}$/.test(v.primary.trim())
        ? v.primary.trim().toLowerCase()
        : DEFAULT_CUSTOM_THEME.primary,
    borderLevel: isOneOf(v.borderLevel, ['none', 'thin', 'bold'] as const) ? v.borderLevel : DEFAULT_CUSTOM_THEME.borderLevel,
    radiusLevel: isOneOf(v.radiusLevel, ['compact', 'standard', 'rounded'] as const) ? v.radiusLevel : DEFAULT_CUSTOM_THEME.radiusLevel,
    density: isOneOf(v.density, ['compact', 'comfort', 'spacious'] as const) ? v.density : DEFAULT_CUSTOM_THEME.density,
    arrangement: v.arrangement === 'single' ? 'single' : 'duo',
    cardStyle: v.cardStyle === 'glass' ? 'glass' : 'solid',
    pattern: isOneOf(v.pattern, [
      'none', 'dots', 'paper', 'glow', 'stripes', 'grid', 'checker', 'crosshatch', 'waves', 'rings', 'halftone',
    ] as const)
      ? v.pattern
      : DEFAULT_CUSTOM_THEME.pattern,
    // 零限制：patternOpacity / btnOpacity / bgOpacity / bgBlur 允许 0-100 / 0-30 全部值
    patternOpacity: clampNum(v.patternOpacity, 100, DEFAULT_CUSTOM_THEME.patternOpacity),
    btnOpacity: clampNum(v.btnOpacity, 100, DEFAULT_CUSTOM_THEME.btnOpacity),
    fontColor: isString(v.fontColor) && v.fontColor.trim() ? v.fontColor.trim() : '',
    fontSizeLevel: v.fontSizeLevel === 'large' ? 'large' : 'standard',
    fontFamily: isOneOf(v.fontFamily, ['system', 'rounded', 'serif', 'heiti', 'kai', 'mono'] as const) ? v.fontFamily : 'system',
    presetId: isString(v.presetId) ? v.presetId : undefined,

    /* ===== 自定义背景图兜底 ===== */
    bgImage: isString(v.bgImage) && v.bgImage.startsWith('data:image/') ? v.bgImage : undefined,
    bgOpacity: clampNum(v.bgOpacity, 100, DEFAULT_CUSTOM_THEME.bgOpacity),
    bgBlur: clampNum(v.bgBlur, 30, DEFAULT_CUSTOM_THEME.bgBlur),
    bgSize: isOneOf(v.bgSize, ['cover', 'contain', 'auto', 'stretch'] as const) ? v.bgSize : DEFAULT_CUSTOM_THEME.bgSize,
    bgPosition: isString(v.bgPosition) && v.bgPosition.trim() ? v.bgPosition.trim() : DEFAULT_CUSTOM_THEME.bgPosition,
  };
}
