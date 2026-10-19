import { useRef, useState } from "react";
import { Upload, AudioLines } from "lucide-react";

export function DropZone({ onFile }: { onFile: (f: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  };

  return (
    <div className="h-full flex items-center justify-center">
      <div
        onDragOver={() => setDragging(true)}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`w-[480px] h-[200px] sm:h-[260px] notion-card flex flex-col items-center justify-center gap-4 cursor-pointer
          ${dragging ? "border-notion-accent bg-notion-panel" : ""}
        `}
      >
        <div className="w-12 h-12 rounded-md bg-notion-panel border border-notion-border flex items-center justify-center">
          <AudioLines className="w-5 h-5 text-notion-muted" />
        </div>
        <div className="text-center">
          <div className="text-[15px] font-medium">拖入音频文件，或点击选择</div>
          <div className="text-[12px] text-notion-muted mt-1">
            支持 WAV · MP3 · M4A · FLAC · 录屏提取音频
          </div>
        </div>
        <button className="notion-btn-primary" type="button">
          <Upload className="w-3.5 h-3.5" /> 选择文件
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
      </div>
    </div>
  );
}
