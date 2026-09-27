/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

/** Local preview only. Production uses the DynamoDB-backed /api/visits route. */
function localVisitCounter(): Plugin {
  let day = '';
  let count = 0;
  return {
    name: 'local-visit-counter',
    configureServer(server) {
      server.middlewares.use('/api/visits', (request, response, next) => {
        if (request.method !== 'POST') return next();
        const currentDay = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
        }).format(new Date());
        if (currentDay !== day) {
          day = currentDay;
          count = 0;
        }
        count += 1;
        response.statusCode = 200;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store, max-age=0');
        response.end(JSON.stringify({ count }));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localVisitCounter()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // 방문 카운터는 위 개발 전용 미들웨어가 응답하고, 나머지 /api 경로만 QT 백엔드로 프록시한다.
    proxy: { '/api': 'http://localhost:8081' },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
