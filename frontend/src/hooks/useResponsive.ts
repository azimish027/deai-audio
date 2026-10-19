/** 响应式工具 —— 在组件里以 hook 方式用。
 *
 * 断点冻结（对齐 PRODUCT-FRAMEWORK.md §2.2 Step 4 的建议）：
 *   Mobile  < 768px   → 抽屉式侧面板 + BottomBar 变 Tab Bar
 *   Tablet  768-1023px → 左面板展开 + 右面板折叠
 *   Desktop ≥ 1024px  → 双面板展开
 *
 * 注：框架建议 Mobile<480 / Tablet 481-768 / Desktop≥769 三档更细，
 * 但本项目已有 768/1024 对齐 Tailwind md/lg 的断点实现，
 * 经评估功能等价，故沿用现有值并显式冻结。后续若要调整，
 * 必须先在 PRODUCT-PLAN-v1.md 走变更流程。
 */
import { useEffect, useState } from "react";

// ─── 断点常量（冻结，禁止无理由修改） ───────────────────────────
export const BREAKPOINT_MOBILE = 768;
export const BREAKPOINT_TABLET = 1024;

function useWidth(): number {
  const [w, setW] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1280));
  useEffect(() => {
    const onR = () => setW(window.innerWidth);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);
  return w;
}

export function useIsMobile(): boolean {
  return useWidth() < BREAKPOINT_MOBILE;
}

export function useIsTablet(): boolean {
  const w = useWidth();
  return w >= BREAKPOINT_MOBILE && w < BREAKPOINT_TABLET;
}

export function useIsDesktop(): boolean {
  return useWidth() >= BREAKPOINT_TABLET;
}

/** 返回当前断点的语义化字符串，方便条件渲染和调试 */
export function useBreakpointName(): "mobile" | "tablet" | "desktop" {
  const w = useWidth();
  if (w < BREAKPOINT_MOBILE) return "mobile";
  if (w < BREAKPOINT_TABLET) return "tablet";
  return "desktop";
}
