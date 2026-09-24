// 합성된 CloudFormation 템플릿 스냅샷. 변경이 의도된 것이면 `pnpm --filter malssum-haru-infra test:update-snapshot`.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { build, type CfnTemplate } from './helpers.js';

const SNAPSHOT = resolve(dirname(fileURLToPath(import.meta.url)), '__snapshots__/malssum.template.json');

/** 자산 해시와 CDK 메타데이터처럼 버전·내용에 따라 흔들리는 값은 정규화한다 */
function normalize(json: CfnTemplate): unknown {
  const copy = JSON.parse(JSON.stringify(json)) as CfnTemplate;
  for (const [id, r] of Object.entries(copy.Resources)) if (r.Type === 'AWS::CDK::Metadata') delete copy.Resources[id];
  return JSON.parse(JSON.stringify(copy).replace(/[0-9a-f]{64}/g, '<HASH>'));
}

test('합성 결과가 스냅샷과 같다', () => {
  const { json } = build({ alertEmail: 'alerts@example.com' });
  const actual = `${JSON.stringify(normalize(json), null, 2)}\n`;
  if (process.env.UPDATE_SNAPSHOT === '1' || !existsSync(SNAPSHOT)) {
    mkdirSync(dirname(SNAPSHOT), { recursive: true });
    writeFileSync(SNAPSHOT, actual);
    return;
  }
  assert.equal(actual, readFileSync(SNAPSHOT, 'utf8'), '스냅샷과 다르다. 의도한 변경이면 test:update-snapshot 으로 갱신한다.');
});
