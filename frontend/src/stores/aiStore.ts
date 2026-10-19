/**
 * aiStore — 用户 AI 模型配置（本地存储，不上送任何服务器）
 *
 * 设计说明：
 *   - 这是本地小工具，API Key 存在 localStorage 是合理的安全模型：
 *     密钥只留在用户自己的浏览器 / Electron 存储里，源码里没有任何硬编码 key
 *   - 预设 provider 只填默认 baseURL，用户可以自己填"其他"改成任意 OpenAI 兼容端点
 *   - 前端直接 fetch AI API（OpenAI Chat Completions 格式），不走任何后端代理
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** 预设 provider —— 只给 baseURL 做合理默认，model 让用户选 */
export interface ProviderPreset {
  id: string;
  name: string;
  baseURL: string;
  /** 常见模型列表，方便下拉（可跳过，用户可以自己填 model） */
  suggestions?: string[];
}

export const AI_PROVIDERS: ProviderPreset[] = [
  { id: 'openai',       name: 'OpenAI',        baseURL: 'https://api.openai.com/v1',        suggestions: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1'] },
  { id: 'deepseek',     name: 'DeepSeek',      baseURL: 'https://api.deepseek.com/v1',      suggestions: ['deepseek-chat', 'deepseek-reasoner'] },
  { id: 'volcengine',   name: '豆包(火山方舟)', baseURL: 'https://ark.cn-beijing.volces.com/api/v3', suggestions: ['doubao-pro-32k', 'doubao-1.5-pro'] },
  { id: 'qwen',         name: '通义千问',       baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', suggestions: ['qwen-plus', 'qwen-turbo', 'qwen-max'] },
  { id: 'glm',          name: '智谱 GLM',       baseURL: 'https://open.bigmodel.cn/api/paas/v4', suggestions: ['glm-4', 'glm-4-flash'] },
  { id: 'moonshot',     name: '月之暗面',       baseURL: 'https://api.moonshot.cn/v1',       suggestions: ['moonshot-v1-8k', 'moonshot-v1-32k'] },
  { id: 'custom',       name: '其他(自定义)',   baseURL: '',                                 suggestions: [] },
];

export interface AiConfig {
  providerId: string;              // 对应 AI_PROVIDERS[].id
  apiKey: string;                  // 只存在本地 localStorage，不编译进代码
  baseURL: string;                 // provider 预设会填默认，用户可以改
  model: string;                   // 用户选择 / 自由输入
}

interface AiActions {
  setConfig: (cfg: Partial<AiConfig>) => void;
  selectProvider: (providerId: string) => void;   // 切 provider 时自动填默认 baseURL
  clearAll: () => void;
  /** 校验当前配置是否足够发起一次 Chat Completions 请求 */
  isReady: () => boolean;
}

const DEFAULT_AI_CONFIG: AiConfig = {
  providerId: 'custom',
  apiKey: '',
  baseURL: '',
  model: '',
};

export const useAiStore = create<AiConfig & AiActions>()(
  persist(
    (set, get) => ({
      ...DEFAULT_AI_CONFIG,

      setConfig: (partial) => set({ ...partial }),

      selectProvider: (providerId) => {
        const preset = AI_PROVIDERS.find((p) => p.id === providerId);
        if (!preset) return;
        set({
          providerId,
          baseURL: preset.baseURL,
          // 如果之前没填 model 且 preset 有建议，自动填第一个
          model: get().model || (preset.suggestions?.[0] ?? ''),
        });
      },

      clearAll: () => set({ ...DEFAULT_AI_CONFIG }),

      isReady: () => {
        const { apiKey, baseURL, model } = get();
        return Boolean(apiKey && baseURL && model);
      },
    }),
    {
      name: 'deai-ai-config-v1',
      version: 1,
      // 只持久化这四个字段，不存中间状态
      partialize: (s) => ({
        providerId: s.providerId,
        apiKey: s.apiKey,
        baseURL: s.baseURL,
        model: s.model,
      }),
    },
  ),
);

/**
 * 发起一次 OpenAI Chat Completions 请求（工具函数，方便组件直接调用）
 * 自动从 useAiStore 读配置，返回 parsed JSON 或原始文本
 *
 * @param messages [{role, content}] 数组
 * @param opts.temperature 可选 0-2
 * @returns { ok: true, data: parsed JSON } | { ok: false, error: string }
 */
export async function callAiChat(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  opts?: { temperature?: number },
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  const { apiKey, baseURL, model, isReady } = useAiStore.getState();
  if (!isReady()) {
    return { ok: false, error: 'AI 配置不完整，请先在设置里填写 API Key / BaseURL / Model' };
  }
  try {
    const url = `${baseURL.replace(/\/$/, '')}/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts?.temperature ?? 0.7,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 300)}` };
    }
    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
