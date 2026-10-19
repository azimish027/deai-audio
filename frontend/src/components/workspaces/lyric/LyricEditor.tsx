import { useProjectStore } from "../../../stores/projectStore";

/** 词作台 Center —— LyricEditor。
 * 每行可编辑；实时显示末字标记（押韵辅助）。
 * 所有 action 从 projectStore 取稳定引用，避免无限重渲染。
 */
export function LyricEditor() {
  const sections = useProjectStore((s) => s.lyrics.sections);
  const updateLine = useProjectStore((s) => s.updateLyricLine);
  const addLine = useProjectStore((s) => s.addLyricLine);
  const removeLine = useProjectStore((s) => s.removeLyricLine);

  if (sections.length === 0) {
    return (
      <div className="h-full flex items-center justify-center flex-col gap-3 text-[13px] text-notion-faint">
        <div className="text-[14px] text-notion-muted">还没有歌词段落</div>
        <div className="text-[12px]">从左侧面板点 Verse / Chorus / Bridge 开始写</div>
      </div>
    );
  }

  // 收集所有非空行末字 id（用于渲染「末字 ✓」小徽章）
  const lineEndIds: Set<string> = new Set();
  for (const sec of sections) {
    for (const ln of sec.lines) {
      const trimmed = ln.text.trim();
      if (!trimmed) continue;
      if (trimmed.match(/[一-龥a-zA-Z0-9]$/)) lineEndIds.add(ln.id);
    }
  }

  return (
    <div className="h-full overflow-auto p-4 sm:p-6 max-w-[900px] mx-auto space-y-6">
      {sections.map((sec, secIdx) => (
        <section key={sec.id} className="notion-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-notion-accent/20 text-notion-accent text-[12px] flex items-center justify-center font-mono">
                {secIdx + 1}
              </span>
              <h3 className="text-[14px] font-semibold text-notion-text">{sec.label}</h3>
              <span className="text-[11px] text-notion-faint">
                {sec.lines.filter((l) => l.text.trim()).length} 行 ·
                {sec.lines.reduce((s, l) => s + l.text.length, 0)} 字
              </span>
            </div>
            <button
              onClick={() => addLine(sec.id)}
              className="text-[11px] text-notion-accent hover:underline"
            >+ 加一行</button>
          </div>

          <div className="space-y-1">
            {sec.lines.map((ln, lnIdx) => (
              <div key={ln.id} className="group flex items-center gap-2">
                <span className="text-[11px] font-mono text-notion-faint w-5 text-right shrink-0">{lnIdx + 1}</span>
                <input
                  value={ln.text}
                  onChange={(e) => updateLine(sec.id, ln.id, e.target.value)}
                  placeholder="输入歌词…"
                  className="flex-1 bg-transparent border-b border-transparent focus:border-notion-accent outline-none text-[15px] py-1 text-notion-text placeholder:text-notion-faint"
                />
                {lineEndIds.has(ln.id) && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-notion-success/10 text-notion-success shrink-0">
                    末字 ✓
                  </span>
                )}
                {sec.lines.length > 1 && (
                  <button
                    onClick={() => removeLine(sec.id, ln.id)}
                    className="opacity-0 group-hover:opacity-100 text-notion-faint hover:text-notion-danger text-[12px] shrink-0"
                    title="删除这行"
                  >×</button>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
