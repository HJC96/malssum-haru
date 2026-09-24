// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// 계산 엔진(domain)과 데이터(data)는 순수해야 한다: 시각·난수·저장소·네트워크·로그를 쓰지 않는다.
// (계약 원칙 1·4, 공통 규칙: 개인 계획·읽은 범위를 저장·전송·기록하지 않는다)

const SRC = fileURLToPath(new URL('..', import.meta.url));

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p));
    else if (/\.(ts|tsx|json)$/.test(name) && !/\.test\.tsx?$/.test(name) && name !== 'testHelpers.ts') out.push(p);
  }
  return out;
}

function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

const FORBIDDEN: Array<[string, RegExp]> = [
  ['Date.now()', /\bDate\s*\.\s*now\b/],
  ['인자 없는 new Date()', /\bnew\s+Date\s*\(\s*\)/],
  ['Date() 호출(현재 시각 문자열)', /(?<![\w.])Date\s*\(\s*\)/],
  ['Math.random', /\bMath\s*\.\s*random\b/],
  ['performance.now', /\bperformance\s*\.\s*now\b/],
  ['crypto.getRandomValues', /\bcrypto\s*\.\s*(getRandomValues|randomUUID)\b/],
  ['localStorage', /\blocalStorage\b/],
  ['sessionStorage', /\bsessionStorage\b/],
  ['indexedDB', /\bindexedDB\b/i],
  ['document.cookie', /\bdocument\s*\.\s*cookie\b/],
  ['fetch', /(?<![\w.])fetch\s*\(/],
  ['XMLHttpRequest', /\bXMLHttpRequest\b/],
  ['WebSocket', /\bWebSocket\b/],
  ['navigator.sendBeacon', /\bsendBeacon\b/],
  ['console', /\bconsole\s*\./],
  ['process.env', /\bprocess\s*\.\s*env\b/],
  ['node:fs 등 Node 모듈', /from\s+['"]node:/],
];

describe('순수성: domain·data는 시각·난수·저장소·네트워크·console을 쓰지 않는다', () => {
  const files = [...sourceFiles(join(SRC, 'domain')), ...sourceFiles(join(SRC, 'data'))];

  it('검사 대상 소스가 실제로 있다', () => {
    expect(files.some((f) => f.endsWith('plan.ts'))).toBe(true);
    expect(files.some((f) => f.endsWith('sampleBible.ts'))).toBe(true);
  });

  for (const [label, pattern] of FORBIDDEN) {
    it(`${label} 없음`, () => {
      const hits = files.filter((f) => pattern.test(stripComments(readFileSync(f, 'utf8'))));
      expect(hits).toEqual([]);
    });
  }

  it('검사 패턴이 실제로 금지 코드를 잡는다', () => {
    const bad = ['Date.now()', 'new Date()', 'Math.random()', 'localStorage.x', 'fetch("/a")', 'console.log(1)'];
    for (const code of bad) {
      expect(FORBIDDEN.some(([, re]) => re.test(stripComments(code)))).toBe(true);
    }
    // 인자 있는 new Date는 허용(고정 입력)
    expect(FORBIDDEN.some(([, re]) => re.test('new Date(0)'))).toBe(false);
    // 주석 안의 언급은 무시
    expect(FORBIDDEN.some(([, re]) => re.test(stripComments('// Date.now() 금지\n/* console.log */')))).toBe(false);
  });
});
