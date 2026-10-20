/**
 * SplashScreen —— 进入"留白"前的品牌 splash 页。
 *
 * 打字机打出"留白"（2 字）+ 渐闪 slogan + 淡出 → 主界面。
 * 节奏：
 *   0 ~ 440ms  打字机逐字出"留白"（每字 220ms）
 *   440 ~ 1040ms  打字机光标收 · slogan 淡入
 *   1040 ~ 1440ms  淡出
 *   1440ms  卸载
 *
 * 不依赖第三方动画库。
 */
import { useEffect, useState } from "react";

const BRAND = "留白";
const SLOGAN = "修音修到 100% 准，人味就死了";

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [typedLen, setTypedLen] = useState(0);    // 已打出的字数
  const [phase, setPhase] = useState<"typing" | "hold" | "fade" | "gone">("typing");

  // 打字机：每 220ms 加一个字
  useEffect(() => {
    if (phase !== "typing") return;
    if (typedLen >= BRAND.length) {
      setPhase("hold");
      return;
    }
    const t = setTimeout(() => setTypedLen((n) => n + 1), 220);
    return () => clearTimeout(t);
  }, [phase, typedLen]);

  // hold 0.6s → fade 0.4s → gone
  useEffect(() => {
    if (phase === "hold") {
      const t = setTimeout(() => setPhase("fade"), 600);
      return () => clearTimeout(t);
    }
    if (phase === "fade") {
      const t = setTimeout(() => {
        setPhase("gone");
        onDone();
      }, 420);
      return () => clearTimeout(t);
    }
  }, [phase, onDone]);

  if (phase === "gone") return null;

  const fadeClass = phase === "fade" ? "opacity-0 transition-opacity duration-400" : "opacity-100";

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-notion-bg ${fadeClass}`}
    >
      {/* 品牌字：打字机 */}
      <div className="relative select-none">
        <span
          className="text-[64px] sm:text-[88px] font-semibold tracking-[0.4em] text-notion-text leading-none"
          style={{ fontFamily: "serif" }}
        >
          {BRAND.slice(0, typedLen)}
        </span>
        {/* 闪烁光标 */}
        <span
          className="absolute -right-1 top-0 bottom-0 w-[2px] bg-notion-accent"
          style={{
            animation: typedLen < BRAND.length ? "splash-blink 0.8s step-end infinite" : "none",
            height: "100%",
          }}
        />
      </div>

      {/* Slogan：打完后渐显 */}
      <div
        className="mt-6 text-[13px] sm:text-[15px] text-notion-muted tracking-wider transition-opacity duration-500"
        style={{ opacity: phase === "typing" ? 0 : 1 }}
      >
        {SLOGAN}
      </div>
    </div>
  );
}

// 注入一次闪烁 cursor keyframe（全局安全）
if (typeof document !== "undefined" && !document.getElementById("splash-keyframes")) {
  const style = document.createElement("style");
  style.id = "splash-keyframes";
  style.textContent = `@keyframes splash-blink { 0%, 100% { opacity: 1 } 50% { opacity: 0 } }`;
  document.head.appendChild(style);
}
