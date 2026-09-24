import { screen, within } from '@testing-library/react';
import { provider, renderWithLang, NOW, scenario } from '@/app/test/render';
import type { QtProvider } from '@/app/qt/types';
import { QtProviderCard } from './QtProviderCard';

function link(name: RegExp) {
  return screen.getByRole('link', { name });
}

describe('QtProviderCard 5개 상태 (AC11)', () => {
  it('RANGE_CONFIRMED: 제공처명·기준 날짜·한국 시간·장절·공식 링크', () => {
    renderWithLang(<QtProviderCard provider={provider('mixed', 0)} now={NOW} />);
    const card = screen.getByRole('article', { name: '매일성경' });
    expect(within(card).getByText('범위 확인됨')).toBeInTheDocument();
    expect(within(card).getByText(/2026년 9월 24일/)).toBeInTheDocument();
    expect(within(card).getByText(/한국 시간 기준/)).toBeInTheDocument();
    expect(within(card).getByText('요한복음 3:1–21')).toBeInTheDocument();
    const a = link(/매일성경 공식 페이지로 이동/);
    expect(a).toHaveAttribute('href', 'https://sum.su.or.kr:8888/bible/today');
    expect(a).toHaveAttribute('target', '_blank');
    expect(a).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('RANGE_CONFIRMED + today-page: 제공처의 오늘 페이지임을 표시한다', () => {
    renderWithLang(<QtProviderCard provider={provider('mixed', 0)} now={NOW} />);
    expect(screen.getByText(/제공처의 오늘 페이지로 연결됩니다/)).toBeInTheDocument();
  });

  it('RANGE_CONFIRMED + date-specific: 오늘 페이지 문구가 아니라 날짜 페이지 문구', () => {
    renderWithLang(<QtProviderCard provider={provider('confirmed', 1)} now={NOW} />);
    expect(screen.getByText(/제공처가 그 날짜에 게시한 페이지로 연결됩니다/)).toBeInTheDocument();
    expect(screen.getByText(/2026년 9월 24일/)).toBeInTheDocument(); // providerDate를 함께 보인다
    expect(screen.queryByText(/제공처의 오늘 페이지/)).not.toBeInTheDocument();
    expect(screen.getByText('사도행전 9:32–10:8')).toBeInTheDocument();
  });

  it('여러 장에 걸친 범위는 그대로 이어서 표시한다', () => {
    const p: QtProvider = {
      ...provider('confirmed', 0),
      passage: {
        ranges: [{ bookId: 'JHN', start: { chapter: 3, verse: 1 }, end: { chapter: 4, verse: 54 } }],
      },
    };
    renderWithLang(<QtProviderCard provider={p} now={NOW} />);
    expect(screen.getByText('요한복음 3:1–4:54')).toBeInTheDocument();
  });

  it('같은 책의 비연속 범위 여러 개를 모두 표시한다', () => {
    const p: QtProvider = {
      ...provider('confirmed', 0),
      passage: {
        ranges: [
          { bookId: 'PSA', start: { chapter: 23, verse: 1 }, end: { chapter: 23, verse: 3 } },
          { bookId: 'PSA', start: { chapter: 23, verse: 5 }, end: { chapter: 23, verse: 6 } },
        ],
      },
    };
    renderWithLang(<QtProviderCard provider={p} now={NOW} />);
    expect(screen.getByText('시편 23:1\u20133, 시편 23:5\u20136')).toBeInTheDocument();
  });

  it('RANGE_UNAVAILABLE: 범위를 추정하지 않고 상태 + 링크만', () => {
    const p = provider('mixed', 1);
    renderWithLang(<QtProviderCard provider={p} now={NOW} />);
    expect(screen.getByText('범위 확인 못함')).toBeInTheDocument();
    expect(screen.getByText(/오늘 범위를 확인하지 못했습니다/)).toBeInTheDocument();
    expect(screen.queryByText('오늘의 범위')).not.toBeInTheDocument();
    expect(screen.getByText('날짜를 확인하지 못했습니다')).toBeInTheDocument();
    expect(link(/생명의삶 공식 페이지로 이동/)).toHaveAttribute(
      'href',
      'https://www.duranno.com/qt/view/bible.asp?qtDate=2026-09-24',
    );
    expect(screen.getByText(/제공처 화면의 형식을 읽지 못했습니다/)).toBeInTheDocument();
  });

  it('RANGE_UNAVAILABLE + DATE_MISMATCH: 다른 날짜 자료를 쓰지 않았다고 안내한다', () => {
    renderWithLang(<QtProviderCard provider={provider('unavailable', 0)} now={NOW} />);
    expect(screen.getByText(/날짜가 오늘과 달라 그 자료를 사용하지 않았습니다/)).toBeInTheDocument();
    expect(screen.queryByText(/요한복음/)).not.toBeInTheDocument();
  });

  it('RANGE_NOT_PERMITTED: 공식 링크만', () => {
    renderWithLang(<QtProviderCard provider={provider('not-permitted', 0)} now={NOW} />);
    expect(screen.getByText('자동 확인 안 함')).toBeInTheDocument();
    expect(screen.getByText(/자동으로 가져오지 않습니다/)).toBeInTheDocument();
    expect(screen.queryByText('오늘의 범위')).not.toBeInTheDocument();
    expect(link(/공식 페이지로 이동/)).toBeInTheDocument();
  });

  it('LINK_ERROR: 상태를 안내하되 링크는 그대로 제시한다', () => {
    renderWithLang(<QtProviderCard provider={provider('link-error', 0)} now={NOW} />);
    expect(screen.getByText('링크 오류')).toBeInTheDocument();
    expect(screen.getByText(/응답하지 않는 것으로 확인/)).toBeInTheDocument();
    expect(link(/매일성경 공식 페이지로 이동/)).toHaveAttribute('href', 'https://sum.su.or.kr:8888/bible/today');
  });

  it('DISABLED: 공식 링크만', () => {
    renderWithLang(<QtProviderCard provider={provider('disabled', 1)} now={NOW} />);
    expect(screen.getByText('연동 중지')).toBeInTheDocument();
    expect(screen.getByText(/현재 사용하지 않습니다/)).toBeInTheDocument();
    expect(link(/생명의삶 공식 페이지로 이동/)).toBeInTheDocument();
    expect(screen.queryByText('오늘의 범위')).not.toBeInTheDocument();
  });
});

describe('방어 처리', () => {
  it('RANGE_CONFIRMED인데 범위가 비어 있으면 확인된 것처럼 그리지 않는다', () => {
    const p: QtProvider = { ...provider('confirmed', 0), passage: null };
    renderWithLang(<QtProviderCard provider={p} now={NOW} />);
    expect(screen.getByText('범위 확인 못함')).toBeInTheDocument();
    expect(screen.queryByText('오늘의 범위')).not.toBeInTheDocument();
  });

  it('범위 없는 상태에 passage가 실려 와도 그리지 않는다', () => {
    const p: QtProvider = { ...provider('confirmed', 0), availabilityStatus: 'LINK_ERROR' };
    renderWithLang(<QtProviderCard provider={p} now={NOW} />);
    expect(screen.queryByText(/요한복음/)).not.toBeInTheDocument();
  });

  it('모르는 상태도 확인 못 함 + 링크로 처리한다', () => {
    const p: QtProvider = { ...provider('mixed', 1), availabilityStatus: 'UNKNOWN', reasonCode: 'NEW_REASON' };
    renderWithLang(<QtProviderCard provider={p} now={NOW} />);
    expect(screen.getByText('상태 확인 못함')).toBeInTheDocument();
    expect(link(/공식 페이지로 이동/)).toBeInTheDocument();
  });

  it('officialUrl이 없으면 버튼을 만들지 않고 안내한다', () => {
    const p: QtProvider = { ...provider('mixed', 1), officialUrl: null };
    renderWithLang(<QtProviderCard provider={p} now={NOW} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('공식 링크를 확인하지 못했습니다.')).toBeInTheDocument();
  });
});

describe('제공처 날짜와 현지 날짜 (AC18)', () => {
  it('내 지역 날짜가 다르면 제공처 기준임을 안내한다', () => {
    // 하와이 2026-09-23 오후 → 제공처 날짜 2026-09-24와 다르다
    const p = provider('mixed', 0);
    const spy = vi.spyOn(Intl.DateTimeFormat.prototype, 'formatToParts').mockReturnValue([
      { type: 'year', value: '2026' },
      { type: 'literal', value: '-' },
      { type: 'month', value: '09' },
      { type: 'literal', value: '-' },
      { type: 'day', value: '23' },
    ]);
    renderWithLang(<QtProviderCard provider={p} now={NOW} />);
    spy.mockRestore();
    expect(screen.getByText(/내 지역의 오늘 날짜\(2026-09-23\)와 다를 수 있습니다/)).toBeInTheDocument();
    expect(screen.getByText(/한국 시간 기준/)).toBeInTheDocument();
  });

  it('같으면 안내를 띄우지 않는다', () => {
    const spy = vi.spyOn(Intl.DateTimeFormat.prototype, 'formatToParts').mockReturnValue([
      { type: 'year', value: '2026' },
      { type: 'month', value: '09' },
      { type: 'day', value: '24' },
    ]);
    renderWithLang(<QtProviderCard provider={provider('mixed', 0)} now={NOW} />);
    spy.mockRestore();
    expect(screen.queryByText(/내 지역의 오늘 날짜/)).not.toBeInTheDocument();
  });

  it('providerDate가 없으면 날짜 미확인으로 두고 현지 날짜로 대신하지 않는다', () => {
    renderWithLang(<QtProviderCard provider={provider('mixed', 1)} now={NOW} />);
    expect(screen.getByText('날짜를 확인하지 못했습니다')).toBeInTheDocument();
    expect(screen.queryByText(/내 지역의 오늘 날짜/)).not.toBeInTheDocument();
  });
});

describe('영어 UI (AC18, AC21 취지)', () => {
  it('영어 이름·책 이름을 쓰고, 한국어 원문임과 한국어 표기를 함께 보인다', () => {
    renderWithLang(<QtProviderCard provider={provider('mixed', 0)} now={NOW} />, 'en');
    expect(screen.getByRole('article', { name: /Maeil Seongyeong/ })).toBeInTheDocument();
    expect(screen.getByText('John 3:1–21')).toBeInTheDocument();
    expect(screen.getByText(/The provider's text is in Korean only/)).toBeInTheDocument();
    const ko = screen.getByText('요한복음 3:1–21');
    expect(ko).toHaveAttribute('lang', 'ko');
    expect(screen.getByText(/Korea time \(KST\)/)).toBeInTheDocument();
  });

  it('영어 UI에서도 링크 이름에 이동한다는 뜻과 새 탭이 들어 있다', () => {
    renderWithLang(<QtProviderCard provider={provider('mixed', 0)} now={NOW} />, 'en');
    const a = screen.getByRole('link', { name: /Go to Maeil Seongyeong.* official page.*opens in a new tab/ });
    expect(a).toHaveAttribute('target', '_blank');
    expect(a).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('계약 notice의 현재 언어 문구를 쓰고, 없으면 자체 문구를 쓴다', () => {
    const p = provider('mixed', 0);
    const { unmount } = renderWithLang(<QtProviderCard provider={p} now={NOW} />, 'en');
    expect(screen.getByText(/Read the text on the official page/)).toBeInTheDocument();
    unmount();
    renderWithLang(<QtProviderCard provider={{ ...p, notice: null }} now={NOW} />, 'en');
    expect(screen.getByText(/This site does not show the text/)).toBeInTheDocument();
  });
});

describe('접근성', () => {
  it('카드는 제공처명으로 이름 붙은 article이고 시간은 time 요소다', () => {
    renderWithLang(<QtProviderCard provider={provider('mixed', 0)} now={NOW} />);
    expect(screen.getByRole('article', { name: '매일성경' })).toBeInTheDocument();
    expect(document.querySelector('time')).toHaveAttribute('datetime', '2026-09-24');
  });

  it('외부 이동 아이콘은 스크린리더에서 숨긴다', () => {
    renderWithLang(<QtProviderCard provider={provider('mixed', 0)} now={NOW} />);
    expect(document.querySelector('a svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('두 제공처 모두 5개 상태 중 하나의 배지를 가진다', () => {
    for (const p of scenario('mixed').providers) {
      const { unmount } = renderWithLang(<QtProviderCard provider={p} now={NOW} />);
      expect(document.querySelector('.badge')).not.toBeNull();
      unmount();
    }
  });
});
