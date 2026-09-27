/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { localVisitCounter } from './src/app/visits/localVisitCounter.ts';

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
