/**
 * Button —— 原子层按钮组件。
 *
 * 四个层级（框架§2.2交互规范）：
 *   primary   主操作（蓝色填充）
 *   secondary 次要（描边+透明底）
 *   danger    危险/破坏性操作（红色填充）
 *   ghost     幽灵（透明，仅hover时显）
 *
 * 状态覆盖（7种）：Default / Hover / Active / Disabled / Loading / Error / Success
 * Loading 通过 `loading` prop 驱动（自动注入 Spinner）
 * Error / Success 通过 `data-error` / `data-success` class 控制样式
 *
 * 铁律（框架）：原子层禁止写业务逻辑，禁止调 store / API
 */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  error?: boolean;
  success?: boolean;
}

const variantClass: Record<ButtonVariant, string> = {
  primary:   "btn-primary",
  secondary: "btn-secondary",
  danger:    "btn-danger",
  ghost:     "btn-ghost",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "secondary", loading, disabled, leftIcon, rightIcon, error, success, className = "", children, ...rest },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        data-loading={loading ? "true" : undefined}
        data-error={error ? "true" : undefined}
        data-success={success ? "true" : undefined}
        className={`${variantClass[variant]} ${className}`}
        {...rest}
      >
        {loading && <span className="spinner" aria-hidden="true" />}
        {!loading && leftIcon}
        {children}
        {rightIcon}
      </button>
    );
  },
);
Button.displayName = "Button";
