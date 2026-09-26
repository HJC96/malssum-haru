import { App } from 'aws-cdk-lib';
import { resolveConfig } from '../lib/config.js';
import { MalssumStack } from '../lib/malssum-stack.js';

const app = new App();
const config = resolveConfig((key) => app.node.tryGetContext(key));

// 계정은 지정하지 않는다: synth 는 자격 증명 없이 동작하고, 계정은 배포하는 사용자의 자격 증명으로 결정된다.
// 이 저장소의 CI에는 배포 단계가 없다. 배포는 사용자 승인 후 사람이 실행한다.
new MalssumStack(app, 'MalssumHaru', {
  env: { region: config.region },
  description: config.qtAcquisitionEnabled
    ? '말씀하루 서버리스 스택 (legacy QT provider acquisition opt-in; provider permission unconfirmed)'
    : '말씀하루 서버리스 스택(정적 웹·날짜별 콘텐츠, 레거시 QT provider acquisition 기본 off)',
  config,
});
