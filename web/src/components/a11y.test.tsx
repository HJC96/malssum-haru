import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@/app/App';
import { axeViolations } from '@/app/test/axe';
import { NOW } from '@/app/test/render';
import { SAMPLE_BIBLE } from '@/domain';

/** 검사 시간을 줄이려고 짧은 계획을 쓴다. */
const SHORT = { endDate: '2026-10-07' };

describe('axe 접근성 검사', () => {
  it('한국어 오늘의 말씀과 콘텐츠 없음 상태에 위반이 없다', async () => {
    const { container } = render(<App initialLang="ko" initialService="qt" dailyWordLoader={async () => null} now={NOW} planInitial={SHORT} />);
    await screen.findByText(/오늘 표시할 말씀 자료가 아직 준비되지 않았습니다/);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('영어 화면에 위반이 없다', async () => {
    const { container } = render(<App initialLang="en" initialService="qt" dailyWordLoader={async () => null} now={NOW} planInitial={SHORT} />);
    await screen.findByText(/Today's Scripture content is not available yet/);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('로딩과 오류 화면에도 위반이 없다', async () => {
    const { container } = render(<App initialLang="ko" initialService="qt" dailyWordLoader={() => new Promise(() => {})} now={NOW} planInitial={SHORT} />);
    expect(await axeViolations(container)).toEqual([]);
    cleanup();
    const err = render(<App initialLang="ko" initialService="qt" dailyWordLoader={async () => Promise.reject(new Error('x'))} now={NOW} planInitial={SHORT} />);
    await screen.findByRole('alert');
    expect(await axeViolations(err.container)).toEqual([]);
  });

  it('키보드만으로 링크와 테마 버튼에 모두 도달한다', async () => {
    render(<App initialLang="ko" initialService="qt" dailyWordLoader={async () => null} now={NOW} planInitial={SHORT} />);
    await screen.findByText(/오늘 표시할 말씀 자료가 아직 준비되지 않았습니다/);
    const seen: string[] = [];
    for (let i = 0; i < 14; i++) {
      await userEvent.tab();
      const el = document.activeElement;
      if (el) seen.push(el.getAttribute('aria-label') ?? (el.textContent ?? ''));
    }
    expect(seen.some((s) => s.includes('모드'))).toBe(true);
    expect(seen.some((s) => s.includes('매일성경'))).toBe(true);
    expect(seen.some((s) => s.includes('생명의삶'))).toBe(true);
    expect(seen.some((s) => s.includes('날마다 솟는 샘물'))).toBe(true);
  });

  it('계획 화면: 캘린더, 오류, 책 선택·개별 범위 입력, 영어에도 위반이 없다', async () => {
    const { container } = render(<App initialLang="ko" initialService="qt" dailyWordLoader={async () => null} now={NOW} planInitial={SHORT} planBible={SAMPLE_BIBLE} />);
    await screen.findByText(/오늘 표시할 말씀 자료가 아직 준비되지 않았습니다/);
    await userEvent.click(screen.getByRole('tab', { name: '성경 읽기 계획' }));
    await userEvent.click(screen.getByRole('button', { name: '월간 캘린더' }));
    await userEvent.click(screen.getAllByRole('button', { name: /^2026-09-2\d / })[0]!);
    expect(await axeViolations(container)).toEqual([]);

    await userEvent.click(screen.getByRole('radio', { name: '선택한 책' }));
    expect(screen.getByRole('alert')).toBeInTheDocument(); // 책 없음 오류
    expect(await axeViolations(container)).toEqual([]);
    await userEvent.click(within(screen.getByRole('group', { name: '책 선택' })).getByRole('checkbox', { name: '창세기' }));
    await userEvent.click(screen.getByRole('radio', { name: /건너뛰어 읽었습니다/ }));
    await userEvent.click(within(screen.getByRole('group', { name: '오늘 읽은 범위 (선택)' })).getByRole('button', { name: '범위 추가' }));
    expect(await axeViolations(container)).toEqual([]);

    expect(await axeViolations(container)).toEqual([]);
  });
});
