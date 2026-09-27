import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LOCAL_TODAY, renderPlan } from '@/app/test/planUi';

const listRows = () =>
  new Map(
    [...document.querySelectorAll('tr.day-row')].map((tr) => [
      tr.getAttribute('data-date') as string,
      tr.querySelector('.day-row__range')?.firstChild?.textContent?.trim() ?? '',
    ]),
  );

async function openCalendar() {
  await userEvent.click(screen.getByRole('button', { name: '월간 캘린더' }));
}

describe('캘린더와 목록 (CAL01, AC10)', () => {
  it('두 보기는 같은 외곽 프레임 안에서 유지되고 비활성 보기는 숨긴다', async () => {
    renderPlan();
    const frame = document.querySelector('.plan-view-frame')!;
    const panes = [...frame.querySelectorAll('.plan-view-frame__scroll')];
    expect(panes).toHaveLength(2);
    expect(panes[0]).toHaveAttribute('hidden');
    expect(panes[1]).not.toHaveAttribute('hidden');
    await userEvent.click(screen.getByRole('button', { name: '날짜별 목록' }));
    expect(panes[0]).not.toHaveAttribute('hidden');
    expect(panes[1]).toHaveAttribute('hidden');
    await openCalendar();
    expect(panes[0]).toHaveAttribute('hidden');
    expect(panes[1]).not.toHaveAttribute('hidden');
    expect(frame).toContainElement(document.querySelector('.calendar'));
    expect(frame).toContainElement(document.querySelector('.day-list'));
  });

  it('두 보기가 같은 날짜별 범위를 보여 준다', async () => {
    renderPlan({ initialForm: { startDate: '2026-09-20', endDate: '2026-10-23', weekdays: [1, 2, 3, 4, 5] } });
    const list = listRows();
    await openCalendar();
    let compared = 0;
    for (const [date, text] of list) {
      if (!date.startsWith('2026-09')) continue;
      const btn = screen.getByRole('button', { name: new RegExp(`^${date} `) });
      expect(btn.getAttribute('aria-label')).toContain(text);
      compared += 1;
    }
    expect(compared).toBe(11); // 09-20 ~ 09-30
    await userEvent.click(screen.getByRole('button', { name: '다음 달' }));
    const oct = [...listRows()].filter(([d]) => d.startsWith('2026-10'));
    for (const [date, text] of oct) {
      expect(screen.getByRole('button', { name: new RegExp(`^${date} `) }).getAttribute('aria-label')).toContain(text);
    }
  });

  it('처음에는 오늘이 속한 달이 열리고 이전 달, 다음 달, 오늘로 이동한다', async () => {
    renderPlan({ initialForm: { startDate: '2026-09-01', endDate: '2026-11-30' } });
    await openCalendar();
    expect(screen.getByRole('heading', { level: 4, name: /2026년 9월/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '다음 달' }));
    expect(screen.getByRole('heading', { level: 4, name: /2026년 10월/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '이전 달' }));
    await userEvent.click(screen.getByRole('button', { name: '이전 달' }));
    expect(screen.getByRole('heading', { level: 4, name: /2026년 8월/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '오늘' }));
    expect(screen.getByRole('heading', { level: 4, name: /2026년 9월/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: new RegExp(`^${LOCAL_TODAY} `) })).toHaveAttribute('aria-current', 'date');
  });

  it('날짜를 선택하면 배정 범위가 표시된다', async () => {
    renderPlan();
    await openCalendar();
    expect(screen.getByText('날짜를 선택하면 배정 범위가 여기에 표시됩니다.')).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: /^2026-09-25 / });
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    const detail = screen.getByText('선택한 날짜').closest('div') as HTMLElement;
    expect(within(detail).getByText(/2026-09-25/)).toBeInTheDocument();
    expect(detail.textContent).toMatch(/\d+절/);
  });

  it('쉬는 날·경과일을 완료로 표시하지 않고 상태만 알린다', async () => {
    renderPlan({ initialForm: { startDate: '2026-09-14', endDate: '2026-10-10', weekdays: [1, 2, 3, 4, 5] } });
    await userEvent.click(screen.getByRole('button', { name: '남은 분량으로 일정 조정' }));
    await userEvent.click(screen.getByRole('button', { name: '이 일정으로 적용' }));
    await openCalendar();
    expect(screen.getByRole('button', { name: /^2026-09-26 .*쉬는 날/ })).toBeInTheDocument(); // 토
    expect(screen.getByRole('button', { name: /^2026-09-16 .*재계산 이전 날짜/ })).toBeInTheDocument();
    const calendar = document.querySelector('.calendar')!;
    expect(calendar.textContent).not.toMatch(/미완료|완료됨|읽음/);
  });

  it('주 시작 요일을 바꾸면 머리글 순서가 바뀐다', async () => {
    renderPlan();
    await openCalendar();
    const heads = () => within(screen.getByRole('table', { name: /읽기 계획/ })).getAllByRole('columnheader').map((h) => h.textContent);
    expect(heads()[0]).toBe('일');
    await userEvent.selectOptions(screen.getByLabelText('주 시작 요일'), '1');
    expect(heads()[0]).toBe('월');
    expect(heads()[6]).toBe('일');
  });

  it('계획 기간 밖의 날짜는 선택할 수 없다', async () => {
    renderPlan({ initialForm: { startDate: '2026-09-24', endDate: '2026-10-23' } });
    await openCalendar();
    expect(screen.queryByRole('button', { name: /^2026-09-10 / })).not.toBeInTheDocument();
    expect(screen.getAllByTitle('계획 기간 밖').length).toBeGreaterThan(0);
  });

  it('영어 화면에서 월 이름과 요일 머리글이 영어다', async () => {
    renderPlan({ lang: 'en' });
    await userEvent.click(screen.getByRole('button', { name: 'Monthly calendar' }));
    expect(screen.getByRole('heading', { level: 4, name: /September 2026/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Sun' })).toBeInTheDocument();
  });
});
