/** 后端 API 调用 —— 指向本地 FastAPI 服务。 */
import type { SessionInfo } from "../stores/sessionStore";

const BASE = "/api";

export async function listTemplates() {
  const r = await fetch(`${BASE}/templates`);
  if (!r.ok) throw new Error("无法加载模板列表");
  const json = await r.json();
  return json.templates as {
    id: string;
    name_zh: string;
    params: Record<string, unknown>;
  }[];
}

export async function processAudio(
  file: File,
  templateId: string
): Promise<SessionInfo> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("template_id", templateId);
  const r = await fetch(`${BASE}/process`, { method: "POST", body: fd });
  if (!r.ok) {
    const msg = await r.text().catch(() => r.statusText);
    throw new Error(`处理失败: ${msg}`);
  }
  return (await r.json()) as SessionInfo;
}

export async function healthCheck(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/health`);
    return r.ok;
  } catch {
    return false;
  }
}
