# DeAI Audio — 需求 & 实现总结

> 本文件用于新账号接手项目时快速对齐上下文。纯文本总结，直接全选复制到新对话开头即可。

---

## 一、项目是什么

**本地 AI 音频增强工作台**，React + Vite 前端，Python FastAPI 后端音频引擎。

**风格**：Notion 简约风（纯白底、细边框、6px 微圆角、低饱和度），拒绝廉价紧凑感、玻璃态、渐变商务质感。

---

## 二、技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + TypeScript + Vite 6 + Tailwind CSS + Zustand（immer + persist 中间件）+ lucide-react 图标 |
| 后端 | Python FastAPI（`backend/engine/` 下 denoise / diagnosis / dsp / loudness / reference / segmentation / separation / io / session / orchestration） |
| 桌面壳 | Electron（package.json 有 electron / dev:electron 脚本） |

**仓库**：`https://github.com/azimish027/deai-audio`（已 force push 清理溯源文档）

---

## 三、已实现功能清单

### 1. 主题引擎（核心，复用了一个"精细时间块管理"设计包的架构）

- **5 套预设**：Default 白+蓝 / Mint 白+薄荷绿 / Paper 米纸微肌理 / Focus 深对比专注 / Cream 暖米白
- **13 维度全开放自定义**（零限制，用户想怎么调怎么调）：主色 / 底色模式 / 密度 / 圆角 / 边框粗细 / 卡片质感(solid|glass) / 背景图案(11种) / 图案透明度 / 字体 / 字号 / 按钮透明度 / 自定义文字色 / 排列方式
- **自定义背景图**：用户可上传本地图片 → 透明度滑条(0-100%) + 模糊滑条(0-30px) + 显示模式(cover/contain/auto/stretch)。**关键实现**：用 `html::before` 独立伪元素层，opacity 只作用于那层伪元素，绝不作用于根容器（踩过坑）
- **持久化**：Zustand persist → localStorage

**文件位置**：
- `src/theme/tokens.ts` — 纯颜色工具函数（hexToRgb / mixHex / rgba / luminance / primaryScale）
- `src/theme/presets.ts` — CustomThemeConfig 类型 + 校验 + 默认值 + presetToCustomTheme 归一化
- `src/theme/layout.ts` — 从 config 生成 `--bg-custom-image/opacity/blur/size/position` 等 CSS 变量
- `src/theme/themeStore.ts` — Zustand persist，动态覆盖 `:root` CSS 变量实现换肤
- `src/theme/index.ts` — 统一导出
- `src/components/ThemeSwitcher.tsx` — TopBar 🎨 图标入口，弹出面板（上半预设卡、下半 13 维度自定义、底部背景图上传/滑条）

### 2. AI 模型配置

- **7 个预设 provider**：OpenAI / DeepSeek / 豆包火山方舟 / 通义千问 / 智谱 GLM / 月之暗面 / 其他自定义。切 provider 自动填默认 baseURL + 建议模型名 datalist
- **API Key / BaseURL / Model** 本地 localStorage 存（`deai-ai-config-v1`），**不编译进源码**，**前端直连 AI 端点**（OpenAI Chat Completions 格式），不走后端代理
- **`callAiChat()` 工具函数**：组件直接调，自动从 store 读配置
- **测试连接按钮**：发一次 ping 验证 HTTP 状态 + 首条响应

**文件位置**：
- `src/stores/aiStore.ts` — Zustand persist，export 有 `AI_PROVIDERS` 常量 + `callAiChat()`
- `src/components/AISettings.tsx` — TopBar 🤖 图标入口，弹出面板

### 3. 用户数据导入 / 导出

- **导出**：7 个 store 的用户数据快照 JSON（`schemaVersion: 1` + ISO timestamp），剔除运行时状态（BlobURL / toast / playhead / 流式片段）
- **导入**：schemaVersion 兼容校验 + 逐 store 恢复 + 错误提示（版本不兼容拒绝恢复）
- **关键边界**：导出只保存用户本地产生的数据，**绝对不包含源码 / 组件实现 / 构建产物 / node_modules**

**导出的 7 个字段**：`theme / ai / chat / knowledge / projects / sessions / engine`

**文件位置**：
- `src/stores/backupStore.ts` — `exportUserData()` / `downloadBackupJson()` / `importUserData()` / `importBackupFromFile()`
- UI 挂在 `AISettings.tsx` 面板下半部分

### 4. 5 个工作区

- Repair 修复台
- Reference 诊断报告
- Learn 学习卡
- Compose 编曲台
- Lyric 歌词编辑器

**文件位置**：`src/components/workspaces/*`

---

## 四、重要设计决策（新账号不要乱改）

| # | 决策 | 为什么 |
|---|---|---|
| 1 | 背景图 opacity 只作用 `html::before` 伪元素，绝不作用 `#root` | 踩过坑：之前在根容器上设 opacity 把所有子元素（按钮/文字）一起变淡了 |
| 2 | Tailwind + CSS 变量双轨 | Tailwind 用 `bg-notion-bg` 这类语义类，颜色值由 `index.css :root {}` 的 CSS 变量驱动，主题引擎动态覆盖 :root 变量实现换肤 |
| 3 | 主题引擎架构：tokens → presets → layout → themeStore | tokens 纯工具函数，presets 类型+校验，layout 生成 CSS 变量，themeStore 挂到 :root。分层清晰，换任何一层不影响其他层 |
| 4 | 前端直连 AI，后端只做音频处理 | `callAiChat()` 直接 `fetch(baseURL + /chat/completions)`，不走后端代理。这样后端挂了 AI 功能也能用 |
| 5 | vite.config.ts 用 `base: './'` 相对路径 | 兼容 Electron file:// 协议 + Vercel 静态托管 |
| 6 | ThemeSwitcher 里的 13 维度下拉**不要锁死选项** | 用户明确说"预设体现审美，但不要限制用户，想怎么调怎么调" |

---

## 五、安全 / 溯源清理（已做，不要再加回来）

`.gitignore` 已排除：
```
.uploads/
_inspect_reuse/
theme_ref/
test_input.wav
*.wav
*.mp3
*.zip
PRODUCT-PLAN-v1.md
```

已 force push 清理 GitHub 仓库历史（删掉了 PRODUCT-PLAN-v1.md 等溯源文档）。

**⚠️ 两个 token 已暴露**，需要去 GitHub / Vercel 后台 Delete 再换：
- GitHub PAT：`ghp_****[已暴露需revoke]`
- Vercel Token：`vck_****[已暴露需revoke]`

---

## 六、Vercel 部署配置（已加，但注意限制）

根目录 `vercel.json` 已写好：
```json
{
  "framework": "vite",
  "buildCommand": "npm --prefix frontend run build",
  "outputDirectory": "frontend/dist",
  "installCommand": "npm --prefix frontend install",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

**重要限制**：Vercel 只能 serve 静态前端，**跑不了 Python FastAPI 后端**。音频处理功能（降噪 / 响度分析 / 音调修正等）在 Vercel 上会 404。后端需要单独部署到能跑 Python 的平台（Railway / Render / HuggingFace Spaces 等），然后 Vercel Dashboard → Project Settings → Environment Variables 加：
```
VITE_API_TARGET=https://你的后端服务地址
```

**当前状态**：用户决定留作本地小工具，放弃 Vercel 部署。

---

## 七、还有什么要做的 / 可以改进的

| 项目 | 说明 |
|---|---|
| chatStore 真接 callAiChat | `callAiChat()` 工具函数已就绪，但 chatStore 里目前 `current_stream / sending` 只是 UI 状态，还没串真正的 AI 流式调用 |
| 音频处理链路 | engineStore 里 `repair_sessions` 有 UI 但后端处理完没完整串起来（上传 → 后端处理 → 结果回来 → 前端展示） |
| 工作区空状态 | Learn / Lyric / Compose 空状态可以更丰富 |
| 真实音频文件生成 | 后端 pipeline 有 io/export.py，前端还没有完整的"处理完下载"按钮链路 |

---

## 八、本地启动

```bash
# 前端
cd frontend && npm run dev      # http://localhost:5173

# 后端（可选，音频功能依赖）
cd backend && python -m uvicorn engine.api.server:app --host 127.0.0.1 --port 8765

# Electron 桌面
cd frontend && npm run dev:electron
```

---

## 九、踩过的坑（新账号避坑）

| # | 坑 | 后果 | 正确做法 |
|---|---|---|---|
| 1 | 复用的参考包里 `LIGHT_TOKENS / DARK_TOKENS` 是土色板 | 用户评价"土"，全部换掉 | 改成 Notion 纯白底，只保留 tokens.ts 里的颜色工具函数 |
| 2 | PatternOpacity / btnOpacity / bgOpacity / bgBlur 在 normalize 里 clamp 了范围 | 用户要零限制，不 clamp | preset 可以给合理默认值，但 normalize 不要 clamp |
| 3 | 在对话里贴 API token | 两次暴露，都要事后 revoke | 不要再贴，或用脱敏形式 |
| 4 | Vite proxy 在 dev 环境好使，但生产部署（Vercel）没有 proxy | 误以为部署后 API 还能通 | 后端单独部署，前端用 `VITE_API_TARGET` 环境变量 |
| 5 | 想通过 Vercel REST API 自动部署，但 token 是 read-only | 403 forbidden | 让用户去 Dashboard 手动 Import 或生成带 write 权限的 token |
| 6 | opacity 加在根容器上 | 所有子元素（按钮 / 文字）一起变淡 | 用独立伪元素层 `html::before`，opacity 只作用于伪元素 |

---

## 十、Store 清单

| Store | 文件 | 用途 |
|---|---|---|
| useThemeStore | `src/theme/themeStore.ts` | 主题配置（persist） |
| useAiStore | `src/stores/aiStore.ts` | AI 模型配置（persist） |
| useChatStore | `src/stores/chatStore.ts` | AI 对话历史 + 流式片段 |
| useEngineStore | `src/stores/engineStore.ts` | 修复台会话 + 分析状态 |
| useKnowledgeStore | `src/stores/knowledgeStore.ts` | 音乐知识学习状态 |
| useProjectStore | `src/stores/projectStore.ts` | Compose 工作台项目（persist） |
| useSelectionStore | `src/stores/selectionStore.ts` | 画布选区状态 |
| useSessionStore | `src/stores/sessionStore.ts` | 诊断报告会话（persist） |
| useTransportStore | `src/stores/transportStore.ts` | 播放 / 循环 / 节拍器 |
| useUIStore | `src/stores/uiStore.ts` | 当前工作区 / 面板显隐 / toast |

---

## 十一、编译指标（最近一次）

| 指标 | 值 |
|---|---|
| tsc --noEmit | ✅ 零错误 |
| vite build | ✅ 426.85 kB / gzip 128.97 kB |
| Vite 版本 | 6.4.4 |
| React 版本 | 19 |
