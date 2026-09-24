import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { durannoDateUrl, MAEIL_TODAY_URL } from './officialLinks';

const contract = readFileSync(
  // vitest는 web/에서 실행된다.
  resolve(process.cwd(), '../docs/contracts/qt-today.md'),
  'utf8',
);

describe('폴백 공식 링크는 계약의 URL 형식과 같다', () => {
  it('매일성경 오늘 페이지', () => {
    expect(contract).toContain(`"officialUrl": "${MAEIL_TODAY_URL}"`);
  });

  it('생명의삶 날짜별 페이지', () => {
    expect(contract).toContain(`"officialUrl": "${durannoDateUrl('2026-09-24')}"`);
  });

  it('모두 https다', () => {
    expect(MAEIL_TODAY_URL.startsWith('https://')).toBe(true);
    expect(durannoDateUrl('2026-01-01').startsWith('https://')).toBe(true);
  });
});
