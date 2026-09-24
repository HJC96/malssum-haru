import { useI18n } from '@/i18n';
import { issueMessage } from '@/app/plan/issueMessages';
import type { PlanIssue } from '@/app/plan/planForm';

/** 계산을 막는 입력 오류 안내(AC04). 이유를 알려 주고 결과 대신 표시한다. */
export function PlanIssues({ issues }: { issues: PlanIssue[] }) {
  const { t } = useI18n();
  return (
    <div className="plan-issues" role="alert">
      <h3>{t('plan.error.heading')}</h3>
      <ul>
        {issues.map((issue, i) => {
          const m = issueMessage(issue);
          return (
            <li key={`${issue.code}-${i}`}>
              {m.whereKey && <strong>{t(m.whereKey)}: </strong>}
              {t(m.key, m.params)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
