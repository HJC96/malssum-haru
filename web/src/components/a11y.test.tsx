import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@/app/App';
import { axeViolations } from '@/app/test/axe';
import { NOW, scenario } from '@/app/test/render';
import type { QtMockScenario } from '@/app/qt/fixtures';

/** 검사 시간을 줄이려고 짧은 계획을 쓴다. */
const SHORT = { endDate: '2026-10-07' };

const SCENARIOS: QtMockScenario[] = ['mixed', 'confirmed', 'unavailable', 'not-permitted', 'link-error', 'disabled'];

describe('axe 접근성 검사', () => {
  for (const name of SCENARIOS) {
    it(`한국어 화면(${name})에 위반이 없다`, async () => {
      const { container } = render(<App initialLang="ko" qtFetcher={async () => scenario(name)} now={NOW} planInitial={SHORT} />);
      await screen.findAllByRole('article');
      expect(await axeViolations(container)).toEqual([]);
    });
  }

  it('영어 화면에 위반이 없다', async () => {
    const { container } = render(<App initialLang="en" qtFetcher={async () => scenario('mixed')} now={NOW} planInitial={SHORT} />);
    await screen.findAllByRole('article');
    expect(await axeViolations(container)).toEqual([]);
  });

  it('로딩과 오류 화면에도 위반이 없다', async () => {
    const { container } = render(<App initialLang="ko" qtFetcher={() => new Promise(() => {})} now={NOW} planInitial={SHORT} />);
    expect(await axeViolations(container)).toEqual([]);
    cleanup();
    const err = render(<App initialLang="ko" qtFetcher={async () => Promise.reject(new Error('x'))} now={NOW} planInitial={SHORT} />);
    await screen.findByRole('alert');
    expect(await axeViolations(err.container)).toEqual([]);
  });

  it('키보드만으로 링크와 언어 버튼에 모두 도달한다', async () => {
    render(<App initialLang="ko" qtFetcher={async () => scenario('mixed')} now={NOW} planInitial={SHORT} />);
    await screen.findAllByRole('article');
    const seen: string[] = [];
    for (let i = 0; i < 5; i++) {
      await userEvent.tab();
      const el = document.activeElement;
      if (el) seen.push(el.getAttribute('aria-pressed') ? `lang:${el.textContent}` : (el.textContent ?? ''));
    }
    expect(seen.some((s) => s === 'lang:English')).toBe(true);
    expect(seen.filter((s) => s.includes('공식 페이지로 이동'))).toHaveLength(2);
  });
});
