/**
 * OfflineIndicator —— 离线状态提示条。
 *
 * 依据 PRODUCT-FRAMEWORK.md §3.2 Step 3「层级3：页面级兜底」：
 *   "网络断开检测 + 离线提示"
 *
 * - 监听 navigator.onLine 的 online/offline 事件
 * - 断网时在顶部显示非阻塞提示条
 * - 不阻止用户操作（本地数据仍可查看）
 */
import { useEffect, useState } from "react";

export function OfflineIndicator() {
  const [online, setOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[55] bg-[var(--color-danger)] text-white text-[12px] py-1.5 px-4 flex items-center justify-center gap-2 shadow-md animate-pulse">
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
      </svg>
      <span>网络断开 · 本地数据仍可查看 · 重新连接后自动恢复</span>
    </div>
  );
}
