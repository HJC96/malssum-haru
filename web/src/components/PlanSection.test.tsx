import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { computePlan, SAMPLE_BIBLE } from '@/domain';
import { App } from '@/app/App';
import { sampleInput } from '@/app/test/plan';
import { scenario } from '@/app/test/render';
import { closePlanTools, fillRange, LOCAL_NOON, LOCAL_TODAY, openPlanTools, renderPlan, setDate, stat } from '@/app/test/planUi';

const readGroup = () => screen.getByRole('group', { name: '현재 읽은 분량' });
const openProgressEditor = async () => userEvent.click(screen.getByText(/읽은 범위 (입력|수정)/, { selector: 'summary' }));
const openAdvancedSettings = async () => {
  await userEvent.click(screen.getByText('제외일·계획 이름', { selector: 'summary' }));
};
const chooseCustomWeekdays = async () => {
  await userEvent.click(screen.getByText('빠른 요일 선택', { selector: 'summary' }));
  await userEvent.click(screen.getByRole('button', { name: '요일 직접 선택' }));
};
const openDurationPresets = async () => userEvent.click(screen.getByText('시작일·빠른 기간 설정', { selector: 'summary' }));

describe('계획 입력과 결과 (AC03~AC06)', () => {
  it('범위·기간·요일을 한 화면에서 조정하고 결과로 이동한다', async () => {
    renderPlan();
    expect(screen.getByRole('group', { name: '무엇을 읽을까요?' })).toBeInTheDocument();
    expect(screen.getByLabelText('마감일')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '읽는 요일' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: '구약' }));
    expect(screen.getByRole('radio', { name: '구약' })).toBeChecked();
    await openDurationPresets();
    await userEvent.click(screen.getByRole('button', { name: '90일' }));
    expect(screen.getByRole('button', { name: '90일' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByText('빠른 요일 선택', { selector: 'summary' }));
    await userEvent.click(screen.getByRole('button', { name: '주 5일' }));
    expect(within(screen.getByRole('group', { name: '읽는 요일' })).getByRole('checkbox', { name: '일' })).not.toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: '계획 미리보기' }));
    expect(screen.getByRole('region', { name: '계획 결과' })).toHaveAttribute('data-mobile-active', 'true');
  });

  it('책을 직접 고를 때는 여러 권을 체크할 수 있다', async () => {
    renderPlan();
    await userEvent.click(screen.getByRole('radio', { name: '선택한 책' }));
    expect(screen.getByRole('alert')).toHaveTextContent('책을 선택해 주세요');
    await userEvent.click(within(screen.getByRole('group', { name: '책 선택' })).getByRole('checkbox', { name: '창세기' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('마감일')).toBeInTheDocument();
  });

  it('빠른 설정은 기본값으로 미리보기를 제공하고 기간 프리셋을 적용한다', async () => {
    renderPlan();
    await openDurationPresets();
    expect(screen.getByRole('button', { name: '30일' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/총 167절 · 읽는 날 30일/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '1년' }));
    await userEvent.click(screen.getByRole('button', { name: '직접 날짜' }));
    expect(screen.getByLabelText('마감일')).toHaveValue('2027-09-23');
    await userEvent.click(screen.getByRole('button', { name: '계획 미리보기' }));
    expect(screen.getByRole('region', { name: '계획 결과' })).toHaveAttribute('data-mobile-active', 'true');
  });

  it('읽는 요일 프리셋과 직접 선택이 계산에 반영된다', async () => {
    const { container } = renderPlan();
    await userEvent.click(screen.getByText('빠른 요일 선택', { selector: 'summary' }));
    await userEvent.click(screen.getByRole('button', { name: '주 5일' }));
    expect(stat(container, 'plan.summary.readingDays')).toBe('22');
    await userEvent.click(screen.getByRole('button', { name: '요일 직접 선택' }));
    const weekdays = screen.getByRole('group', { name: '읽는 요일' });
    expect(within(weekdays).getByRole('checkbox', { name: '일' })).not.toBeChecked();
  });

  it('기본 화면: 샘플 데이터 배너, 요약 숫자, 오늘 목표는 미입력', () => {
    const { container } = renderPlan();
    expect(screen.getByRole('note')).toHaveTextContent('샘플 데이터');
    expect(stat(container, 'plan.summary.targetVerses')).toBe('167절');
    expect(stat(container, 'plan.summary.targetChapters')).toBe('15장');
    expect(stat(container, 'plan.summary.progress')).toBe('0%');
    expect(stat(container, 'plan.summary.readingDays')).toBe('30');
    expect(stat(container, 'plan.summary.todayAchievement')).toBe('미입력');
    expect(screen.getByRole('img', { name: /읽은 절 0 \/ 전체 167/ })).toBeInTheDocument();
  });

  it('요약 숫자가 domain 계산과 같다', () => {
    const { container } = renderPlan();
    const out = computePlan(sampleInput({ startDate: LOCAL_TODAY, endDate: '2026-10-23', distribution: 'chapters' }));
    if (!out.ok) throw new Error('fail');
    const s = out.result.summary;
    expect(stat(container, 'plan.summary.remainingVerses')).toBe(`${s.remainingVerses}절`);
    expect(stat(container, 'plan.summary.assignedDays')).toBe(String(s.assignedDays));
  });

  it('시작일이 마감일보다 늦으면 이유를 알리고 결과를 숨긴다 (AC04)', () => {
    renderPlan();
    setDate('마감일', '2026-09-01');
    expect(screen.getByRole('alert')).toHaveTextContent('시작일이 마감일보다 늦습니다');
    expect(screen.queryByRole('region', { name: '계획 결과' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Excel/ })).not.toBeInTheDocument();
    setDate('마감일', '2026-10-23');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: '계획 결과' })).toBeInTheDocument();
  });

  it('날짜를 비우거나 없는 날짜면 안내한다', () => {
    renderPlan();
    setDate('시작일', '');
    expect(screen.getByRole('alert')).toHaveTextContent('실제 날짜로 입력');
  });

  it('읽는 요일을 모두 끄면 읽기 날짜 0개 오류 (AC04)', async () => {
    renderPlan();
    await chooseCustomWeekdays();
    const days = screen.getByRole('group', { name: '읽는 요일' });
    for (const cb of within(days).getAllByRole('checkbox')) await userEvent.click(cb);
    expect(screen.getByRole('alert')).toHaveTextContent('읽는 날이 하나도 없습니다');
  });

  it('요일과 제외일이 읽기 날짜 수에 반영된다 (AC03)', async () => {
    const { container } = renderPlan({ initialForm: { startDate: '2026-10-01', endDate: '2026-10-31' } });
    expect(stat(container, 'plan.summary.readingDays')).toBe('31');
    await chooseCustomWeekdays();
    const days = screen.getByRole('group', { name: '읽는 요일' });
    await userEvent.click(within(days).getByRole('checkbox', { name: '토' }));
    await userEvent.click(within(days).getByRole('checkbox', { name: '일' }));
    expect(stat(container, 'plan.summary.readingDays')).toBe('22'); // 2026-10: 토 5 + 일 4 제외
    await openAdvancedSettings();
    fireEvent.change(screen.getByLabelText('제외할 날짜'), { target: { value: '2026-10-05' } });
    await userEvent.click(screen.getByRole('button', { name: '제외일 추가' }));
    expect(stat(container, 'plan.summary.readingDays')).toBe('21');
    await userEvent.click(screen.getByRole('button', { name: '2026-10-05 제외일 삭제' }));
    expect(stat(container, 'plan.summary.readingDays')).toBe('22');
  });

  it('선택한 책: 책이 없으면 오류, 순서를 바꾸면 그 순서로 배정된다', async () => {
    renderPlan({ initialForm: { startDate: '2026-10-01', endDate: '2026-10-31' } });
    await userEvent.click(screen.getByRole('radio', { name: '선택한 책' }));
    expect(screen.getByRole('alert')).toHaveTextContent('책을 선택해 주세요');
    const pick = screen.getByRole('group', { name: '책 선택' });
    await userEvent.click(within(pick).getByRole('checkbox', { name: '창세기' }));
    await userEvent.click(within(pick).getByRole('checkbox', { name: '마태복음' }));
    const firstRow = () => document.querySelector('tr.day-row--assigned .day-row__range')?.textContent ?? '';
    expect(firstRow()).toContain('창세기');
    const reorderHandle = screen.getByRole('button', { name: '마태복음 순서 변경' });
    reorderHandle.focus();
    fireEvent.keyDown(reorderHandle, { key: ' ', code: 'Space' });
    fireEvent.keyDown(reorderHandle, { key: 'ArrowUp', code: 'ArrowUp' });
    fireEvent.keyDown(reorderHandle, { key: ' ', code: 'Space' });
    expect(firstRow()).toContain('마태복음');
    await userEvent.click(screen.getByRole('button', { name: '마태복음 제거' }));
    expect(screen.queryByText(/마태복음/, { selector: '.day-row__range' })).not.toBeInTheDocument();
  });

  it('배분 방식을 바꾸면 분량 설명도 바뀐다', async () => {
    renderPlan();
    await userEvent.click(screen.getByRole('radio', { name: '절 단위 계획' }));
    expect(screen.getByText(/한 장을 여러 날에 걸쳐 읽을 수 있습니다/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /장 단위 계획/ }));
    expect(screen.getByText(/장마다 실제 분량은 다를 수 있습니다/)).toBeInTheDocument();
  });

  it('장보다 읽기 날짜가 많으면 빈 날을 미완료가 아닌 "배정 없음"으로 표시한다 (AC06)', async () => {
    renderPlan();
    await userEvent.click(screen.getByRole('radio', { name: /장 단위 계획/ }));
    const empties = document.querySelectorAll('tr.day-row--empty');
    expect(empties.length).toBeGreaterThan(0);
    for (const tr of empties) {
      expect(tr).toHaveTextContent('배정 없음');
      expect(tr.textContent).not.toMatch(/미완료|완료|못 읽/);
    }
  });
});

describe('현재 읽은 분량: 연속·개별 범위 (AC23, AC26)', () => {
  it('진도 초안을 반영하기 전에는 요약과 날짜별 배정이 바뀌지 않는다', async () => {
    const { container } = renderPlan();
    const beforeRead = stat(container, 'plan.summary.readVerses');
    const beforeRange = document.querySelector('tr.day-row--assigned .day-row__range')?.textContent;
    await openProgressEditor();
    await userEvent.click(screen.getByRole('radio', { name: /처음부터 어디까지/ }));
    const through = screen.getByRole('group', { name: '마지막으로 읽은 곳' });
    fireEvent.change(within(through).getByLabelText('책'), { target: { value: 'GEN' } });
    fireEvent.change(within(through).getByLabelText('장'), { target: { value: '2' } });
    fireEvent.change(within(through).getByLabelText('절'), { target: { value: '3' } });
    expect(stat(container, 'plan.summary.readVerses')).toBe(beforeRead);
    expect(document.querySelector('tr.day-row--assigned .day-row__range')?.textContent).toBe(beforeRange);
    await userEvent.click(screen.getByRole('button', { name: '진도 반영' }));
    expect(stat(container, 'plan.summary.readVerses')).toBe('15절');
    expect(document.querySelector('tr.day-row--assigned .day-row__range')?.textContent).toBe(beforeRange);
  });

  it('연속 입력: 마지막으로 읽은 곳까지를 읽은 절로 센다', async () => {
    const { container } = renderPlan();
    await openProgressEditor();
    await userEvent.click(screen.getByRole('radio', { name: /처음부터 어디까지/ }));
    fillRange(screen.getByRole('group', { name: '마지막으로 읽은 곳' }), { book: 'GEN' });
    await userEvent.click(screen.getByRole('button', { name: '진도 반영' }));
    expect(screen.getByRole('alert')).toHaveTextContent('책·장·절을 모두 채우거나');
    const through = screen.getByRole('group', { name: '마지막으로 읽은 곳' });
    fireEvent.change(within(through).getByLabelText('장'), { target: { value: '2' } });
    fireEvent.change(within(through).getByLabelText('절'), { target: { value: '3' } });
    await userEvent.click(screen.getByRole('button', { name: '진도 반영' }));
    expect(stat(container, 'plan.summary.readVerses')).toBe('15절'); // 12 + 3
    expect(stat(container, 'plan.summary.remainingVerses')).toBe('152절');
  });

  it('개별 범위: 겹치는 범위는 한 번만 센다', async () => {
    const { container } = renderPlan();
    await openProgressEditor();
    await userEvent.click(screen.getByRole('radio', { name: /건너뛰어 읽었습니다/ }));
    fillRange(within(readGroup()).getByRole('group', { name: '범위 1' }), { book: 'GEN', sc: '1', sv: '1', ec: '1', ev: '8' });
    await userEvent.click(within(readGroup()).getByRole('button', { name: '범위 추가' }));
    fillRange(within(readGroup()).getByRole('group', { name: '범위 2' }), { book: 'GEN', sc: '1', sv: '5', ec: '2', ev: '2' });
    await userEvent.click(screen.getByRole('button', { name: '진도 반영' }));
    expect(stat(container, 'plan.summary.readVerses')).toBe('14절');
    await userEvent.click(within(readGroup()).getByRole('button', { name: '범위 2 삭제' }));
    await userEvent.click(screen.getByRole('button', { name: '진도 반영' }));
    expect(stat(container, 'plan.summary.readVerses')).toBe('8절');
  });

  it('목표 밖·없는 장절·채우다 만 행·정수가 아닌 값을 알린다', async () => {
    renderPlan();
    await openProgressEditor();
    await userEvent.click(screen.getByRole('radio', { name: /건너뛰어 읽었습니다/ }));
    const row = () => within(readGroup()).getByRole('group', { name: '범위 1' });
    fillRange(row(), { book: 'GEN', sc: '1', sv: '1', ec: '99', ev: '1' });
    await userEvent.click(screen.getByRole('button', { name: '진도 반영' }));
    expect(screen.getByRole('alert')).toHaveTextContent('없는 장·절');
    fillRange(row(), { ec: 'x' });
    await userEvent.click(screen.getByRole('button', { name: '진도 반영' }));
    expect(screen.getByRole('alert')).toHaveTextContent('정수로 입력');
    fillRange(row(), { ec: '' });
    await userEvent.click(screen.getByRole('button', { name: '진도 반영' }));
    expect(screen.getByRole('alert')).toHaveTextContent('모두 채우거나');
    // 목표를 창세기로 좁히면 마태복음 범위는 목표 밖이다
    closePlanTools();
    await userEvent.click(screen.getByRole('radio', { name: '선택한 책' }));
    await userEvent.click(within(screen.getByRole('group', { name: '책 선택' })).getByRole('checkbox', { name: '창세기' }));
    openPlanTools();
    fillRange(row(), { book: 'MAT', sc: '1', sv: '1', ec: '1', ev: '2' });
    await userEvent.click(screen.getByRole('button', { name: '진도 반영' }));
    expect(screen.getByRole('alert')).toHaveTextContent('목표 범위 밖');
  });

  it('오류 문구에 어느 입력의 문제인지 붙는다', async () => {
    renderPlan();
    await openProgressEditor();
    await userEvent.click(screen.getByRole('radio', { name: /건너뛰어 읽었습니다/ }));
    fillRange(within(readGroup()).getByRole('group', { name: '범위 1' }), { book: 'GEN', sc: '1', sv: '1', ec: '99', ev: '1' });
    await userEvent.click(screen.getByRole('button', { name: '진도 반영' }));
    expect(within(screen.getByRole('alert')).getByText(/현재 읽은 분량/)).toBeInTheDocument();
  });
});

describe('오늘 목표 달성률 (AC24)', () => {
  it('입력하지 않으면 미입력, 입력하면 비율로 표시한다. 0으로 나누지 않는다', async () => {
    const { container } = renderPlan();
    await openProgressEditor();
    expect(stat(container, 'plan.summary.todayAchievement')).toBe('미입력');
    await userEvent.click(within(screen.getByRole('group', { name: '오늘 읽은 범위 (선택)' })).getByRole('button', { name: '범위 추가' }));
    const g = screen.getByRole('group', { name: '오늘 읽은 범위 (선택)' });
    fillRange(within(g).getByRole('group', { name: '범위 1' }), { book: 'GEN', sc: '1', sv: '1', ec: '1', ev: '6' });
    await userEvent.click(screen.getByRole('button', { name: '진도 반영' }));
    expect(stat(container, 'plan.summary.todayAchievement')).toMatch(/^\d+(\.\d)?%$/);
    await openProgressEditor();
    await userEvent.click(within(g).getByRole('button', { name: '범위 1 삭제' }));
    await userEvent.click(screen.getByRole('button', { name: '진도 반영' }));
    expect(stat(container, 'plan.summary.todayAchievement')).toBe('미입력');
  });

  it('오늘 배정이 없는 날(쉬는 요일)은 오늘 목표 없음이고 달성률은 해당 없음', async () => {
    const { container } = renderPlan();
    await openProgressEditor();
    await chooseCustomWeekdays();
    await userEvent.click(within(screen.getByRole('group', { name: '읽는 요일' })).getByRole('checkbox', { name: '목' })); // 2026-09-24는 목요일
    expect(stat(container, 'plan.summary.todayTarget')).toBe('오늘 목표 없음');
    expect(stat(container, 'plan.summary.todayAchievement')).toBe('해당 없음');
  });

  it('오늘 읽은 범위는 현재 읽은 분량에 합쳐지지 않는다(남은 절 수가 그대로)', async () => {
    const { container } = renderPlan();
    await openProgressEditor();
    const before = stat(container, 'plan.summary.remainingVerses');
    await userEvent.click(within(screen.getByRole('group', { name: '오늘 읽은 범위 (선택)' })).getByRole('button', { name: '범위 추가' }));
    fillRange(within(screen.getByRole('group', { name: '오늘 읽은 범위 (선택)' })).getByRole('group', { name: '범위 1' }), { book: 'GEN', sc: '1', sv: '1', ec: '1', ev: '6' });
    expect(stat(container, 'plan.summary.remainingVerses')).toBe(before);
  });
});

describe('재계산 (AC08)', () => {
  it('오늘 기준 재계산이면 최초 계획과 구분해 표시하고 비교표를 보인다', async () => {
    const { container } = renderPlan({ initialForm: { startDate: '2026-09-10', endDate: '2026-10-23' } });
    expect(screen.getByText('최초 계획입니다.')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: '최초 계획과 비교' })).not.toBeInTheDocument();
    await openProgressEditor();
    await userEvent.click(within(readGroup()).getByRole('radio', { name: /처음 시작/ }));
    await userEvent.click(screen.getByRole('button', { name: '진도 반영' }));
    await userEvent.click(screen.getByRole('button', { name: '남은 분량으로 일정 조정' }));
    await userEvent.click(screen.getByRole('button', { name: '이 일정으로 적용' }));
    expect(screen.getByText(/2026-09-24부터 남은 읽기 날짜에/)).toBeInTheDocument();
    await userEvent.click(screen.getByText('상세 통계 보기', { selector: 'summary' }));
    expect(screen.getByRole('table', { name: '최초 계획과 비교' })).toBeInTheDocument();
    // 오늘 이전 날짜는 완료로 추정하지 않고 상태만 표시한다
    const elapsed = document.querySelectorAll('tr.day-row--elapsed');
    expect(elapsed).toHaveLength(14); // 2026-09-10 ~ 09-23
    for (const tr of elapsed) expect(tr).toHaveTextContent('재계산 이전 날짜');
    expect(container.textContent).not.toMatch(/읽음 처리|완료됨/);
  });

  it('남은 읽기 날짜가 없는데 미독이 있으면 마감일 변경을 안내한다', async () => {
    renderPlan({ initialForm: { startDate: '2026-09-01', endDate: '2026-09-20' } });
    await userEvent.click(screen.getByRole('button', { name: '남은 분량으로 일정 조정' }));
    expect(screen.getByRole('alert')).toHaveTextContent('마감일을 조정해 주세요');
  });

  it('조건을 바꾸면 그 자리에서 다시 계산한다', () => {
    const { container } = renderPlan();
    const before = stat(container, 'plan.summary.assignedDays');
    setDate('마감일', '2026-09-30');
    expect(stat(container, 'plan.summary.readingDays')).toBe('7');
    expect(stat(container, 'plan.summary.assignedDays')).not.toBe(before);
  });
});

describe('성경 읽기 계획 상태 보존', () => {
  it('오늘의 QT와 오가도 입력값과 계산 결과와 날짜별 배정이 그대로다', async () => {
    const { container } = render(
      <App
        initialLang="ko"
        initialService="plan"
        now={LOCAL_NOON}
        planBible={SAMPLE_BIBLE}
        qtFetcher={async () => scenario('mixed')}
        planInitial={{ endDate: '2026-10-23', readMode: 'continuous', through: { bookId: 'GEN', chapter: '2', verse: '3' }, weekdays: [1, 2, 3, 4, 5] }}
      />,
    );
    await userEvent.click(screen.getByRole('tab', { name: '성경 읽기 계획' }));
    setDate('시작일', '2026-09-25');
    const numbers = () =>
      ['targetVerses', 'readVerses', 'remainingVerses', 'readingDays', 'assignedDays'].map((k) => stat(container, `plan.summary.${k}`).replace(/\D+/g, ''));
    const rows = () =>
      [...document.querySelectorAll('tr.day-row')].map((tr) => [tr.getAttribute('data-date'), tr.className, tr.querySelector('.day-row__num')?.textContent?.replace(/\D+/g, '')]);
    const before = { numbers: numbers(), rows: rows() };
    expect(before.numbers[1]).toBe('15');

    await userEvent.click(screen.getByRole('tab', { name: '오늘의 QT' }));
    await userEvent.click(screen.getByRole('tab', { name: '성경 읽기 계획' }));

    expect(screen.getByLabelText('시작일')).toHaveValue('2026-09-25');
    expect(numbers()).toEqual(before.numbers);
    expect(rows()).toEqual(before.rows);
    expect(stat(container, 'plan.summary.readVerses')).toBe('15절');
  });
});
