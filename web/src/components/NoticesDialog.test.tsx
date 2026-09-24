import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@/app/App';
import { SAMPLE_BIBLE } from '@/domain';
import { LOCAL_NOON } from '@/app/test/planUi';
import { scenario } from '@/app/test/render';

const raw = readFileSync(resolve(process.cwd(), 'src/data/THIRD_PARTY_NOTICES.md'), 'utf8');
const qtFetcher = async () => scenario('mixed');

describe('데이터 출처·라이선스 고지', () => {
  it('버튼을 누르면 고지 문서가 원문 그대로 열리고 닫을 수 있다', async () => {
    render(<App initialLang="ko" now={LOCAL_NOON} qtFetcher={qtFetcher} planBible={SAMPLE_BIBLE} />);
    await userEvent.click(screen.getByRole('button', { name: '데이터 출처·라이선스' }));
    const dialog = document.querySelector('dialog') as HTMLDialogElement;
    await waitFor(() => expect(dialog).toHaveAttribute('open'));
    expect(screen.getByRole('heading', { name: '데이터 출처와 라이선스', hidden: true })).toBeInTheDocument();
    const pre = dialog.querySelector('pre')!;
    expect(pre.textContent).toBe(raw);
    expect(pre.textContent).toContain('ubsicap/versification_json');
    expect(pre.textContent).toContain('MIT License');
    await userEvent.click(screen.getByRole('button', { name: '닫기', hidden: true }));
    expect(dialog).not.toHaveAttribute('open');
  });

  it('영어 화면에서도 버튼과 제목이 영어다', async () => {
    render(<App initialLang="en" now={LOCAL_NOON} qtFetcher={qtFetcher} planBible={SAMPLE_BIBLE} />);
    await userEvent.click(screen.getByRole('button', { name: 'Data sources and licenses' }));
    expect(await screen.findByRole('heading', { name: 'Data sources and licenses', hidden: true })).toBeInTheDocument();
  });

  it('고지 문서는 텍스트로만 표시한다(HTML로 해석하지 않는다)', async () => {
    render(<App initialLang="ko" now={LOCAL_NOON} qtFetcher={qtFetcher} planBible={SAMPLE_BIBLE} />);
    await userEvent.click(screen.getByRole('button', { name: '데이터 출처·라이선스' }));
    await waitFor(() => expect(document.querySelector('dialog')!.querySelector('pre')!.textContent).not.toBe(''));
    expect(document.querySelector('dialog')!.querySelector('pre')!.children).toHaveLength(0);
  });
});

describe('장절 기준 안내', () => {
  it('잠정 데이터에는 알려진 제한을 한 줄 더 보인다', () => {
    render(<App initialLang="ko" now={LOCAL_NOON} qtFetcher={qtFetcher} />);
    expect(screen.getByText('장절 기준 안내')).toBeInTheDocument();
    expect(screen.getByText(/사도행전 15:25-26/, { exact: false })).toBeInTheDocument();
  });

  it('샘플 데이터에는 제한 줄이 없다', () => {
    render(<App initialLang="ko" now={LOCAL_NOON} qtFetcher={qtFetcher} planBible={SAMPLE_BIBLE} />);
    expect(screen.getByText('장절 기준 안내')).toBeInTheDocument();
    expect(screen.queryByText(/사도행전 15:25-26/)).not.toBeInTheDocument();
  });
});
