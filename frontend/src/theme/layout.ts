/**
 * 主题引擎 · layout.ts
 * 布局档位 + 背景图案层 + buildThemeVars 主入口
 *
 * 原封不动拷贝自参考包，仅把 import 路径指向本地 tokens.ts / presets.ts。
 * 这是主题化工程的核心结构，不做任何修改。
 */

import { BASE_TOKENS, DENSITY_BY_LEVEL, RADIUS_BY_LEVEL, mixHex, primaryScale, FONT_STACKS } from './tokens';
import type { BaseMode, BorderLevel, CardStyle, DensityLevel, PatternType, RadiusLevel, CustomThemeConfig } from './presets';

/** 布局档位：密度 + 圆角 + 边框 + 卡片质感 */
export interface ThemeLayout {
  density: DensityLevel;
  cardStyle: CardStyle;
  borderLevel: BorderLevel;
  radiusLevel: RadiusLevel;
}

/** 布局档位 → CSS 变量 */
export function buildLayoutVars(layout: Pick<ThemeLayout, 'borderLevel' | 'density'>, borderColor: string): Record<string, string> {
  const d = DENSITY_BY_LEVEL[layout.density];
  return {
    '--card-border-width': layout.borderLevel === 'none' ? '0px' : layout.borderLevel === 'bold' ? '2px' : '1px',
    '--card-border-color': borderColor,
    '--card-pad': `${d.pad}px`,
    '--card-gap': `${d.gap}px`,
    '--panel-gap': `${d.panelGap}px`,
  };
}

/** 背景图案层（纯 CSS 生成，不引入外部素材） */
export function buildPatternLayer(type: PatternType, c1: string, c2: string): { image: string; size: string } {
  switch (type) {
    case 'dots':
      return { image: `radial-gradient(circle, ${c1} 1.1px, transparent 1.5px)`, size: '18px 18px' };
    case 'paper':
      return {
        image:
          `repeating-linear-gradient(0deg, ${c1} 0px, ${c1} 1px, transparent 1px, transparent 3px), ` +
          `repeating-linear-gradient(90deg, ${c1} 0px, ${c1} 1px, transparent 1px, transparent 3px)`,
        size: '4px 4px',
      };
    case 'glow':
      return {
        image:
          `radial-gradient(560px 420px at 18% 6%, ${c1} 0%, transparent 62%), ` +
          `radial-gradient(480px 380px at 84% 16%, ${c2} 0%, transparent 60%), ` +
          `radial-gradient(600px 480px at 52% 96%, ${c1} 0%, transparent 64%)`,
        size: 'auto',
      };
    case 'stripes':
      return { image: `repeating-linear-gradient(135deg, ${c1} 0px, ${c1} 1.5px, transparent 1.5px, transparent 13px)`, size: 'auto' };
    case 'grid':
      return {
        image:
          `repeating-linear-gradient(0deg, ${c1} 0px, ${c1} 1px, transparent 1px, transparent 22px), ` +
          `repeating-linear-gradient(90deg, ${c1} 0px, ${c1} 1px, transparent 1px, transparent 22px)`,
        size: '22px 22px',
      };
    case 'checker':
      return { image: `conic-gradient(${c1} 0 25%, transparent 0 50%, ${c1} 0 75%, transparent 0)`, size: '18px 18px' };
    case 'crosshatch':
      return {
        image:
          `repeating-linear-gradient(45deg, ${c1} 0px, ${c1} 1px, transparent 1px, transparent 10px), ` +
          `repeating-linear-gradient(-45deg, ${c1} 0px, ${c1} 1px, transparent 1px, transparent 10px)`,
        size: 'auto',
      };
    case 'waves':
      return {
        image:
          `radial-gradient(circle at 6px 5px, ${c1} 1.5px, transparent 2.1px), ` +
          `radial-gradient(circle at 18px 13px, ${c1} 1.5px, transparent 2.1px), ` +
          `radial-gradient(circle at 30px 5px, ${c1} 1.5px, transparent 2.1px)`,
        size: '36px 18px',
      };
    case 'rings':
      return { image: `radial-gradient(circle, transparent 3px, ${c1} 3px 4px, transparent 4px 7px)`, size: '28px 28px' };
    case 'halftone':
      return {
        image:
          `radial-gradient(circle at 5px 5px, ${c1} 1.6px, transparent 2.2px), ` +
          `radial-gradient(circle at 15px 15px, ${c1} 0.8px, transparent 1.4px)`,
        size: '20px 20px',
      };
    case 'none':
    default:
      return { image: 'none', size: 'auto' };
  }
}

/** 自定义主题 → 整套 CSS 变量（语义色板 + 主色系 + 圆角 + 密度 + 图案） */
export function buildThemeVars(config: CustomThemeConfig): Record<string, string> {
  const base = BASE_TOKENS[config.base];
  const r = RADIUS_BY_LEVEL[config.radiusLevel];
  const borderHex = config.base === 'dark' ? '#333333' : '#e3e3e0';
  const textHex = config.base === 'dark' ? '#e6e6e6' : '#37352f';
  const borderColor =
    config.borderLevel === 'none'
      ? 'transparent'
      : config.borderLevel === 'bold'
        ? mixHex(borderHex, textHex, 0.3)
        : base['--border'] ?? 'var(--border)';
  const patternOpacity = typeof config.patternOpacity === 'number' ? Math.min(100, Math.max(0, config.patternOpacity)) / 100 : 0;
  const btnOpacity = typeof config.btnOpacity === 'number' ? Math.min(100, Math.max(0, config.btnOpacity)) / 100 : 1;

  const layout = { density: config.density, borderLevel: config.borderLevel };

  const fontStack = FONT_STACKS[config.fontFamily] ?? FONT_STACKS.system;

  const vars: Record<string, string> = {
    ...base,
    ...primaryScale(config.primary, config.base),
    '--radius-card': `${r.card}px`,
    '--radius-block': `${r.block}px`,
    '--radius-drawer': `${r.drawer}px`,
    '--radius-btn': `${r.btn}px`,
    '--pattern-opacity': String(patternOpacity),
    '--btn-opacity': String(btnOpacity),
    '--glass-opacity': config.cardStyle === 'glass' ? '0.9' : '1',
    '--font-family': fontStack,
    '--font-scale': config.fontSizeLevel === 'large' ? '1.08' : '1',
    ...buildLayoutVars(layout, borderColor),
  };

  if (config.fontColor) {
    vars['--text'] = config.fontColor;
  }

  return vars;
}

/** 把图案层写入 CSS 变量（image + size） */
export function applyPatternVars(vars: Record<string, string>, pattern: PatternType, c1: string, c2: string): Record<string, string> {
  const layer = buildPatternLayer(pattern, c1, c2);
  return {
    ...vars,
    '--pattern-image': layer.image,
    '--pattern-size': layer.size,
  };
}

/** 主入口：从 CustomThemeConfig 生成完整的 CSS 变量对象 */
export function resolveThemeVars(config: CustomThemeConfig): Record<string, string> {
  const vars = buildThemeVars(config);
  // 从色板里拿 pattern 用的颜色
  const c1 = vars['--pattern-color'] ?? 'rgba(30, 111, 235, 0.04)';
  const c2 = vars['--pattern-color-2'] ?? 'rgba(46, 182, 125, 0.03)';
  const withPattern = applyPatternVars(vars, config.pattern, c1, c2);

  /* ===== 自定义背景图变量 =====
   * 这些变量由 index.css 的 html::before 独立背景层消费，
   * opacity / blur 只作用于那层伪元素，绝不作用在根容器本身。
   */
  const bgVars: Record<string, string> = {};
  if (config.bgImage) {
    bgVars['--bg-custom-image'] = `url("${config.bgImage}")`;
    bgVars['--bg-custom-opacity'] = String(Math.min(100, Math.max(0, config.bgOpacity)) / 100);
    bgVars['--bg-custom-blur'] = `${Math.min(30, Math.max(0, config.bgBlur))}px`;
    bgVars['--bg-custom-size'] = config.bgSize === 'stretch' ? '100% 100%' : config.bgSize;
    bgVars['--bg-custom-position'] = config.bgPosition;
  } else {
    // 无背景图时，把变量清掉，让伪元素渲染为透明
    bgVars['--bg-custom-image'] = 'none';
    bgVars['--bg-custom-opacity'] = '0';
    bgVars['--bg-custom-blur'] = '0px';
    bgVars['--bg-custom-size'] = 'cover';
    bgVars['--bg-custom-position'] = 'center center';
  }

  return { ...withPattern, ...bgVars };
}
