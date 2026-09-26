import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DailyWordContent } from '@/app/dailyWord/types';
import { renderWithLang } from '@/app/test/render';
import { axeViolations } from '@/app/test/axe';
import { bibleSocietyPassageUrl, DailyWordSection } from './DailyWordSection';

const TEST_ONLY_NOT_SCRIPTURE: DailyWordContent = {
  schemaVersion: '1',
  date: '2026-09-26',
  timeZone: 'Asia/Seoul',
  contentVersion: 'test-only-v1',
  oldTestament: {
    reference: { bookId: 'GEN', chapter: 1, verse: 1 },
    translationId: 'kor-rv-1961',
    textLanguage: 'ko',
    text: '[TEST ONLY — NOT SCRIPTURE]',
    explanation: { text: '[TEST ONLY — NOT AN EXPLANATION]', kind: 'editorial', language: 'ko' },
    source: { name: 'Test-only source', url: 'https://example.invalid/test' },
  },
  newTestament: {
    reference: { bookId: 'MAT', chapter: 1, verse: 1 },
    translationId: 'kor-rv-1961',
    textLanguage: 'ko',
    text: '[TEST ONLY — NOT SCRIPTURE]',
    explanation: { text: '[TEST ONLY — NOT AN EXPLANATION]', kind: 'editorial', language: 'ko' },
    source: { name: 'Test-only source', url: 'https://example.invalid/test' },
  },
};
const TODAY = new Date('2026-09-26T03:00:00.000Z');

describe('DailyWordSection', () => {
  it('shows the Old and New Testament cards and translation chooser without exposing source metadata', async () => {
    renderWithLang(<DailyWordSection date="2026-09-26" content={TEST_ONLY_NOT_SCRIPTURE} status="ready" now={TODAY} />);

    expect(screen.getByRole('region', { name: /오늘의 말씀/ })).toHaveAttribute('aria-busy', 'false');
    expect(screen.getByRole('article', { name: '창세기 1:1' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: '마태복음 1:1' })).toBeInTheDocument();
    expect(screen.getAllByText('[TEST ONLY — NOT SCRIPTURE]')).toHaveLength(2);
    expect(screen.getAllByText('[TEST ONLY — NOT AN EXPLANATION]')).toHaveLength(2);
    expect(screen.getAllByText('개역한글판')).toHaveLength(2);
    expect(screen.getByText('구약')).toBeInTheDocument();
    expect(screen.getByText('신약')).toBeInTheDocument();
    expect(screen.queryByText('구약 말씀')).not.toBeInTheDocument();
    expect(screen.queryByText('신약 말씀')).not.toBeInTheDocument();
    expect(screen.queryByText('Test-only source')).not.toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.queryByText('다른 번역본 보기')).not.toBeInTheDocument();
    const oldCard = screen.getByRole('article', { name: '창세기 1:1' });
    await userEvent.click(within(oldCard).getByRole('button', { name: '개역한글판' }));
    expect(within(oldCard).getByRole('link', { name: /새번역/ })).toHaveAttribute(
      'href', bibleSocietyPassageUrl({ bookId: 'GEN', chapter: 1, verse: 1 }, 'SAENEW'),
    );
    expect(within(oldCard).getByRole('link', { name: /개역개정/ })).toHaveAttribute(
      'href', bibleSocietyPassageUrl({ bookId: 'GEN', chapter: 1, verse: 1 }, 'GAE'),
    );
    const newCard = screen.getByRole('article', { name: '마태복음 1:1' });
    await userEvent.hover(within(newCard).getByRole('button', { name: '개역한글판' }));
    expect(within(newCard).getByRole('link', { name: /새번역/ })).toHaveAttribute(
      'href', bibleSocietyPassageUrl({ bookId: 'MAT', chapter: 1, verse: 1 }, 'SAENEW'),
    );
    expect(screen.getByRole('heading', { name: '다른 QT 교재의 오늘 본문' })).toBeInTheDocument();
  });

  it('explains the current fixed content and planned uniform selection on focus or tap', async () => {
    const user = userEvent.setup();
    renderWithLang(<DailyWordSection date="2026-09-26" content={TEST_ONLY_NOT_SCRIPTURE} status="ready" now={TODAY} />);
    const trigger = screen.getByRole('button', { name: '말씀 선정 방식' });
    const floatingHelp = trigger.closest('aside');
    expect(floatingHelp?.parentElement).toBe(document.body);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{ArrowRight}');
    expect(floatingHelp).toHaveStyle({ left: '12px' });
    expect(screen.getByText(/현재는 날짜별로 미리 검토한 말씀/)).toHaveTextContent('1/1,000');
    expect(screen.getByText(/현재는 날짜별로 미리 검토한 말씀/)).toHaveTextContent('1/2,000');
    expect(screen.getByText(/현재는 날짜별로 미리 검토한 말씀/)).toHaveTextContent('아직 적용되지 않았습니다');
  });

  it('preserves the source language when the UI language is English and has no accessibility violations', async () => {
    const { container } = renderWithLang(
      <DailyWordSection date="2026-09-26" content={TEST_ONLY_NOT_SCRIPTURE} status="ready" now={TODAY} />,
      'en',
    );
    expect(screen.getAllByText('[TEST ONLY — NOT SCRIPTURE]')[0]).toHaveAttribute('lang', 'ko');
    expect(await axeViolations(container)).toEqual([]);
  });

  it('keeps links to the other QT guides’ today passages when today content is missing', () => {
    renderWithLang(<DailyWordSection date="2026-09-26" content={null} status="unavailable" now={TODAY} />);
    expect(screen.getByRole('status')).toHaveTextContent('오늘 표시할 말씀 자료가 아직 준비되지 않았습니다');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /매일성경/ })).toHaveAttribute('href', 'https://sum.su.or.kr:8888/bible/today');
    expect(screen.getByRole('link', { name: /생명의삶/ })).toHaveAttribute('href', 'https://www.duranno.com/qt/view/bible.asp?qtDate=2026-09-26');
    expect(screen.getByRole('link', { name: /날마다 솟는 샘물/ })).toHaveAttribute('href', 'https://www.godpia.com/qt/qt.asp');
  });

  it('shows an inline error and retries without removing direct provider links', async () => {
    const retry = vi.fn();
    renderWithLang(<DailyWordSection date="2026-09-26" content={null} status="error" now={TODAY} onRetry={retry} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('오늘의 말씀을 불러오지 못했습니다');
    await userEvent.click(within(alert).getByRole('button', { name: '다시 시도' }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.getByRole('link', { name: /매일성경/ })).toBeInTheDocument();
  });

  it('provides English labels without inventing an English Scripture translation', () => {
    renderWithLang(<DailyWordSection date="2026-09-26" content={null} status="unavailable" now={TODAY} />, 'en');
    expect(screen.getByRole('heading', { name: /Today's Word/ })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent("Today's Scripture content is not available yet");
  });
});

describe('대한성서공회 구절 링크', () => {
  it('번역본·책·장·절을 대한성서공회 URL 매개변수에 넣는다', () => {
    const url = new URL(bibleSocietyPassageUrl({ bookId: 'PSA', chapter: 23, verse: 1 }, 'GAE'));
    expect(url.origin).toBe('https://www.bskorea.or.kr');
    expect(url.pathname).toBe('/bible/korbibReadpage.php');
    expect(url.searchParams.get('version')).toBe('GAE');
    expect(url.searchParams.get('book')).toBe('psa');
    expect(url.searchParams.get('chap')).toBe('23');
    expect(url.searchParams.get('sec')).toBe('1');
  });
});
