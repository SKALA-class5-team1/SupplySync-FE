import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    // 백엔드 화면용 API(/api)는 로컬 Spring Boot(8080)로 넘긴다. CORS 설정 없이 동작한다.
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
