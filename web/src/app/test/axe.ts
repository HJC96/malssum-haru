import axe from 'axe-core';

/**
 * axe-core를 직접 호출하는 접근성 검사 헬퍼(테스트 전용).
 * jsdom은 레이아웃·색상을 계산하지 못하므로 color-contrast 규칙은 끈다(색 대비는 토큰 설계와 실제 브라우저에서 확인).
 */
export async function axeViolations(container: Element): Promise<string[]> {
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  return results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`);
}
