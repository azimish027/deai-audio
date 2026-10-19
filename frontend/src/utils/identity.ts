/**
 * 匿名身份工具 —— 生成/读取 localStorage 里的匿名 UUID。
 *
 * 依据 PRODUCT-FRAMEWORK.md §0：
 *   "至少能区分'首次访问'和'再次访问'（哪怕是本地存储的匿名标识）"
 *
 * 首次调用生成 UUID 并存 localStorage，后续调用返回同一个值。
 */
const KEY = "deai_anonymous_id_v1";

export function getAnonymousId(): string {
  if (typeof localStorage === "undefined") return "dev-no-localstorage";
  let id = localStorage.getItem(KEY);
  if (!id) {
    // 用 crypto.randomUUID，fallback 到手动拼接
    id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `anon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}

export function isFirstVisit(): boolean {
  if (typeof localStorage === "undefined") return true;
  return !localStorage.getItem(KEY);
}
