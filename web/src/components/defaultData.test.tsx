import { render, screen } from '@testing-library/react';
import { App } from '@/app/App';
import { LOCAL_NOON, openPlanTools, setDate, stat } from '@/app/test/planUi';
import { scenario } from '@/app/test/render';
import userEvent from '@testing-library/user-event';

const qtFetcher = async () => scenario('mixed');

describe('앱 기본 성경 읽기 계획(장 단위 66권)', () => {
  it('장 단위 계획을 기본으로 보여 주고 잠정 절 수 경고는 표시하지 않는다', async () => {
    render(<App initialLang="ko" initialService="plan" now={LOCAL_NOON} qtFetcher={qtFetcher} />);
    await userEvent.click(screen.getByRole('tab', { name: '성경 읽기 계획' }));
    expect(screen.getByRole('radio', { name: /장 단위 계획/ })).toBeChecked();
    expect(screen.queryByText(/절 단위 계획은 공개 영어 성경의 장절표/)).not.toBeInTheDocument();
    expect(screen.queryByText(/샘플 데이터로 계산/)).not.toBeInTheDocument();
  });

  it('절 단위 계획을 선택하면 한계와 이유를 한국어와 영어로 보여 준다', async () => {
    const ko = render(<App initialLang="ko" initialService="plan" now={LOCAL_NOON} qtFetcher={qtFetcher} />);
    await userEvent.click(screen.getByRole('tab', { name: '성경 읽기 계획' }));
    const verseRadio = screen.getByRole('radio', { name: '절 단위 계획' });
    const limit = screen.getByText(/번역본마다 일부 절을 구분하는 방식이 달라/, { selector: '.plan-distribution__tooltip' });
    expect(verseRadio).toHaveAttribute('aria-describedby', limit.id);
    await userEvent.click(verseRadio);
    expect(screen.getByText(/절 단위 계획은 공개 영어 성경의 장절표/)).toHaveClass('plan-banner--provisional');
    ko.unmount();

    render(<App initialLang="en" initialService="plan" now={LOCAL_NOON} qtFetcher={qtFetcher} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Bible reading plan' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Verse-based plan' }));
    expect(screen.getByText(/Verse-based plans use a public English versification table/)).toHaveClass('plan-banner--provisional');
  });

  it('66권 전체 1년 계획: 1,189장만 계산·표시', async () => {
    const t0 = performance.now();
    const { container } = render(<App initialLang="ko" initialService="plan" now={LOCAL_NOON} qtFetcher={qtFetcher} />);
    await userEvent.click(screen.getByRole('tab', { name: '성경 읽기 계획' }));
    await userEvent.click(screen.getByRole('button', { name: '계획 미리보기' }));
    openPlanTools();
    const elapsed = performance.now() - t0;
    expect(stat(container, 'plan.summary.targetChapters')).toBe('1,189장');
    expect(container.querySelector('[data-stat="plan.summary.targetVerses"]')).toBeNull();
    expect(stat(container, 'plan.summary.readingDays')).toBe('365');
    expect(elapsed).toBeLessThan(3000);
  });

  it('입력을 바꿀 때마다 다시 계산해도 빠르다(66권, 1년)', async () => {
    render(<App initialLang="ko" initialService="plan" now={LOCAL_NOON} qtFetcher={qtFetcher} />);
    await userEvent.click(screen.getByRole('tab', { name: '성경 읽기 계획' }));
    const t0 = performance.now();
    setDate('마감일', '2027-06-30');
    expect(performance.now() - t0).toBeLessThan(3000);
  });

});
