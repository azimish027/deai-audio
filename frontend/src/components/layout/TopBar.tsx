import {
  AudioLines, CheckCircle2, AlertCircle, Play, Pause, SkipBack, SkipForward,
  Volume2, Undo2, Redo2, PanelLeft, PanelRight,
} from "lucide-react";
import { useEngineStore } from "../../stores/engineStore";
import { useTransportStore } from "../../stores/transportStore";
import { useProjectStore } from "../../stores/projectStore";
import { useUIStore } from "../../stores/uiStore";
import { useIsMobile, useIsTablet } from "../../hooks/useResponsive";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { ThemeSwitcher } from "../ThemeSwitcher";

export function TopBar() {
  const backendOk = useEngineStore((s) => s.backend_ok);
  const { playing, toggle } = useTransportStore();
  const projectName = useProjectStore((s) => s.name);
  const setProjectName = useProjectStore((s) => s.setProjectName);
  const togglePanel = useUIStore((s) => s.togglePanel);
  const panels = useUIStore((s) => s.panels);

  const mobile = useIsMobile();
  const tablet = useIsTablet();

  const statusColor =
    backendOk === null ? "text-notion-faint" :
    backendOk ? "text-notion-success" : "text-notion-danger";

  return (
    <header className="h-11 sm:h-12 border-b border-notion-border flex items-center px-2 sm:px-3 gap-2 sm:gap-3 bg-notion-bg shrink-0 z-20">
      {/* ===== 左：折叠按钮（移动端才有，方便打开抽屉）+ 品牌 ===== */}
      {mobile && (
        <div className="flex items-center gap-1">
          <button className="icon-btn" onClick={() => togglePanel("left")} title="左面板">
            <PanelLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
        <AudioLines className="w-4 h-4 text-notion-accent shrink-0" />
        <span className="text-[13px] sm:text-[14px] font-semibold tracking-tight shrink-0 hidden sm:inline">DeAI</span>
        <span className="text-[11px] sm:text-[12px] text-notion-faint shrink-0 hidden md:inline">去AI化</span>
        {!mobile && <span className="w-px h-4 bg-notion-border mx-1" />}
        {!mobile && (
          <input
            className="text-[12px] sm:text-[13px] font-medium bg-transparent hover:bg-notion-hover rounded px-1.5 py-0.5 min-w-[80px] sm:min-w-[120px] outline-none focus:ring-1 focus:ring-notion-accent"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="未命名项目"
          />
        )}
      </div>

      {/* ===== 中间：5 个工作区 Tab（桌面 + 平板） / 移动端隐藏（走 BottomBar Tab Bar） ===== */}
      {!mobile && <WorkspaceSwitcher />}

      {/* ===== 右组：Transport ===== */}
      <div className="flex-1" />

      {/* Transport（紧凑） */}
      <div className="flex items-center gap-1 shrink-0">
        {!mobile && (
          <button className="icon-btn" onClick={() => useTransportStore.getState().seekTo(0)} title="回到开头">
            <SkipBack className="w-3.5 h-3.5" />
          </button>
        )}
        <button className="notion-btn-primary h-7 w-7 p-0 justify-center" onClick={toggle} title={playing ? "暂停" : "播放"}>
          {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
        </button>
        {!mobile && (
          <button className="icon-btn" title="前进 1 拍">
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        )}
        {!mobile && <Volume2 className="w-3.5 h-3.5 text-notion-muted ml-1" />}
      </div>

      {/* 右组 2：Undo/Redo —— 仅桌面 */}
      {!tablet && (
        <div className="flex items-center gap-0.5 shrink-0">
          <button className="icon-btn opacity-60" title="撤销"><Undo2 className="w-3.5 h-3.5" /></button>
          <button className="icon-btn opacity-60" title="重做"><Redo2 className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* 右组 3：后端状态 + 移动端右面板按钮 */}
      <div className="flex items-center gap-1.5 shrink-0">
        {!mobile && (
          <div className="flex items-center gap-1 text-[11px]">
            {backendOk === null ? (
              <span className="text-notion-faint">连接中…</span>
            ) : backendOk ? (
              <>
                <CheckCircle2 className={`w-3 h-3 ${statusColor}`} />
                <span className={statusColor}>后端就绪</span>
              </>
            ) : (
              <>
                <AlertCircle className={`w-3 h-3 ${statusColor}`} />
                <span className={statusColor}>后端离线</span>
              </>
            )}
          </div>
        )}
        {mobile && backendOk && <CheckCircle2 className="w-3 h-3 text-notion-success" />}
        {mobile && !backendOk && backendOk !== null && <AlertCircle className="w-3 h-3 text-notion-danger" />}
        {mobile && (
          <button className="icon-btn" onClick={() => togglePanel("right")} title="右面板">
            <PanelRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 右组 4：主题切换器 */}
      <ThemeSwitcher />
    </header>
  );
}
