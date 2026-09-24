// docs/cost-estimate.md 의 <!-- model:KEY:begin --> ... <!-- model:KEY:end --> 블록을 model.mjs 결과로 다시 쓴다.
// 실행: node infra/cost/update-doc.mjs [--check]   (--check: 문서가 최신인지만 검사, 다르면 종료 코드 1)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sections } from './model.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const docPath = resolve(here, '../../docs/cost-estimate.md');
const blocks = sections();
const original = readFileSync(docPath, 'utf8');

let text = original;
const used = new Set();
text = text.replace(/<!-- model:(\w+):begin -->[\s\S]*?<!-- model:\1:end -->/g, (_m, key) => {
  if (!(key in blocks)) throw new Error(`알 수 없는 블록: ${key}`);
  used.add(key);
  return `<!-- model:${key}:begin -->\n${blocks[key]}\n<!-- model:${key}:end -->`;
});
const missing = Object.keys(blocks).filter((k) => !used.has(k));
if (missing.length) console.warn(`문서에 없는 블록(무시): ${missing.join(', ')}`);

if (process.argv.includes('--check')) {
  if (text !== original) {
    console.error('docs/cost-estimate.md 의 표가 model.mjs 결과와 다르다. node infra/cost/update-doc.mjs 로 갱신한다.');
    process.exit(1);
  }
  console.log('문서 표가 모델 결과와 같다.');
} else {
  writeFileSync(docPath, text);
  console.log(`갱신한 블록: ${[...used].join(', ')}`);
}
