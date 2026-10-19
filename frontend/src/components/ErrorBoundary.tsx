/**
 * ErrorBoundary —— 全局错误边界。
 *
 * 依据 PRODUCT-FRAMEWORK.md §3.2 Step 3「层级3：页面级兜底」：
 *   "全局错误边界（Error Boundary）：任何未捕获错误都不会白屏"
 *
 * React ErrorBoundary 必须是 class component（getDerivedStateFromError 只在 class 里有）。
 * 捕获范围：所有子组件树的 render 错误 + 子组件生命周期方法错误。
 * 不捕获：事件处理器（click onChange等）、异步代码（setTimeout/Promise）、server-side errors。
 */
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary] 捕获到错误：", error, errorInfo);
    // 生产环境可上报 Sentry 等错误监控
    // reportError({ error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-notion-bg">
          <div className="max-w-md w-full notion-card p-6 space-y-4 text-center">
            <div className="w-14 h-14 rounded-full bg-notion-danger/10 flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-notion-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-notion-text">页面出错了</h2>
              <p className="text-[12px] text-notion-muted mt-1">
                一个组件意外崩溃了。这不是你的错——按下面的按钮恢复。
              </p>
            </div>
            {this.state.error && (
              <pre className="text-[11px] bg-notion-hover p-3 rounded text-left text-notion-danger break-all whitespace-pre-wrap max-h-32 overflow-auto font-mono">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-2 justify-center pt-2">
              <button onClick={this.handleReset} className="btn-secondary !py-1.5 !text-[12px]">
                重试
              </button>
              <button onClick={this.handleReload} className="btn-primary !py-1.5 !text-[12px]">
                刷新页面
              </button>
            </div>
            <div className="text-[10px] text-notion-faint pt-2">
              如果问题持续，请把上面的错误信息反馈给开发者
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
