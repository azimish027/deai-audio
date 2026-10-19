/**
 * backupStore — 用户数据导入 / 导出
 *
 * 设计原则：
 *   - 导出的 = 用户在本地产生的持久化数据（主题、AI配置、对话历史、项目、音乐知识）
 *   - 导出的 ≠ 源码、组件实现、构建产物、node_modules、后端引擎代码
 *   - 导出的 ≠ 运行时状态（toast / playing playhead / BlobURL / 流式输出片段）
 *   - 导出文件带 schemaVersion，导入时校验兼容，未知版本拒绝恢复
 */

/* ============ 可导出的 store 列表 ============ */

import { useThemeStore } from '../theme/themeStore';
import { useAiStore } from './aiStore';
import { useChatStore } from './chatStore';
import { useKnowledgeStore } from './knowledgeStore';
import { useProjectStore } from './projectStore';
import { useSessionStore } from './sessionStore';
import { useEngineStore } from './engineStore';

/* ============ 每个 store 的 pickForExport 函数 ============
 * 剔除运行时状态（toast / playing / playhead / BlobURL / 流式片段）
 * 保留持久化数据（用户真的数据）
 */

function pickTheme() {
  const s = useThemeStore.getState();
  // config 里的 bgImage 是 dataURL，算用户数据（用户自己上传的背景图），保留
  return { config: s.config };
}

function pickAi() {
  const s = useAiStore.getState();
  // apiKey 保留——这是用户主动填的，丢失反而会困惑用户
  return {
    providerId: s.providerId,
    apiKey: s.apiKey,
    baseURL: s.baseURL,
    model: s.model,
  };
}

function pickChat() {
  const s = useChatStore.getState();
  return { messages: s.messages };   // current_stream / sending 是运行时状态，丢掉
}

function pickKnowledge() {
  const s = useKnowledgeStore.getState();
  return { learned_ids: s.learned_ids, last_viewed: s.last_viewed, filter: s.filter };
}

function pickProjects() {
  const s = useProjectStore.getState();
  return { projects: s.projects, current_project_id: s.current_project_id };
}

function pickSessions() {
  const s = useSessionStore.getState();
  return { sessions: s.sessions, current_session_id: s.current_session_id };
}

function pickEngine() {
  const s = useEngineStore.getState();
  // 只保留 repair_sessions / selected_session_id / analyze_result
  // audio_url / processed_url 是 Blob URL，换浏览器就死，不导出
  return {
    repair_sessions: s.repair_sessions,
    selected_session_id: s.selected_session_id,
    analyze_result: s.analyze_result,
  };
}

/* ============ 版本 & 结构 ============ */

export const BACKUP_SCHEMA_VERSION = 1;

export interface BackupFile {
  schemaVersion: number;
  app: string;                    // 'DeAI Audio'
  exportedAt: string;             // ISO timestamp
  data: {
    theme: ReturnType<typeof pickTheme>;
    ai: ReturnType<typeof pickAi>;
    chat: ReturnType<typeof pickChat>;
    knowledge: ReturnType<typeof pickKnowledge>;
    projects: ReturnType<typeof pickProjects>;
    sessions: ReturnType<typeof pickSessions>;
    engine: ReturnType<typeof pickEngine>;
  };
}

/* ============ 导出 ============ */

export function exportUserData(): BackupFile {
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    app: 'DeAI Audio',
    exportedAt: new Date().toISOString(),
    data: {
      theme: pickTheme(),
      ai: pickAi(),
      chat: pickChat(),
      knowledge: pickKnowledge(),
      projects: pickProjects(),
      sessions: pickSessions(),
      engine: pickEngine(),
    },
  };
}

export function downloadBackupJson() {
  const payload = exportUserData();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.download = `deai-audio-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ============ 导入 ============ */

export interface ImportResult {
  ok: boolean;
  message: string;
  restoredStores: string[];
}

export function importUserData(text: string): ImportResult {
  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch {
    return { ok: false, message: '不是有效的 JSON 文件', restoredStores: [] };
  }

  if (typeof file !== 'object' || file === null) {
    return { ok: false, message: '文件结构异常', restoredStores: [] };
  }

  const f = file as Partial<BackupFile>;
  if (f.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    return {
      ok: false,
      message: `版本不兼容：文件是 v${f.schemaVersion}，当前程序只支持 v${BACKUP_SCHEMA_VERSION}`,
      restoredStores: [],
    };
  }
  if (f.app && f.app !== 'DeAI Audio') {
    return { ok: false, message: '这不是 DeAI Audio 的备份文件', restoredStores: [] };
  }
  if (!f.data || typeof f.data !== 'object') {
    return { ok: false, message: '缺少 data 字段', restoredStores: [] };
  }

  const restored: string[] = [];
  const d = f.data as Record<string, unknown>;

  try {
    /* theme */
    const themeData = d.theme as { config?: unknown } | undefined;
    if (themeData?.config && typeof themeData.config === 'object') {
      useThemeStore.getState().setTheme(themeData.config as any);
      restored.push('theme');
    }

    /* ai */
    const aiData = d.ai as Record<string, unknown> | undefined;
    if (aiData) {
      useAiStore.setState((s) => ({ ...s, ...aiData }));
      restored.push('ai');
    }

    /* chat */
    const chatData = d.chat as { messages?: unknown[] } | undefined;
    if (Array.isArray(chatData?.messages)) {
      useChatStore.getState().clearAll();
      const store = useChatStore.getState();
      (chatData.messages as any[]).forEach((m) => store.addMessage({ role: m.role, content: m.content, provenance: m.provenance }));
      restored.push('chat');
    }

    /* knowledge */
    const kd = d.knowledge as Record<string, unknown> | undefined;
    if (kd) {
      useKnowledgeStore.setState((s) => ({
        ...s,
        learned_ids: Array.isArray(kd.learned_ids) ? kd.learned_ids as string[] : s.learned_ids,
        last_viewed: (kd.last_viewed && typeof kd.last_viewed === 'object') ? kd.last_viewed as Record<string, number> : s.last_viewed,
        filter: (kd.filter && typeof kd.filter === 'object') ? { ...s.filter, ...kd.filter as any } : s.filter,
      }));
      restored.push('knowledge');
    }

    /* projects —— 直接 setState 合并 */
    const pd = d.projects as Record<string, unknown> | undefined;
    if (pd && Array.isArray((pd as any).projects)) {
      useProjectStore.setState((s) => ({
        ...s,
        projects: (pd as any).projects,
        current_project_id: (pd as any).current_project_id ?? null,
      }));
      restored.push('projects');
    }

    /* sessions */
    const sd = d.sessions as Record<string, unknown> | undefined;
    if (sd && Array.isArray((sd as any).sessions)) {
      useSessionStore.setState((s) => ({
        ...s,
        sessions: (sd as any).sessions,
        current_session_id: (sd as any).current_session_id ?? null,
      }));
      restored.push('sessions');
    }

    /* engine */
    const ed = d.engine as Record<string, unknown> | undefined;
    if (ed) {
      useEngineStore.setState((s) => ({
        ...s,
        repair_sessions: Array.isArray((ed as any).repair_sessions) ? (ed as any).repair_sessions : s.repair_sessions,
        selected_session_id: (ed as any).selected_session_id ?? s.selected_session_id,
        analyze_result: (ed as any).analyze_result ?? s.analyze_result,
      }));
      restored.push('engine');
    }
  } catch (err) {
    return { ok: false, message: `恢复过程出错：${err instanceof Error ? err.message : String(err)}`, restoredStores: restored };
  }

  return {
    ok: true,
    message: restored.length > 0
      ? `成功恢复 ${restored.length} 项数据：${restored.join(', ')}`
      : '文件中没有可恢复的数据',
    restoredStores: restored,
  };
}

/** 从 File 读取并导入 */
export async function importBackupFromFile(file: File): Promise<ImportResult> {
  const text = await file.text();
  return importUserData(text);
}
