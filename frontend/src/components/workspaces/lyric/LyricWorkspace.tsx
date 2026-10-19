/**
 * 词作台 —— Center: LyricWorkspace（渲染 LyricEditor） / LeftPanel: LyricLeftPanel。
 * 为了让 CenterCanvas 引用 `<LyricWorkspace />` 和 LeftPanel.tsx 引用 `<LyricLeftPanel />` 都能通，
 * 这个文件同时 export 两个组件。
 */
import { v4 as uuid } from "uuid";
import { Plus, Trash2 } from "lucide-react";
import { useProjectStore } from "../../../stores/projectStore";
import { LyricEditor } from "./LyricEditor";

/** Center：歌词编辑器。 */
export function LyricWorkspace() {
  return <LyricEditor />;
}

/** LeftPanel：section 管理 + 字数统计 + 快速加 Verse/Chorus。 */
export function LyricLeftPanel() {
  const sections = useProjectStore((s) => s.lyrics.sections);
  const addSection = useProjectStore((s) => s.addLyricSection);
  const removeSection = useProjectStore((s) => s.removeLyricSection);

  const addPresetSection = (label: string) => {
    addSection({
      id: uuid(),
      label,
      lines: [
        { id: uuid(), text: "", syllables: [] },
        { id: uuid(), text: "", syllables: [] },
        { id: uuid(), text: "", syllables: [] },
        { id: uuid(), text: "", syllables: [] },
      ],
    });
  };

  const totalChars = sections.reduce(
    (s, sec) => s + sec.lines.reduce((l, ln) => l + ln.text.length, 0),
    0,
  );
  const totalLines = sections.reduce((s, sec) => s + sec.lines.filter((ln) => ln.text.trim()).length, 0);

  return (
    <div className="p-3 space-y-4">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-notion-faint mb-2 px-1">加段落</div>
        <div className="flex flex-wrap gap-1">
          {["Verse", "Pre-Chorus", "Chorus", "Bridge", "Outro"].map((label) => (
            <button
              key={label}
              onClick={() => addPresetSection(label)}
              className="text-[11px] rounded border border-notion-border hover:border-notion-accent hover:bg-notion-hover px-2 py-1 transition-colors flex items-center gap-0.5"
            >
              <Plus className="w-2.5 h-2.5" /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="notion-card p-3 space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-notion-faint">当前文稿</div>
        <div className="flex justify-between text-[12px]"><span className="text-notion-muted">段落</span><span className="font-mono">{sections.length}</span></div>
        <div className="flex justify-between text-[12px]"><span className="text-notion-muted">有内容行</span><span className="font-mono">{totalLines}</span></div>
        <div className="flex justify-between text-[12px]"><span className="text-notion-muted">字</span><span className="font-mono">{totalChars}</span></div>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-wider text-notion-faint mb-2 px-1">段落 ({sections.length})</div>
        {sections.length === 0 && (
          <div className="text-[12px] text-notion-faint text-center py-3">还没有段落 · 点上面加一个 Verse 开始</div>
        )}
        <div className="space-y-1">
          {sections.map((sec, i) => (
            <div key={sec.id} className="group rounded-md bg-notion-hover/40 px-2 py-1.5 border border-transparent hover:bg-notion-hover hover:border-notion-border transition-colors">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-sm bg-notion-accent/20 text-notion-accent text-[11px] flex items-center justify-center font-mono">{i + 1}</span>
                <span className="flex-1 text-[12px] truncate font-medium">{sec.label}</span>
                <span className="text-[11px] text-notion-faint">{sec.lines.filter((l) => l.text.trim()).length} 行</span>
                <button onClick={() => removeSection(sec.id)} className="opacity-0 group-hover:opacity-100 text-notion-faint hover:text-notion-danger" title="删除">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
