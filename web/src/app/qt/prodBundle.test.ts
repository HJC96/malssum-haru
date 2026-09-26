// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PDF_FONT_PATH } from '@/export/pdf';

/** Daily content is fetched by exact-date artifact at runtime; fixtures must never ship. */
const webRoot = process.cwd();
const MARKERS = ['maeil-seongyeong-adapter/1', 'saengmyeong-ui-sam-adapter/1', '2026-09-24T01:02:02Z', 'TEST ONLY — NOT SCRIPTURE'];

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

  it.each([{}, { VITE_QT_SOURCE: 'mock' }] as Record<string, string>[])('프로덕션 산출물에 일일 말씀 fixture나 구 QT API 경로가 들어가지 않는다 (%o)', (env) => {
    const dir = build(env);
    dirs.push(dir);
    const assets = assetText(dir);
    const hits = assets.filter(({ text }) => MARKERS.some((m) => text.includes(m)) || text.includes('/api/qt/today')).map((a) => a.file);
    expect(hits).toEqual([]);
    const dailyFiles = join(dir, 'daily-word');
    expect(existsSync(dailyFiles) ? readdirSync(dailyFiles) : []).toEqual(['2026-09-26.json']);
    const artifact = JSON.parse(readFileSync(join(dailyFiles, '2026-09-26.json'), 'utf8')) as {
      date: string;
      oldTestament: { translationId: string; text: string };
      newTestament: { translationId: string; text: string };
    };
    expect(artifact.date).toBe('2026-09-26');
    expect(artifact.oldTestament.translationId).toBe('kor-rv-1961');
    expect(artifact.newTestament.translationId).toBe('kor-rv-1961');
    expect(`${artifact.oldTestament.text}\n${artifact.newTestament.text}`).not.toMatch(/TEST ONLY|NOT SCRIPTURE/);
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
