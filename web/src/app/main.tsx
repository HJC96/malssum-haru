import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/index.css';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('#root 요소가 없습니다.');

// 개발 화면에서 날짜별 카드 디자인을 검증할 때만 사용한다. 배포 빌드에는 적용되지 않는다.
const previewDate = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('previewDate') : null;
const previewNow = previewDate && /^\d{4}-\d{2}-\d{2}$/.test(previewDate)
  ? new Date(`${previewDate}T12:00:00+09:00`)
  : undefined;

createRoot(root).render(
  <StrictMode>
    <App {...(previewNow && !Number.isNaN(previewNow.getTime()) ? { now: previewNow } : {})} />
  </StrictMode>,
);
