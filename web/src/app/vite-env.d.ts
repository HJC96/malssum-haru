/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'mock'(기본) | 'api'. QT 데이터 출처. 개인 계획과 무관하다. */
  readonly VITE_QT_SOURCE?: string;
  /** mock일 때 시나리오 이름(app/qt/fixtures.ts). */
  readonly VITE_QT_MOCK_SCENARIO?: string;
}
