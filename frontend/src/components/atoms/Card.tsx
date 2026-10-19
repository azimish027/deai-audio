/**
 * Card —— 原子层卡片容器。
 *
 * 三种 elevation 级别（框架§2.2令牌 §5 Elevation）：
 *   flat    平面（无阴影）
 *   raised  轻微凸起
 *   overlay 悬浮/弹窗级
 *
 * 铁律（框架）：原子层禁止写业务逻辑
 */
import { type HTMLAttributes, type ReactNode } from "react";

export type CardElevation = "flat" | "raised" | "overlay";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevation?: CardElevation;
  children?: ReactNode;
}

const elevationClass: Record<CardElevation, string> = {
  flat:    "card",
  raised:  "card-raised",
  overlay: "card-overlay",
};

export function Card({ elevation = "flat", className = "", children, ...rest }: CardProps) {
  return (
    <div className={`${elevationClass[elevation]} ${className}`} {...rest}>
      {children}
    </div>
  );
}
