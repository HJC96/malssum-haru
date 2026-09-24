import { render, screen } from '@testing-library/react';
import { App } from '@/app/App';
import { DEFAULT_BIBLE } from '@/domain';
import { LOCAL_NOON, setDate, stat } from '@/app/test/planUi';
import { scenario } from '@/app/test/render';

const qtFetcher = async () => scenario('mixed');

describe('앱 기본 데이터(잠정 66권)', () => {
  it('잠정 데이터임을 표시하고 장절 기준·데이터 버전을 보인다', () => {
    render(<App initialLang="ko" now={LOCAL_NOON} qtFetcher={qtFetcher} />);
    expect(screen.getByRole('note')).toHaveTextContent('잠정 데이터');
    expect(screen.getByText(new RegExp(`장절 기준: ${DEFAULT_BIBLE.versificationSystem}`))).toHaveTextContent(DEFAULT_BIBLE.dataVersion);
    expect(screen.queryByText(/샘플 데이터로 계산/)).not.toBeInTheDocument();
  });

  it('영어 화면에서도 잠정 데이터 안내가 영어로 나온다', () => {
    render(<App initialLang="en" now={LOCAL_NOON} qtFetcher={qtFetcher} />);
    expect(screen.getByRole('note')).toHaveTextContent(/provisional/);
  });

  it('66권 전체 1년 계획: 1,189장·31,103절, 3초 안에 계산·표시', () => {
    const t0 = performance.now();
    const { container } = render(<App initialLang="ko" now={LOCAL_NOON} qtFetcher={qtFetcher} />);
    const elapsed = performance.now() - t0;
    expect(stat(container, 'plan.summary.targetChapters')).toBe('1,189장');
    expect(stat(container, 'plan.summary.targetVerses')).toBe('31,103절');
    expect(stat(container, 'plan.summary.readingDays')).toBe('365');
    expect(elapsed).toBeLessThan(3000);
  });

  it('입력을 바꿀 때마다 다시 계산해도 빠르다(66권, 1년)', () => {
    render(<App initialLang="ko" now={LOCAL_NOON} qtFetcher={qtFetcher} />);
    const t0 = performance.now();
    setDate('마감일', '2027-06-30');
    expect(performance.now() - t0).toBeLessThan(3000);
  });

});
