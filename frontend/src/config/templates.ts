/**
 * templates —— 前端可独立引用的模板元信息（硬编码，和 backend/engine/config/constants.py 对齐）
 * 前端也能从 /api/templates 动态拉，但 IntentPreview 等组件需要首屏同步展示。
 */

export const TEMPLATE_NAMES_ZH: Record<string, string> = {
  studio_vocal: '录音棚人声',
  live_band: '现场乐队感',
  film_voiceover: '电影旁白',
  bedroom_demo: '卧室 Demo',
  podcast_dialogue: '播客对话',
  short_video_voiceover: '短视频口播',
};

export const TEMPLATE_TARGET_LUFS: Record<string, number> = {
  studio_vocal: -16.0,
  live_band: -16.0,
  film_voiceover: -16.0,
  bedroom_demo: -16.0,
  podcast_dialogue: -16.0,
  short_video_voiceover: -14.0,
};

export function getTargetLufs(templateId: string): number {
  return TEMPLATE_TARGET_LUFS[templateId] ?? -16.0;
}
