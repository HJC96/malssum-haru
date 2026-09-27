// 일반 CI는 AWS 자격을 받지 않는다. 수동 콘텐츠 게시 워크플로만 환경별 OIDC를 사용한다.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const WORKFLOWS = resolve(dirname(fileURLToPath(import.meta.url)), '../../.github/workflows');

test('워크플로에 배포 명령과 AWS 자격 증명 설정이 없다', () => {
  assert.ok(existsSync(WORKFLOWS), '.github/workflows 가 있어야 한다');
  const files = readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f));
  assert.ok(files.includes('ci.yml'));
  for (const f of files.filter((file) => file !== 'publish-content.yml')) {
    const text = readFileSync(resolve(WORKFLOWS, f), 'utf8');
    assert.doesNotMatch(text, /cdk\s+(deploy|destroy|bootstrap)/, `${f}: cdk 배포 계열 명령`);
    assert.doesNotMatch(text, /aws-actions\/configure-aws-credentials/, `${f}: AWS 자격 증명 설정`);
    assert.doesNotMatch(text, /AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN/, `${f}: AWS 키 환경 변수`);
    assert.doesNotMatch(text, /aws\s+cloudformation\s+(deploy|create|update)/, `${f}: CloudFormation 배포`);
    assert.doesNotMatch(text, /id-token:\s*write/, `${f}: OIDC 토큰 권한`);
    assert.match(text, /^permissions:/m, `${f}: 최상위 permissions 로 최소 권한을 지정해야 한다`);
  }
});

test('콘텐츠 게시 워크플로는 수동 실행과 환경별 OIDC 역할로 제한된다', () => {
  const workflow = readFileSync(resolve(WORKFLOWS, 'publish-content.yml'), 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^\s*push:|^\s*pull_request:/m);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /environment: \$\{\{ inputs\.environment \}\}/);
  assert.match(workflow, /DAILY_WORD_PUBLISH_ROLE_ARN/);
  assert.match(workflow, /--publish/);
  assert.doesNotMatch(workflow, /AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN/);
});
