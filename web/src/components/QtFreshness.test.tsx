import { act, render, screen } from '@testing-library/react';
import type { DailyWordContent } from '@/app/dailyWord/types';
import { I18nProvider } from '@/i18n';
import { QtToday } from './QtToday';

const content = (date: string): DailyWordContent => ({
  schemaVersion: '1', date, timeZone: 'Asia/Seoul', contentVersion: `test-only-${date}`,
  oldTestament: {
    reference: { bookId: 'GEN', chapter: 1, verse: 1 }, translationId: 'test-only', textLanguage: 'ko', text: '[TEST ONLY — NOT SCRIPTURE]',
    explanation: { text: '[TEST ONLY — NOT EXPLANATION]', kind: 'editorial', language: 'ko' }, source: { name: 'Test-only', url: 'https://example.invalid' },
  },
  newTestament: {
    reference: { bookId: 'MAT', chapter: 1, verse: 1 }, translationId: 'test-only', textLanguage: 'ko', text: '[TEST ONLY — NOT SCRIPTURE]',
    explanation: { text: '[TEST ONLY — NOT EXPLANATION]', kind: 'editorial', language: 'ko' }, source: { name: 'Test-only', url: 'https://example.invalid' },
  },
});

describe('말씀 자료의 서울 날짜 신선도', () => {
  afterEach(() => vi.useRealTimers());

  it('서울 자정을 넘으면 어제 콘텐츠를 비우고 정확한 오늘 날짜 artifact만 다시 읽는다', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
    let clockMs = Date.parse('2026-09-24T14:00:00Z'); // 09-24 23:00 KST
    const clock = () => new Date(clockMs);
    const loader = vi.fn(async (date: string) => date === '2026-09-24' ? content(date) : null);
    render(<I18nProvider initialLang="ko"><QtToday dailyWordLoader={loader} clock={clock} checkIntervalMs={30_000} /></I18nProvider>);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('article', { name: '창세기 1:1' })).toBeInTheDocument();
    expect(loader).toHaveBeenCalledWith('2026-09-24');

    clockMs = Date.parse('2026-09-24T15:30:00Z'); // 09-25 00:30 KST
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(screen.getByText(/오늘 표시할 말씀 자료가 아직 준비되지 않았습니다/)).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(loader).toHaveBeenLastCalledWith('2026-09-25');
  });
});
