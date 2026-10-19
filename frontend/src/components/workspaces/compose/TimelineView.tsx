import { useCallback, useEffect, useRef } from "react";
import { Play, Square, SkipForward } from "lucide-react";
import { useProjectStore } from "../../../stores/projectStore";
import { useTransportStore } from "../../../stores/transportStore";
import { rootToName, qualityLabel } from "../../../utils/music";

/** 编曲台 Center —— TimelineView。
 *
 * 每轨一行：背景画小节网格，上面渲染色块 clips。
 * 顶部是标尺（beat 号 + 小节线）。
 * Transport 播放头：启动后用 RAF 更新 playhead_beat，画一条红色竖线。
 * 点击空网格 → 创建 chord clip（mock MIDI）。
 * 点击 clip → 选中（selection store）。
 */
const BEAT_W = 28;        // 每 beat 像素
const ROW_H = 52;         // 每轨高度
const BEATS_PER_BAR = 4;

export function TimelineView() {
  const tracks = useProjectStore((s) => s.tracks);
  const bpm = useProjectStore((s) => s.musical_context.bpm);
  const lengthBeats = useProjectStore((s) => s.arrangement.length_beats);

  const playing = useTransportStore((s) => s.playing);
  const playheadBeat = useTransportStore((s) => s.playhead_beat);
  const startBeat = useTransportStore((s) => s.start_beat);
  const stopBeat = useTransportStore((s) => s.stop_beat);
  const setPlayheadBeat = useTransportStore((s) => s.setPlayheadBeat);
  const togglePlay = useTransportStore((s) => s.togglePlay);
  const stop = useTransportStore((s) => s.stop);

  // RAF 驱动 playhead —— 真实 transport 效果
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);
  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    lastTsRef.current = performance.now();
    const step = (ts: number) => {
      const dt = (ts - lastTsRef.current) / 1000;   // s
      lastTsRef.current = ts;
      const beatsPerSec = bpm / 60;
      const next = playheadBeat + dt * beatsPerSec;
      if (next >= stopBeat || next >= lengthBeats) {
        stop();
        return;
      }
      setPlayheadBeat(next);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, bpm, playheadBeat, stopBeat, lengthBeats]);

  const totalW = lengthBeats * BEAT_W;

  // ─── 空轨道早返回 ───────────────────────────────────────────
  if (tracks.length === 0) {
    return (
      <div className="h-full flex flex-col bg-[var(--color-timeline-bg)] text-notion-text">
        <div className="flex-1 flex items-center justify-center">
          <EmptyTimeline />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[var(--color-timeline-bg)] text-notion-text">
      {/* ====== Transport bar ====== */}
      <div className="h-10 border-b border-notion-border flex items-center gap-3 px-4 shrink-0 bg-notion-bg">
        <button
          onClick={() => { if (playing) stop(); else togglePlay(); }}
          className="icon-btn"
          title={playing ? "暂停" : "播放"}
        >
          {playing ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>
        <button onClick={() => { stop(); setPlayheadBeat(startBeat); }} className="icon-btn" title="回到起点">
          <SkipForward className="w-3.5 h-3.5 -scale-x-100" />
        </button>
        <div className="text-[12px] font-mono text-notion-muted">
          BPM <span className="text-notion-text font-semibold">{bpm}</span>
        </div>
        <div className="text-[12px] font-mono text-notion-muted">
          Playhead <span className="text-notion-accent font-semibold">{playheadBeat.toFixed(2)}</span> / {lengthBeats}
        </div>
      </div>

      {/* ====== 时间线主体（可横向滚动） ====== */}
      <div className="flex-1 overflow-auto">
        <div className="relative min-w-full" style={{ width: Math.max(totalW + 600, 800) }}>
          {/* ===== 标尺行 ===== */}
          <div
            className="sticky top-0 z-10 h-7 bg-notion-bg border-b border-notion-border flex"
            style={{ marginLeft: 200 }}
          >
            {Array.from({ length: lengthBeats }).map((_, b) => (
              <div
                key={b}
                className={[
                  "shrink-0 h-full border-l flex items-end pb-0.5 text-[10px] font-mono",
                  b % BEATS_PER_BAR === 0 ? "border-notion-text/40 text-notion-text font-semibold bg-notion-hover/40" : "border-notion-border text-notion-faint",
                ].join(" ")}
                style={{ width: BEAT_W }}
              >
                {b % BEATS_PER_BAR === 0 ? b : ""}
              </div>
            ))}
          </div>

          {/* ===== Track rows ===== */}
          <div className="relative">
            {tracks.map((t) => (
              <TrackRow key={t.id} track={t} lengthBeats={lengthBeats} totalW={totalW} />
            ))}

            {/* playhead 红色竖线 */}
            <div
              className="pointer-events-none absolute top-0 bottom-0 w-[2px] bg-notion-danger z-20 shadow-[0_0_6px_rgba(239,68,68,0.6)]"
              style={{ left: 200 + playheadBeat * BEAT_W }}
            >
              <div className="w-3 h-3 rounded-full bg-notion-danger -ml-[5px] -mt-1" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyTimeline() {
  const addTrack = useProjectStore((s) => s.addTrack);
  const init = useCallback(() => {
    addTrack("鼓组", "drums");
    addTrack("贝斯", "bass");
    addTrack("Pad", "pad");
    addTrack("主音", "lead");
  }, [addTrack]);
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-[12px] text-notion-faint">
      <div className="text-[13px] text-notion-muted">空时间线 · 先加几条轨道</div>
      <button className="notion-btn-primary !py-1.5 !text-[12px]" onClick={init}>
        初始化 4 轨模板
      </button>
    </div>
  );
}

function TrackRow({ track, lengthBeats, totalW }: { track: ReturnType<typeof useProjectStore.getState>["tracks"][number]; lengthBeats: number; totalW: number }) {
  const removeClip = useProjectStore((s) => s.removeClip);
  const selectClip = useProjectStore((s) => s);
  return (
    <div className="flex border-b border-notion-border">
      {/* 轨道名（固定 200px） */}
      <div className="shrink-0 w-[200px] border-r border-notion-border px-3 py-2 text-[12px] flex items-center gap-2 bg-[var(--color-track-header)]">
        <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: track.color }} />
        <div className="flex-1 min-w-0">
          <div className="truncate font-medium">{track.name}</div>
          <div className="text-[11px] text-notion-faint">{track.instrument}</div>
        </div>
        <span className="text-[11px] text-notion-faint font-mono">{Math.round(track.volume * 100)}</span>
      </div>

      {/* 轨道行：网格 + clips */}
      <div
        className="relative shrink-0"
        style={{ width: totalW, height: ROW_H }}
      >
        {/* 网格 */}
        {Array.from({ length: lengthBeats }).map((_, b) => (
          <div
            key={b}
            className={[
              "absolute top-0 bottom-0 border-l",
              b % BEATS_PER_BAR === 0 ? "border-notion-text/30 bg-notion-hover/20" : "border-notion-border/60",
            ].join(" ")}
            style={{ left: b * BEAT_W, width: BEAT_W }}
          />
        ))}

        {/* Clips */}
        {track.clips.map((c) => (
          <ClipBlock
            key={c.id}
            clip={c}
            trackColor={track.color}
            onRemove={() => removeClip(c.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ClipBlock({ clip, trackColor, onRemove }: {
  clip: ReturnType<typeof useProjectStore.getState>["tracks"][number]["clips"][number];
  trackColor: string;
  onRemove: () => void;
}) {
  const left = clip.start_beat * BEAT_W;
  const width = clip.length_beat * BEAT_W;

  let label = "";
  if (clip.content.kind === "chord") {
    const ev = clip.content.events[0];
    if (ev) label = `${rootToName(ev.root)}${qualityLabel(ev.quality)}${ev.function_label ? ` · ${ev.function_label}` : ""}`;
  } else if (clip.content.kind === "audio") {
    label = `🔊 ${Math.round(clip.content.duration_beats)}b`;
  } else if (clip.content.kind === "midi") {
    label = `🎹 ${clip.content.notes.length} notes`;
  } else {
    label = clip.content.kind;
  }

  return (
    <div
      className="absolute top-1 bottom-1 rounded-md overflow-hidden group cursor-pointer border border-white/10 shadow-sm hover:brightness-110 transition"
      style={{ left, width, backgroundColor: trackColor + "cc" }}
      title={`${label}\n点击查看`}
    >
      {/* 条纹纹理 */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, transparent 0 4px, rgba(255,255,255,0.2) 4px 5px)",
        }}
      />
      <div className="relative h-full flex items-center px-2 text-[11px] font-medium text-white truncate">
        {label}
      </div>
      {/* 删除按钮 */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute top-0.5 right-0.5 w-4 h-4 rounded bg-black/50 text-white text-[10px] opacity-0 group-hover:opacity-100 flex items-center justify-center"
        title="删除"
      >
        ×
      </button>
    </div>
  );
}

function EmptyTimeline__unused() { return null; }
