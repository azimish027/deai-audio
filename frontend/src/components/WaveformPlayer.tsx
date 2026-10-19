import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";

/** 从 :root 的 CSS 变量读取 hex 颜色字符串。WaveSurfer API 不接受 CSS 变量语法，只能传真实 hex。 */
function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** WaveSurfer 封装组件。
 * inputUrl = 原音 blob; altUrl = 处理后 blob（可选）。
 * A/B 按钮：在 inputUrl 和 altUrl 之间切换，重新 load 波形。
 */
export function WaveformPlayer({
  inputUrl,
  altUrl,
  disabled,
}: {
  inputUrl: string;
  altUrl?: string;
  disabled?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [usingAlt, setUsingAlt] = useState(false);

  // 初始化 WaveSurfer（只做一次）
  useEffect(() => {
    if (!containerRef.current) return;
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: cssVar("--ws-wave", "#d9d9d7"),
      progressColor: cssVar("--ws-progress", "#2383e2"),
      cursorColor: cssVar("--ws-cursor", "#37352f"),
      barWidth: 2,
      barGap: 1,
      height: 96,
      normalize: true,
      interact: true,
    });
    ws.on("ready", () => setReady(true));
    ws.on("play", () => setPlaying(true));
    ws.on("pause", () => setPlaying(false));
    ws.on("finish", () => setPlaying(false));
    wsRef.current = ws;
    return () => { ws.destroy(); wsRef.current = null; };
  }, []);

  // 当 inputUrl 或 usingAlt 变化时，ws.load
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    const url = (usingAlt && altUrl) ? altUrl : inputUrl;
    setReady(false);
    ws.load(url);
  }, [inputUrl, altUrl, usingAlt]);

  const toggleAlt = () => {
    if (!altUrl) return;
    setUsingAlt((v) => !v);
  };

  return (
    <div className="notion-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[12px] font-medium text-notion-muted">
          波形预览 {usingAlt && altUrl ? <span className="text-notion-accent">· 处理后</span> : ""}
        </div>
        {disabled && (
          <div className="text-[11px] text-notion-faint">
            点击"一键变可听"后查看处理结果的 A/B 对比
          </div>
        )}
      </div>

      <div ref={containerRef} className="wavesurfer-container mb-3" />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button className="notion-btn" onClick={() => wsRef.current?.skip(-5)} disabled={!ready}>
            <SkipBack className="w-3.5 h-3.5" />
          </button>
          <button
            className="notion-btn-primary h-8 w-8 px-0 justify-center"
            onClick={() => wsRef.current?.playPause()}
            disabled={!ready}
          >
            {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
          </button>
          <button className="notion-btn" onClick={() => wsRef.current?.skip(5)} disabled={!ready}>
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>

        {!disabled && altUrl && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setUsingAlt(false)}
              className={["notion-btn text-[11px]", !usingAlt && "bg-notion-accent/20 border-notion-accent text-notion-accent"].filter(Boolean).join(" ")}
            >原音</button>
            <button
              onClick={() => setUsingAlt(true)}
              className={["notion-btn text-[11px]", usingAlt && "bg-notion-accent/20 border-notion-accent text-notion-accent"].filter(Boolean).join(" ")}
            >处理后</button>
            <button onClick={toggleAlt} className="notion-btn text-[11px]">A/B ↔</button>
          </div>
        )}
      </div>
    </div>
  );
}
