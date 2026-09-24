// CI 워크플로에 배포·AWS 자격 증명 단계가 없음을 검증한다. 배포는 사용자 승인 후 사람이 별도로 실행한다.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const WORKFLOWS = resolve(dirname(fileURLToPath(import.meta.url)), '../../.github/workflows');

test('워크플로에 배포 명령과 AWS 자격 증명 설정이 없다', () => {
  assert.ok(existsSync(WORKFLOWS), '.github/workflows 가 있어야 한다');
  const files = readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f));
  assert.ok(files.length > 0);
  for (const f of files) {
    const text = readFileSync(resolve(WORKFLOWS, f), 'utf8');
    assert.doesNotMatch(text, /cdk\s+(deploy|destroy|bootstrap)/, `${f}: cdk 배포 계열 명령`);
    assert.doesNotMatch(text, /aws-actions\/configure-aws-credentials/, `${f}: AWS 자격 증명 설정`);
    assert.doesNotMatch(text, /AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN/, `${f}: AWS 키 환경 변수`);
    assert.doesNotMatch(text, /aws\s+cloudformation\s+(deploy|create|update)/, `${f}: CloudFormation 배포`);
    assert.doesNotMatch(text, /id-token:\s*write/, `${f}: OIDC 토큰 권한`);
    assert.match(text, /^permissions:/m, `${f}: 최상위 permissions 로 최소 권한을 지정해야 한다`);
  }
});
