/**
 * Input —— 原子层输入框组件。
 *
 * 状态覆盖：Default / Focus / Disabled / Error
 * 铁律（框架）：原子层禁止写业务逻辑
 */
import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, className = "", ...rest }, ref) => (
    <input
      ref={ref}
      data-error={error ? "true" : undefined}
      className={`input ${className}`}
      {...rest}
    />
  ),
);
Input.displayName = "Input";
