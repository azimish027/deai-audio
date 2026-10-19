/**
 * AISettings —— AI 模型配置 + 用户数据导入/导出
 * TopBar 右侧 🤖 图标 → 弹出面板：
 *   上半部分：provider / apiKey / baseURL / model 四字段
 *   下半部分：导入 / 导出用户数据（只导 store 快照，不导源码）
 */
import { useEffect, useRef, useState } from 'react';
import { Bot, Download, Upload, CheckCircle, XCircle, KeyRound } from 'lucide-react';
import { useAiStore, AI_PROVIDERS, callAiChat } from '../stores/aiStore';
import { downloadBackupJson, importBackupFromFile } from '../stores/backupStore';
import type { ImportResult } from '../stores/backupStore';

export function AISettings() {
  const [open, setOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const { providerId, apiKey, baseURL, model, selectProvider, setConfig, isReady } = useAiStore();

  /* ===== 点击外部关闭 ===== */
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!panelRef.current) return;
      if (panelRef.current.contains(e.target as Node)) return;
      setOpen(false);
    };
    // 延后一帧再绑，避免打开时立即被自己 click 触发
    const id = requestAnimationFrame(() => document.addEventListener('click', onDocClick));
    return () => { cancelAnimationFrame(id); document.removeEventListener('click', onDocClick); };
  }, [open]);

  const ready = isReady();

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const r = await callAiChat([
      { role: 'user', content: 'ping' },
    ], { temperature: 0 });
    setTesting(false);
    if (r.ok) {
      // OpenAI 返回格式里 choices[0].message.content 是关键
      const c = (r.data as any)?.choices?.[0]?.message?.content;
      setTestResult({ ok: true, msg: c ? `OK · ${model} 已响应` : `OK · HTTP 200` });
    } else {
      setTestResult({ ok: false, msg: r.error });
    }
  };

  const handleImport = async (file: File) => {
    setImportResult(null);
    const r = await importBackupFromFile(file);
    setImportResult(r);
    if (r.ok) {
      // 3秒后自动关闭面板
      setTimeout(() => setOpen(false), 1800);
    }
  };

  return (
    <>
      {/* TopBar 图标按钮 */}
      <button
        className={`icon-btn relative ${open ? 'bg-notion-hover' : ''} ${ready ? '' : 'opacity-60'}`}
        onClick={() => setOpen((o) => !o)}
        title={ready ? `AI 就绪 · ${model}` : 'AI 未配置'}
      >
        <Bot className="w-3.5 h-3.5" />
        {/* 就绪指示器 */}
        {ready && (
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-notion-success" />
        )}
      </button>

      {/* 弹出面板 */}
      {open && (
        <div
          ref={panelRef}
          className="absolute right-3 top-11 sm:top-12 z-50 w-[320px] max-h-[80vh] overflow-y-auto
                     bg-notion-bg border border-notion-border rounded-lg shadow-lg p-3 space-y-3"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-notion-border">
            <div className="flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-notion-muted" />
              <span className="text-[12px] font-semibold text-notion-text">AI 模型配置</span>
            </div>
            {ready && (
              <span className="text-[10px] text-notion-success font-medium px-1.5 py-0.5 bg-green-50 rounded">就绪</span>
            )}
          </div>

          {/* Provider */}
          <Field label="供应商">
            <select
              value={providerId}
              onChange={(e) => selectProvider(e.target.value)}
              className="w-full text-[12px] bg-notion-bg border border-notion-border rounded px-2 py-1.5
                         hover:border-notion-faint focus:outline-none focus:ring-1 focus:ring-notion-accent"
            >
              {AI_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>

          {/* API Key */}
          <Field label="API Key" hint={apiKey ? '已填写' : '必填'}>
            <input
              type="password"
              value={apiKey}
              placeholder="sk-..."
              autoComplete="off"
              onChange={(e) => setConfig({ apiKey: e.target.value })}
              className="w-full text-[12px] font-mono bg-notion-bg border border-notion-border rounded px-2 py-1.5
                         hover:border-notion-faint focus:outline-none focus:ring-1 focus:ring-notion-accent"
            />
          </Field>

          {/* Base URL */}
          <Field label="API 地址 (Base URL)" hint={!baseURL ? '必填' : undefined}>
            <input
              type="text"
              value={baseURL}
              placeholder="https://api.deepseek.com/v1"
              onChange={(e) => setConfig({ baseURL: e.target.value })}
              className="w-full text-[12px] font-mono bg-notion-bg border border-notion-border rounded px-2 py-1.5
                         hover:border-notion-faint focus:outline-none focus:ring-1 focus:ring-notion-accent"
            />
          </Field>

          {/* Model */}
          <Field label="模型名" hint={!model ? '必填' : undefined}>
            <input
              type="text"
              value={model}
              list="ai-model-suggestions"
              placeholder="deepseek-chat / gpt-4o-mini / 自由输入"
              onChange={(e) => setConfig({ model: e.target.value })}
              className="w-full text-[12px] font-mono bg-notion-bg border border-notion-border rounded px-2 py-1.5
                         hover:border-notion-faint focus:outline-none focus:ring-1 focus:ring-notion-accent"
            />
            {/* datalist 给 provider 的建议模型 */}
            <datalist id="ai-model-suggestions">
              {AI_PROVIDERS.find((p) => p.id === providerId)?.suggestions?.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Field>

          {/* 测试连接 */}
          <button
            disabled={!ready || testing}
            onClick={handleTest}
            className="w-full text-[12px] py-1.5 rounded border border-notion-border
                       hover:border-notion-accent hover:bg-notion-hover transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testing ? '测试中…' : '测试连接'}
          </button>

          {testResult && (
            <div className={`text-[11px] px-2 py-1.5 rounded flex items-start gap-1.5
                             ${testResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {testResult.ok
                ? <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                : <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
              <span className="break-all">{testResult.msg}</span>
            </div>
          )}

          {/* ── 导入 / 导出 ── */}
          <div className="pt-2 border-t border-notion-border space-y-2">
            <div className="text-[11px] text-notion-faint">用户数据（主题/对话/项目/知识库/AI配置）</div>

            <div className="flex gap-2">
              <button
                onClick={downloadBackupJson}
                className="flex-1 text-[12px] py-1.5 rounded border border-notion-border
                           hover:border-notion-accent hover:bg-notion-hover transition-colors
                           flex items-center justify-center gap-1"
              >
                <Download className="w-3 h-3" />
                导出
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 text-[12px] py-1.5 rounded border border-notion-border
                           hover:border-notion-accent hover:bg-notion-hover transition-colors
                           flex items-center justify-center gap-1"
              >
                <Upload className="w-3 h-3" />
                导入
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) handleImport(file);
              }}
            />

            {importResult && (
              <div className={`text-[11px] px-2 py-1.5 rounded flex items-start gap-1.5
                               ${importResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {importResult.ok
                  ? <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  : <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                <span className="break-all">{importResult.message}</span>
              </div>
            )}

            <div className="text-[10px] text-notion-faint leading-relaxed">
              💡 导入/导出只保存你在本地产生的配置数据，不包含源码、组件、构建产物。
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-notion-text-2">{label}</span>
        {hint && <span className="text-[10px] text-notion-faint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
