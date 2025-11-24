import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    postcss: './postcss.config.js',
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8008/', // Django 后端地址
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
})
