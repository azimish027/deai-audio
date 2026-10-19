/**
 * 主题引擎 · themeStore.ts（Zustand 单例）
 * 主题状态 + :root 挂载 + localStorage 持久化
 *
 * 为什么用 Zustand 而不是 React useState？
 *   - 组件之间需要共享同一个 config 对象（TopBar 齿轮按钮 → ThemeSwitcher 面板）
 *   - Zustand 天然支持 persist middleware，省掉手写 localStorage 逻辑
 *   - App.tsx 只需要 import 一次 store，不需要额外 hook 调用
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CustomThemeConfig, BgSizeMode } from './presets';
import { DEFAULT_CUSTOM_THEME, THEME_PRESETS, presetToCustomTheme, normalizeCustomTheme } from './presets';
import { resolveThemeVars } from './layout';

/* ===== 背景图上传安全约束 =====
 * MIME 白名单（只允许 jpeg / png / webp / gif）
 * 大小上限 5MB（localStorage 有 5MB 硬限制，dataURL 比原文件大 ~33%）
 * 超过限制时用 canvas 压缩到最长边 1920px
 */
const ALLOWED_BG_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
const MAX_BG_BYTES = 5 * 1024 * 1024;
const MAX_BG_LONG_SIDE = 1920;

interface ThemeActions {
  setTheme: (next: CustomThemeConfig) => void;
  applyPreset: (presetId: string) => void;
  updateField: <K extends keyof CustomThemeConfig>(key: K, value: CustomThemeConfig[K]) => void;
  resetToDefault: () => void;
  applyCurrentToRoot: () => void;

  /**
   * 上传背景图（异步）
   * - MIME 白名单校验
   * - 大小校验 + canvas 压缩
   * - 读成 dataURL 存进 config.bgImage
   * @returns 成功 true / 失败 false（调用方自行提示错误）
   */
  uploadBgImage: (file: File) => Promise<boolean>;

  /** 清除自定义背景图（保留其他背景参数不变） */
  clearBgImage: () => void;

  /** 单独调整背景图层参数（不影响其他 config 字段） */
  setBgField: <K extends 'bgOpacity' | 'bgBlur' | 'bgSize' | 'bgPosition'>(
    key: K, value: CustomThemeConfig[K],
  ) => void;
}

interface ThemeState extends ThemeActions {
  config: CustomThemeConfig;
}

/** 把 config 挂到 :root */
function applyToRoot(config: CustomThemeConfig) {
  const vars = resolveThemeVars(config);
  const root = document.documentElement;
  Object.entries(vars).forEach(([k, v]) => {
    root.style.setProperty(k, v);
  });
}

/**
 * 用 canvas 压缩图片到最长边 maxLongSide
 * 输出始终是 JPEG dataURL（比 PNG 小很多）
 */
function compressImage(dataUrl: string, maxLongSide: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let { width, height } = img;
      const longSide = Math.max(width, height);
      if (longSide <= maxLongSide) {
        resolve(dataUrl);
        return;
      }
      const ratio = maxLongSide / longSide;
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('canvas 2d context unavailable')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('image load failed'));
    img.src = dataUrl;
  });
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      config: DEFAULT_CUSTOM_THEME,

      setTheme: (next) => {
        set({ config: next });
        applyToRoot(next);
      },

      applyPreset: (presetId) => {
        const preset = THEME_PRESETS.find((p) => p.id === presetId);
        if (preset) {
          const cfg = presetToCustomTheme(preset);
          set({ config: cfg });
          applyToRoot(cfg);
        }
      },

      updateField: (key, value) => {
        const cur = get().config;
        const next = { ...cur, [key]: value };
        set({ config: next });
        applyToRoot(next);
      },

      resetToDefault: () => {
        set({ config: DEFAULT_CUSTOM_THEME });
        applyToRoot(DEFAULT_CUSTOM_THEME);
      },

      applyCurrentToRoot: () => {
        applyToRoot(get().config);
      },

      uploadBgImage: async (file: File) => {
        // 1. MIME 白名单校验
        if (!ALLOWED_BG_MIMES.includes(file.type as typeof ALLOWED_BG_MIMES[number])) {
          console.warn('[theme] 不支持的图片格式:', file.type);
          return false;
        }
        try {
          // 2. FileReader → dataURL
          const dataUrl: string = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          });

          // 3. canvas 压缩（如果文件太大）
          let finalDataUrl = dataUrl;
          if (file.size > MAX_BG_BYTES) {
            finalDataUrl = await compressImage(dataUrl, MAX_BG_LONG_SIDE);
          }

          // 4. 存进 config
          const cur = get().config;
          const next: CustomThemeConfig = {
            ...cur,
            bgImage: finalDataUrl,
            // 刚上传默认给 30% 透明度 + 0 模糊，让用户自己调
            bgOpacity: 30,
            bgBlur: 0,
            bgSize: 'cover',
          };
          set({ config: next });
          applyToRoot(next);
          return true;
        } catch (err) {
          console.error('[theme] 背景图上传失败:', err);
          return false;
        }
      },

      clearBgImage: () => {
        const cur = get().config;
        const next: CustomThemeConfig = {
          ...cur,
          bgImage: undefined,
          bgOpacity: 100,
          bgBlur: 0,
        };
        set({ config: next });
        applyToRoot(next);
      },

      setBgField: (key, value) => {
        const cur = get().config;
        const next: CustomThemeConfig = { ...cur, [key]: value };
        set({ config: next });
        applyToRoot(next);
      },
    }),
    {
      name: 'deai-theme-config-v1',
      partialize: (s) => ({ config: s.config }),
      merge: (persisted, initial) => {
        const raw = (persisted as { config?: unknown })?.config;
        if (!raw) return initial;
        const normalized = normalizeCustomTheme(raw, 'default', 'Default');
        return { ...initial, config: normalized };
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          // hydration 完成后立即应用到 :root
          applyToRoot(state.config);
        }
      },
    },
  ),
);

/** 让调用方（App.tsx）在组件里调一次即可触发挂载 + hydration */
export function useTheme() {
  return useThemeStore();
}
