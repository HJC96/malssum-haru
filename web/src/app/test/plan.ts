import { computePlan, SAMPLE_BIBLE, type PlanInput, type PlanResult } from '@/domain';

/** 테스트용 기본 입력: 샘플 5권 전체, 2026-10-01~2026-10-31, 매일, 절 수 배분. */
export function sampleInput(over: Partial<PlanInput> = {}): PlanInput {
  return {
    bible: SAMPLE_BIBLE,
    target: { kind: 'all' },
    startDate: '2026-10-01',
    endDate: '2026-10-31',
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    excludedDates: [],
    distribution: 'verses',
    read: { mode: 'none' },
    ...over,
  };
}

export function samplePlan(over: Partial<PlanInput> = {}): PlanResult {
  const out = computePlan(sampleInput(over));
  if (!out.ok) throw new Error(`샘플 계획 계산 실패: ${JSON.stringify(out.errors)}`);
  return out.result;
}
