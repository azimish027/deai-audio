/**
 * 模板选择器（修复台专用）。
 * 纯 props 组件，不依赖任何 store —— 调用方传入 templates / selected / onSelect。
 */
export function TemplateSelector({
  templates,
  selected,
  onSelect,
}: {
  templates: { id: string; name_zh: string; params: Record<string, unknown> }[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  // 如果后端还没连上，给默认 6 个
  const list = templates.length
    ? templates
    : [
        { id: "studio_vocal", name_zh: "录音棚人声", params: {} },
        { id: "live_band", name_zh: "现场乐队感", params: {} },
        { id: "film_voiceover", name_zh: "电影旁白", params: {} },
        { id: "bedroom_demo", name_zh: "卧室 Demo", params: {} },
        { id: "podcast_dialogue", name_zh: "播客对话", params: {} },
        { id: "short_video_voiceover", name_zh: "短视频口播", params: {} },
      ];

  return (
    <div>
      <div className="text-[12px] font-medium text-notion-muted mb-2">
        选择听感目标
      </div>
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1 sm:flex-wrap sm:overflow-visible">
        {list.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={[
              "shrink-0 h-8 px-3 rounded-md text-[13px] border transition-colors",
              selected === t.id
                ? "bg-notion-bg border-notion-accent text-notion-accent"
                : "bg-transparent border-notion-border text-notion-text hover:bg-notion-hover",
            ].join(" ")}
          >
            {t.name_zh}
          </button>
        ))}
      </div>
    </div>
  );
}
