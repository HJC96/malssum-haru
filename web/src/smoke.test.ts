// T01 골격 검증용 스모크 테스트(lead 소유). 도구 체인이 동작하는지만 확인한다.
describe('toolchain smoke', () => {
  it('runs vitest with jsdom', () => {
    expect(typeof document).toBe('object');
    expect(1 + 1).toBe(2);
  });
});
