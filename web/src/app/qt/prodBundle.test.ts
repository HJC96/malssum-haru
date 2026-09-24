// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PDF_FONT_PATH } from '@/export/pdf';

/**
 * F-01: 환경 변수 없이 만든 프로덕션 산출물에는 mock fixture(고정 범위)가 없어야 한다.
 * 양성 대조로 VITE_QT_SOURCE=mock 빌드에는 들어 있음도 확인한다(검사가 실제로 동작하는지).
 */
const webRoot = process.cwd();
const MARKERS = ['maeil-seongyeong-adapter/1', 'saengmyeong-ui-sam-adapter/1', '2026-09-24T01:02:02Z'];

function build(env: Record<string, string>): string {
  const out = mkdtempSync(join(tmpdir(), 'malssum-dist-'));
  const cleanEnv = { ...process.env };
  delete cleanEnv.VITE_QT_SOURCE;
  delete cleanEnv.VITE_QT_MOCK_SCENARIO;
  execFileSync('pnpm', ['exec', 'vite', 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'], {
    cwd: webRoot,
    env: { ...cleanEnv, NODE_ENV: 'production', ...env },
    stdio: 'pipe',
  });
  return out;
}

function assetText(dir: string): Array<{ file: string; text: string }> {
  const assets = join(dir, 'assets');
  return readdirSync(assets)
    .filter((f) => f.endsWith('.js'))
    .map((f) => ({ file: f, text: readFileSync(join(assets, f), 'utf8') }));
}

describe('프로덕션 빌드 산출물', () => {
  const dirs: string[] = [];
  afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

  it('기본 빌드에는 QT mock fixture 범위가 들어가지 않는다', () => {
    const dir = build({});
    dirs.push(dir);
    const hits = assetText(dir).filter(({ text }) => MARKERS.some((m) => text.includes(m))).map((a) => a.file);
    expect(hits).toEqual([]);
    expect(assetText(dir).some(({ text }) => text.includes('/api/qt/today'))).toBe(true);
  }, 120_000);

  it('VITE_QT_SOURCE=mock으로 명시한 빌드에는 fixture가 들어간다(검사 자체가 동작함)', () => {
    const dir = build({ VITE_QT_SOURCE: 'mock' });
    dirs.push(dir);
    expect(assetText(dir).some(({ text }) => MARKERS.some((m) => text.includes(m)))).toBe(true);
  }, 120_000);

  it('PDF 폰트 파일이 산출물에 있고 요청 경로와 일치한다(F-02)', () => {
    const dir = build({});
    dirs.push(dir);
    const p = join(dir, PDF_FONT_PATH);
    expect(existsSync(p)).toBe(true);
    expect(readFileSync(p).length).toBeGreaterThan(100_000);
    // 빌드된 코드가 요청하는 경로가 실제 파일 이름과 같다.
    const all = assetText(dir).map((a) => a.text).join('\n');
    expect(all).toContain(PDF_FONT_PATH);
    expect(existsSync(resolve(webRoot, 'public', PDF_FONT_PATH))).toBe(true);
  }, 120_000);
});
