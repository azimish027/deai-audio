/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // 所有颜色值走 index.css :root 里的设计令牌（v1.0 · 冻结）
        // 框架要求：禁止硬编码颜色，必须通过 CSS 变量统一驱动
        notion: {
          bg:           "var(--color-bg)",
          panel:        "var(--color-panel)",
          hover:        "var(--color-hover)",
          border:       "var(--color-border)",
          text:         "var(--color-text)",
          muted:        "var(--color-muted)",
          faint:        "var(--color-faint)",
          accent:       "var(--color-primary)",
          accentHover:  "var(--color-primary-hover)",
          danger:       "var(--color-danger)",
          success:      "var(--color-success)",
        },
      },
      fontFamily: {
        sans: [
          '"Inter"',
          '"PingFang SC"',
          '"Helvetica Neue"',
          "system-ui",
          "sans-serif",
        ],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        raised: "var(--shadow-raised)",
        overlay: "var(--shadow-overlay)",
      },
      transitionDuration: {
        fast: "var(--transition-fast)",
        med:  "var(--transition-med)",
        slow: "var(--transition-slow)",
        DEFAULT: "var(--transition-fast)",
      },
    },
  },
  plugins: [],
};
