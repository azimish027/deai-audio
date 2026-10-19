import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_TARGET || 'http://127.0.0.1:8765'

  console.log(`[vite] mode=${mode}  VITE_API_TARGET=${apiTarget}`)

  return {
    plugins: [react()],
    server: {
      // 允许局域网访问（手机也能打开）
      host: '0.0.0.0',
      port: 5173,
      // 把前端的 /api/* 请求代理到 FastAPI 后端
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
