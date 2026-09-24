import type { MessageKey, TranslateParams } from '@/i18n';
import type { PlanIssue } from './planForm';

const KNOWN = new Set([
  'START_AFTER_END',
  'NO_READING_DAYS',
  'EMPTY_SCOPE',
  'UNKNOWN_BOOK',
  'INVALID_RANGE',
  'READ_OUTSIDE_TARGET',
  'NO_DAYS_LEFT_WITH_REMAINING',
  'INVALID_DATE',
  'PERIOD_TOO_LONG',
  'FORM_INCOMPLETE',
  'FORM_NOT_INTEGER',
]);

const WHERE = new Set(['target', 'read', 'todayRead', 'startDate', 'endDate', 'excludedDates', 'asOf', 'period', 'weekdays']);

/** 오류 코드를 메시지 키와 자리표시자로 바꾼다. 모르는 코드는 일반 문구로 처리한다(계약: 개방형). */
export function issueMessage(issue: PlanIssue): { key: MessageKey; params: TranslateParams; whereKey: MessageKey | null } {
  const key = (KNOWN.has(issue.code) ? `plan.error.${issue.code}` : 'plan.error.UNKNOWN') as MessageKey;
  const params: TranslateParams = {};
  if ('detail' in issue && issue.detail) {
    for (const [k, v] of Object.entries(issue.detail)) params[k] = v;
  }
  const field = issue.field ?? (typeof params.field === 'string' ? params.field : undefined);
  const whereKey = field && WHERE.has(field) ? (`plan.where.${field}` as MessageKey) : null;
  return { key, params, whereKey };
}
