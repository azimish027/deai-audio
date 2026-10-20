/**
 * App.tsx —— 带响应式的 Layout 骨架。
 * - 桌面 (≥1024px)：TopBar + LeftPanel + CenterCanvas + RightPanel + BottomBar
 * - 平板 (768~1023px)：默认折叠 RightPanel；LeftPanel 220px
 * - 移动端 (<768px)：TopBar 瘦身 + LeftPanel/RightPanel 默认抽屉式隐藏 + BottomBar 变 Tab Bar
 */
import { useEffect, useState } from "react";
import { TopBar } from "./components/layout/TopBar";
import { LeftPanel } from "./components/layout/LeftPanel";
import { RightPanel } from "./components/layout/RightPanel";
import { BottomBar } from "./components/layout/BottomBar";
import { CenterCanvas } from "./components/layout/CenterCanvas";
import { WelcomeModal } from "./components/workspaces/_shared/WelcomeModal";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { SplashScreen } from "./components/SplashScreen";
import { useEngineStore } from "./stores/engineStore";
import { useUIStore } from "./stores/uiStore";
import { useIsMobile, useIsTablet } from "./hooks/useResponsive";
import { healthCheck } from "./api/backend";
import { useThemeStore } from "./theme";

export default function App() {
  const setBackendOk = useEngineStore((s) => s.setBackendOk);
  const mobile = useIsMobile();
  const tablet = useIsTablet();
  const setPanel = useUIStore((s) => s.setPanel);
  const [splashDone, setSplashDone] = useState(false);

  // 主题引擎：触发 Zustand persist middleware 初始化 + :root 挂载
  useThemeStore();

  // 挂载时按设备设置默认可见性
  useEffect(() => {
    if (mobile) {
      setPanel("left", false);
      setPanel("right", false);
    } else if (tablet) {
      setPanel("left", true);
      setPanel("right", false);
    } else {
      setPanel("left", true);
      setPanel("right", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobile, tablet]);

  // 后端健康检查
  useEffect(() => {
    let alive = true;
    (async () => {
      try { const ok = await healthCheck(); if (alive) setBackendOk(ok); }
      catch { if (alive) setBackendOk(false); }
    })();
    return () => { alive = false; };
  }, [setBackendOk]);

  return (
    <div className="h-full flex flex-col bg-notion-bg text-notion-text overflow-hidden">
      {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
      <OfflineIndicator />
      <TopBar />

      {/* 主区域：左 / 中 / 右 */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        <LeftPanel />
        <CenterCanvas />
        <RightPanel />
      </div>

      {/* BottomBar 桌面显示；移动端 BottomBar 会自动变成 Tab Bar（组件内判断） */}
      <BottomBar />

      {/* 首次进入引导 */}
      <WelcomeModal />
    </div>
  );
}
