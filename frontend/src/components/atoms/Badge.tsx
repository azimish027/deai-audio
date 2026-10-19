/**
 * Badge —— 原子层标签/徽章。
 *
 * 四种语义级别（框架§2.2 Color令牌）：
 *   default / primary / success / danger
 *
 * 铁律（框架）：原子层禁止写业务逻辑
 */
import { type HTMLAttributes, type ReactNode } from "react";

export type BadgeVariant = "default" | "primary" | "success" | "danger";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children?: ReactNode;
}

const variantClass: Record<BadgeVariant, string> = {
  default: "",
  primary: "badge-primary",
  success: "badge-success",
  danger:  "badge-danger",
};

export function Badge({ variant = "default", className = "", children, ...rest }: BadgeProps) {
  return (
    <span className={`badge ${variantClass[variant]} ${className}`} {...rest}>
      {children}
    </span>
  );
}
