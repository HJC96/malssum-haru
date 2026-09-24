// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * 초기 로드 예산(gzip JS+CSS ≤ 약 150KB)을 지키기 위해 exceljs·pdf-lib·fontkit·폰트는
 * 내보내기 시점에만 내려받는다. 정적 import가 생기면 초기 번들이 수백 KB 커지므로 소스 수준에서 막는다.
 * (실제 크기는 `pnpm build`의 gzip 표로 확인한다.)
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'test' ? [] : sourceFiles(p);
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}

const HEAVY = /^\s*import\s+(?!type\b)[^;]*from\s+['"](exceljs|pdf-lib|@pdf-lib\/fontkit)['"]/m;

describe('무거운 내보내기 라이브러리는 지연 로드한다', () => {
  const files = sourceFiles(resolve(process.cwd(), 'src'));

  it('앱 소스에 exceljs·pdf-lib·fontkit의 정적 import가 없다', () => {
    const offenders = files.filter((f) => HEAVY.test(readFileSync(f, 'utf8'))).map((f) => f.replace(process.cwd(), ''));
    expect(offenders).toEqual([]);
  });

  it('동적 import는 export 모듈 안에만 있다', () => {
    const dyn = files
      .filter((f) => /import\(\s*['"](exceljs|pdf-lib|@pdf-lib\/fontkit)['"]\s*\)/.test(readFileSync(f, 'utf8')))
      .map((f) => f.replace(process.cwd(), ''));
    expect(dyn.sort()).toEqual(['/src/export/pdf.ts', '/src/export/xlsx.ts']);
  });

  it('화면 컴포넌트는 export 모듈을 동적 import로만 불러온다', () => {
    const panel = readFileSync(resolve(process.cwd(), 'src/components/plan/ExportPanel.tsx'), 'utf8');
    expect(panel).toMatch(/await import\('@\/export\/xlsx'\)/);
    expect(panel).toMatch(/await import\('@\/export\/pdf'\)/);
    expect(panel).not.toMatch(/from '@\/export\/(xlsx|pdf)'/);
  });
});
