/**
 * Divider —— 原子层分隔线。
 *
 * 铁律（框架）：原子层禁止写业务逻辑
 */
import { type HTMLAttributes } from "react";

interface DividerProps extends HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
}

export function Divider({ orientation = "horizontal", className = "", ...rest }: DividerProps) {
  const cls = orientation === "vertical"
    ? "w-px h-full self-stretch"
    : "divider";
  return <div className={`${cls} ${className}`} role="separator" {...rest} />;
}
