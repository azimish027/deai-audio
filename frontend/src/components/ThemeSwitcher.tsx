/**
 * ThemeSwitcher —— 主题切换面板
 * TopBar 右上角齿轮 → 弹出面板：
 *   上半部分：5套预设色块选卡
 *   下半部分：8维度自定义下拉（完全开放，零限制）
 */
import { useEffect, useRef, useState } from 'react';
import { Palette, RotateCcw, Sparkles } from 'lucide-react';
import { useThemeStore, THEME_PRESETS, presetToCustomTheme } from '../theme';
import type {
  BaseMode, BorderLevel, RadiusLevel, DensityLevel, CardStyle, PatternType, CustomThemeConfig,
} from '../theme';

/** 维度下拉的选项映射 */
const DENSITY_OPTS: { value: DensityLevel; label: string; hint: string }[] = [
  { value: 'compact', label: '紧凑', hint: '信息密度高' },
  { value: 'comfort', label: '标准', hint: '默认推荐' },
  { value: 'spacious', label: '宽松', hint: '更多留白' },
];
const RADIUS_OPTS: { value: RadiusLevel; label: string }[] = [
  { value: 'compact', label: '直角' },
  { value: 'standard', label: '微圆角' },
  { value: 'rounded', label: '大圆角' },
];
const BORDER_OPTS: { value: BorderLevel; label: string }[] = [
  { value: 'none', label: '无边框' },
  { value: 'thin', label: '细边框' },
  { value: 'bold', label: '粗边框' },
];
const CARD_OPTS: { value: CardStyle; label: string }[] = [
  { value: 'solid', label: '实色' },
  { value: 'glass', label: '玻璃' },
];
const BASE_OPTS: { value: BaseMode; label: string }[] = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
];
const PATTERN_OPTS: { value: PatternType; label: string }[] = [
  { value: 'none', label: '无' },
  { value: 'dots', label: '点阵' },
  { value: 'paper', label: '纸纹' },
  { value: 'glow', label: '光晕' },
  { value: 'stripes', label: '条纹' },
  { value: 'grid', label: '网格' },
  { value: 'checker', label: '棋盘' },
  { value: 'crosshatch', label: '斜纹' },
  { value: 'waves', label: '波浪点' },
  { value: 'rings', label: '圆环' },
  { value: 'halftone', label: '网点' },
];
const FONT_OPTS = ['system', 'rounded', 'serif', 'heiti', 'kai', 'mono'] as const;

export function ThemeSwitcher() {
  const [open, setOpen] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const { config, applyPreset, setTheme, resetToDefault, updateField, uploadBgImage, clearBgImage, setBgField } = useThemeStore();
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handlePresetClick = (presetId: string) => {
    applyPreset(presetId);
  };

  const handleReset = () => {
    resetToDefault();
  };

  const handleRandom = () => {
    // 给用户一个"随机试试"按钮——随机选一个预设，鼓励探索
    const random = THEME_PRESETS[Math.floor(Math.random() * THEME_PRESETS.length)];
    setTheme(presetToCustomTheme(random));
  };

  if (!open) {
    return (
      <div className="relative">
        <button
          ref={btnRef}
          className="icon-btn"
          title="主题设置"
          onClick={() => setOpen(true)}
        >
          <Palette className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button ref={btnRef} className="icon-btn" title="主题设置" onClick={() => setOpen(false)}>
        <Palette className="w-3.5 h-3.5" />
      </button>

      {/* 弹出面板 */}
      <div
        ref={panelRef}
        className="absolute right-2 top-11 sm:top-12 z-50 w-[340px] max-h-[80vh] overflow-y-auto
                   bg-notion-bg border border-notion-border rounded-lg shadow-lg
                   animate-[fadeIn_0.12s_ease-out]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-notion-border">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-notion-accent" />
            <span className="text-[13px] font-semibold">主题</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              className="icon-btn p-1"
              title="随机试试"
              onClick={handleRandom}
            >
              <Sparkles className="w-3.5 h-3.5" />
            </button>
            <button
              className="icon-btn p-1"
              title="重置"
              onClick={handleReset}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 上半部分：5套预设 */}
        <div className="px-4 py-3 border-b border-notion-border">
          <div className="text-[11px] text-notion-faint mb-2">预设风格（一键选）</div>
          <div className="grid grid-cols-5 gap-2">
            {THEME_PRESETS.map((preset) => {
              const isActive = config.presetId === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => handlePresetClick(preset.id)}
                  className={`
                    group flex flex-col items-center gap-1 p-1.5 rounded-md
                    border transition-all text-center
                    ${isActive
                      ? 'border-notion-accent bg-notion-hover ring-1 ring-notion-accent/30'
                      : 'border-notion-border hover:border-notion-faint hover:bg-notion-hover'}
                  `}
                  title={preset.desc}
                >
                  {/* 迷你色块预览 */}
                  <div className="flex gap-0.5">
                    {preset.swatches.slice(0, 4).map((c, i) => (
                      <div
                        key={i}
                        className="w-3 h-3 rounded-[2px] border border-black/5"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] leading-tight">{preset.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 下半部分：8维度自定义 */}
        <div className="px-4 py-3 space-y-3">
          <div className="text-[11px] text-notion-faint mb-1">自定义（完全开放，想怎么调怎么调）</div>

          <SelectField
            label="主色"
            value={config.primary}
            onChange={(v) => updateField('primary', v)}
            type="color"
          />

          <SelectField
            label="底色模式"
            value={config.base}
            onChange={(v) => updateField('base', v as BaseMode)}
            options={BASE_OPTS}
          />

          <SelectField
            label="密度"
            value={config.density}
            onChange={(v) => updateField('density', v as DensityLevel)}
            options={DENSITY_OPTS}
            hint={(v) => DENSITY_OPTS.find((o) => o.value === v)?.hint}
          />

          <SelectField
            label="圆角"
            value={config.radiusLevel}
            onChange={(v) => updateField('radiusLevel', v as RadiusLevel)}
            options={RADIUS_OPTS}
          />

          <SelectField
            label="边框"
            value={config.borderLevel}
            onChange={(v) => updateField('borderLevel', v as BorderLevel)}
            options={BORDER_OPTS}
          />

          <SelectField
            label="卡片质感"
            value={config.cardStyle}
            onChange={(v) => updateField('cardStyle', v as CardStyle)}
            options={CARD_OPTS}
          />

          <SelectField
            label="背景图案"
            value={config.pattern}
            onChange={(v) => updateField('pattern', v as PatternType)}
            options={PATTERN_OPTS}
          />

          {/* Pattern 透明度（只有 pattern !== none 时显示） */}
          {config.pattern !== 'none' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] text-notion-text-2">图案透明度</span>
                <span className="text-[11px] text-notion-faint tabular-nums">{config.patternOpacity}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={config.patternOpacity}
                onChange={(e) => updateField('patternOpacity', Number(e.target.value))}
                className="w-full accent-notion-accent"
              />
            </div>
          )}

          <SelectField
            label="字体"
            value={config.fontFamily}
            onChange={(v) => updateField('fontFamily', v as CustomThemeConfig['fontFamily'])}
            options={FONT_OPTS.map((f) => ({ value: f, label: f }))}
          />

          {/* 背景图板块 —— 用户上传自定义背景 */}
          <div className="pt-3 border-t border-notion-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-medium text-notion-text">自定义背景图</span>
              {config.bgImage && (
                <button
                  className="text-[11px] text-notion-danger hover:underline"
                  onClick={clearBgImage}
                >
                  清除
                </button>
              )}
            </div>

            {/* 隐藏的 file input —— 只接受图片 MIME 白名单 */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = ''; // reset 允许重复选同一文件
                if (!file) return;
                setUploadingBg(true);
                const ok = await uploadBgImage(file);
                setUploadingBg(false);
                if (!ok) {
                  console.warn('[theme] 背景图上传失败（格式不支持或文件损坏）');
                }
              }}
            />

            {!config.bgImage ? (
              /* 空状态：上传入口 */
              <button
                disabled={uploadingBg}
                onClick={() => fileInputRef.current?.click()}
                className="w-full text-[12px] py-3 border-2 border-dashed border-notion-border rounded-md
                           hover:border-notion-accent hover:bg-notion-hover transition-colors
                           text-notion-text-2 hover:text-notion-text
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploadingBg ? '处理中…' : '📷 上传图片（JPG/PNG/WEBP/GIF，≤5MB）'}
              </button>
            ) : (
              /* 已上传：预览缩略图 + 参数调节 */
              <div className="space-y-3">
                {/* 缩略图预览 */}
                <div className="relative h-16 rounded-md overflow-hidden border border-notion-border">
                  <img
                    src={config.bgImage}
                    alt="背景预览"
                    className="w-full h-full object-cover"
                    style={{ opacity: config.bgOpacity / 100, filter: `blur(${config.bgBlur}px)` }}
                  />
                  <button
                    className="absolute inset-0 flex items-center justify-center text-[11px]
                               bg-black/50 text-white opacity-0 hover:opacity-100 transition-opacity"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    更换图片
                  </button>
                </div>

                {/* 透明度 */}
                <BgSlider
                  label="透明度"
                  suffix="%"
                  min={0} max={100}
                  value={config.bgOpacity}
                  onChange={(v) => setBgField('bgOpacity', v)}
                />

                {/* 模糊 */}
                <BgSlider
                  label="模糊"
                  suffix="px"
                  min={0} max={30}
                  value={config.bgBlur}
                  onChange={(v) => setBgField('bgBlur', v)}
                />

                {/* 显示模式 */}
                <SelectField
                  label="显示模式"
                  value={config.bgSize}
                  onChange={(v) => setBgField('bgSize', v as CustomThemeConfig['bgSize'])}
                  options={[
                    { value: 'cover', label: '覆盖 (cover)' },
                    { value: 'contain', label: '包含 (contain)' },
                    { value: 'auto', label: '原始 (auto)' },
                    { value: 'stretch', label: '拉伸 (stretch)' },
                  ]}
                />
              </div>
            )}
          </div>

          {/* 当前配置预览 */}
          <div className="pt-2 border-t border-notion-border">
            <div className="text-[11px] text-notion-faint mb-1">当前配置</div>
            <div className="text-[11px] font-mono bg-notion-hover px-2 py-1.5 rounded text-notion-text-2 break-all">
              {config.presetId ? `来自预设 · ${config.name}` : `自定义 · ${config.name}`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 通用下拉字段组件 */
interface Opt { value: string; label: string; hint?: string }

function SelectField({
  label, value, onChange, options, type, hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options?: Opt[];
  type?: 'color';
  hint?: (v: string) => string | undefined;
}) {
  if (type === 'color') {
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] text-notion-text-2">{label}</span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-7 h-7 rounded border border-notion-border cursor-pointer bg-transparent"
          />
          <span className="text-[11px] font-mono text-notion-faint">{value}</span>
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[12px] text-notion-text-2">{label}</span>
        {hint?.(value) && <span className="text-[10px] text-notion-faint">{hint(value)}</span>}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-[12px] bg-notion-bg border border-notion-border rounded px-2 py-1.5
                   hover:border-notion-faint focus:outline-none focus:ring-1 focus:ring-notion-accent
                   cursor-pointer"
      >
        {options?.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}


/** 背景图参数滑条 —— 带实时数值显示 */
function BgSlider({
  label, suffix, min, max, value, onChange,
}: {
  label: string;
  suffix: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[12px] text-notion-text-2">{label}</span>
        <span className="text-[11px] font-mono text-notion-faint tabular-nums">
          {value}{suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-notion-accent"
      />
    </div>
  );
}
