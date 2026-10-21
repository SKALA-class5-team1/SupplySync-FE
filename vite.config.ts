import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    // 백엔드 화면용 API(/api)는 로컬 Spring Boot(8080)로 넘긴다.
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        // 브라우저가 붙인 Origin을 빼고 보낸다. 남겨 두면 BE의 CORS 허용 목록(FRONTEND_ORIGINS)에 없을 때
        // 컨트롤러에 닿기 전에 403(Invalid CORS request)이 난다. 개발용 프록시에서만 쓴다.
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'))
        },
      },
    },
  },
})
