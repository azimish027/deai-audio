import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_TARGET || 'http://127.0.0.1:8765'

  console.log(`[vite] mode=${mode}  VITE_API_TARGET=${apiTarget}`)

  return {
    plugins: [react()],
    /*
     * base: './'
     * 用相对路径，Vercel 静态托管时资源引用不会因子路径 404。
     * 同时兼容本地 Electron（file:// 协议下绝对路径会失效）。
     */
    base: './',
    server: {
      // 允许局域网访问（手机也能打开）
      host: '0.0.0.0',
      port: 5173,
      // 把前端的 /api/* 请求代理到 FastAPI 后端
      // 注意：生产部署（Vercel）不走 dev proxy，需在 Vercel Dashboard
      // 设置 VITE_API_TARGET 环境变量指向你的 FastAPI 服务
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    build: {
      outDir: 'dist',
    },
  }
})
