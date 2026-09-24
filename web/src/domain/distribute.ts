import type { Distribution } from './types';

/**
 * 나눌 수 없는 단위 N개(각 절 수 weights[i])를 읽기 날짜 D일에 순서대로 나눈다.
 * 반환값은 날마다 받는 단위 개수(길이 D, 합 N). 0이면 그날은 배정이 없다.
 *
 * - N ≤ D: 앞에서부터 하루 한 단위, 나머지 날은 0.
 * - 'chapters': 단위 수를 고르게. 앞쪽 (N mod D)일이 하나씩 더 받는다.
 * - 'verses': 그날 목표 = 남은 절 ÷ 남은 날을 매일 다시 잡고, 그 값에 가장 가까운 단위 끝에서 끊는다.
 *   N > D이면 모든 날이 최소 한 단위를 받는다.
 */
export function distributeUnits(weights: ReadonlyArray<number>, days: number, mode: Distribution): number[] {
  const n = weights.length;
  const sizes = new Array<number>(days).fill(0);
  if (days === 0 || n === 0) return sizes;

  if (n <= days) {
    for (let i = 0; i < n; i++) sizes[i] = 1;
    return sizes;
  }

  if (mode === 'chapters') {
    const q = Math.floor(n / days);
    const r = n % days;
    for (let i = 0; i < days; i++) sizes[i] = i < r ? q + 1 : q;
    return sizes;
  }

  let pos = 0;
  let remainingVerses = weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < days; i++) {
    const daysLeft = days - i;
    if (daysLeft === 1) {
      sizes[i] = n - pos;
      break;
    }
    const ideal = remainingVerses / daysLeft;
    const minEnd = pos + 1;
    const maxEnd = n - (daysLeft - 1);
    let sum = 0;
    let bestEnd = minEnd;
    let bestDiff = Infinity;
    for (let e = pos; e < maxEnd; e++) {
      sum += weights[e] as number;
      const diff = Math.abs(sum - ideal);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestEnd = e + 1;
      }
      if (sum >= ideal) break;
    }
    let taken = 0;
    for (let e = pos; e < bestEnd; e++) taken += weights[e] as number;
    sizes[i] = bestEnd - pos;
    remainingVerses -= taken;
    pos = bestEnd;
  }
  return sizes;
}
