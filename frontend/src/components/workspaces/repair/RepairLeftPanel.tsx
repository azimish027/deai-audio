import { Upload, Trash2, AudioLines, GitCompare } from "lucide-react";
import { useEngineStore } from "../../../stores/engineStore";
import { useProjectStore } from "../../../stores/projectStore";
import { useVersionStore } from "../../../stores/versionStore";

/** 修复台左侧：ImportZone（拖入/选择文件）+ AudioSessionList。 */
export function RepairLeftPanel() {
  const sessions = useEngineStore((s) => s.repair_sessions);
  const selected_id = useEngineStore((s) => s.selected_session_id);
  const selectSession = useEngineStore((s) => s.selectSession);
  const removeSession = useEngineStore((s) => s.removeSession);
  const startRepair = useEngineStore((s) => s.startRepair);
  const getSnapshots = useVersionStore((s) => s.getSnapshots);

  const onFile = (file: File) => {
    startRepair(file);
    // 同步进 Project.audio_sessions
    useProjectStore.setState((s) => ({
      audio_sessions: [...s.audio_sessions, {
        session_id: file.name,          // 先占坑，处理后 engineStore 回填
        template_id: "studio_vocal",
        input_path: file.name,
        input_name: file.name,
        state: "UPLOADED",
        diagnosis: {},
        segments: [],
        exports: {},
        created_at: Date.now(),
      }],
    }));
  };

  return (
    <div className="p-3 space-y-4">
      {/* ImportZone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
        className="notion-drag-zone min-h-[96px] flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-notion-border hover:border-notion-accent hover:bg-notion-hover cursor-pointer transition-colors"
        onClick={() => document.getElementById("repair-file-input")?.click()}
      >
        <Upload className="w-4 h-4 text-notion-muted" />
        <div className="text-[12px] text-notion-muted text-center leading-snug px-4">
          拖入音频文件<br />
          <span className="text-[11px]">或点击选择</span>
        </div>
        <input
          id="repair-file-input"
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
        />
      </div>

      {/* 会话列表 */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-notion-faint mb-2 px-1">
          修复会话
        </div>
        {sessions.length === 0 && (
          <div className="text-[12px] text-notion-faint text-center py-4">
            还没有会话，先拖入一个文件试试
          </div>
        )}
        <div className="space-y-1">
          {sessions.map((s) => {
            const active = selected_id === s.session_id;
            const versionCount = getSnapshots(s.session_id).filter((v) => v.kind === 'after').length;
            return (
              <div
                key={s.session_id}
                onClick={() => selectSession(s.session_id)}
                className={[
                  "group rounded-md px-2 py-1.5 cursor-pointer flex items-center gap-2 transition-colors",
                  active ? "bg-notion-accent/10 border border-notion-accent/30" : "hover:bg-notion-hover border border-transparent",
                ].join(" ")}
              >
                <AudioLines className="w-3.5 h-3.5 text-notion-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] truncate">{s.input_name}</div>
                  <div className="text-[11px] text-notion-muted flex gap-1.5 items-center">
                    <StatusDot status={s.status} />
                    <span>{statusLabel(s)}</span>
                    {versionCount >= 2 && (
                      <span className="flex items-center gap-0.5 text-[10px] text-notion-faint bg-notion-panel rounded px-1">
                        <GitCompare className="w-2.5 h-2.5" />
                        {versionCount}版
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeSession(s.session_id); useVersionStore.getState().clear(s.session_id); }}
                  className="opacity-0 group-hover:opacity-100 hover:text-notion-danger p-0.5"
                  title="删除会话 + 清理版本"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "done" || status === "exported" ? "bg-notion-success" :
    status === "processing" || status === "uploading" ? "bg-yellow-400 animate-pulse" :
    status === "error" ? "bg-notion-danger" : "bg-notion-faint";
  return <span className={`w-1.5 h-1.5 rounded-full ${color} shrink-0`} />;
}

function statusLabel(s: { status: string; progress_text?: string; state?: string }) {
  if (s.progress_text) return s.progress_text;
  if (s.status === "processing") return "处理中…";
  if (s.status === "uploading") return "上传中…";
  if (s.status === "done") return "已处理";
  if (s.status === "error") return "失败";
  return s.state ?? "就绪";
}
