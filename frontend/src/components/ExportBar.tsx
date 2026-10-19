import { Download, FileAudio } from "lucide-react";

export function ExportBar({
  exports,
}: {
  exports: { wav?: string; m4a?: string; mp3?: string };
}) {
  const items = [
    { key: "wav", label: "WAV 母带", hint: "48kHz · 24bit PCM" },
    { key: "m4a", label: "M4A (AAC)", hint: "256 kbps" },
    { key: "mp3", label: "MP3", hint: "320 kbps" },
  ] as const;

  return (
    <div className="notion-card">
      <div className="px-4 py-3 border-b border-notion-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileAudio className="w-4 h-4 text-notion-muted" />
          <span className="text-[13px] font-medium">导出</span>
        </div>
        <div className="text-[11px] text-notion-faint">三个格式已就绪</div>
      </div>
      <div className="p-3 flex items-center gap-2">
        {items.map((it) => {
          const ok = !!exports[it.key];
          return (
            <button
              key={it.key}
              disabled={!ok}
              className={`flex-1 flex flex-col items-start gap-1 px-3 py-2 rounded-md border text-left
                ${ok
                  ? "border-notion-border hover:bg-notion-hover cursor-pointer"
                  : "border-dashed border-notion-border text-notion-faint cursor-not-allowed"}
              `}
            >
              <div className="flex items-center gap-1.5 text-[12px] font-medium">
                <Download className="w-3 h-3" /> {it.label}
              </div>
              <div className="text-[11px] text-notion-faint">{it.hint}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
