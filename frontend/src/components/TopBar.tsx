import { AudioLines, CheckCircle2, AlertCircle } from "lucide-react";

export function TopBar({ backendOk }: { backendOk: boolean }) {
  return (
    <header className="h-12 border-b border-notion-border flex items-center px-6 justify-between bg-notion-bg shrink-0">
      <div className="flex items-center gap-2.5">
        <AudioLines className="w-4 h-4 text-notion-accent" />
        <span className="text-[14px] font-semibold tracking-tight whitespace-pre" style={{ letterSpacing: "0.15em" }}>留白</span>
        <span className="text-[12px] text-notion-faint">去 AI 化 · 一键变可听</span>
      </div>
      <div className="flex items-center gap-2 text-[12px]">
        {backendOk ? (
          <>
            <CheckCircle2 className="w-3.5 h-3.5 text-notion-success" />
            <span className="text-notion-muted">后端就绪</span>
          </>
        ) : (
          <>
            <AlertCircle className="w-3.5 h-3.5 text-notion-danger" />
            <span className="text-notion-muted">后端未连接（UI 可预览）</span>
          </>
        )}
      </div>
    </header>
  );
}
