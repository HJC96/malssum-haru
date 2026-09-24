import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { resolveConfig } from '../lib/config.js';
import { MalssumStack } from '../lib/malssum-stack.js';

export type Overrides = Record<string, unknown>;

/** 컨텍스트 값을 덮어써 스택을 합성한다. 자격 증명·네트워크가 필요 없다. */
export function build(overrides: Overrides = {}) {
  const app = new App();
  // web/dist 가 있느냐에 따라 결과가 달라지지 않도록, 기본은 존재하지 않는 경로로 고정한다.
  const merged: Overrides = { webDistPath: 'test/fixtures/does-not-exist', ...overrides };
  const config = resolveConfig((k) => merged[k]);
  const stack = new MalssumStack(app, 'MalssumHaru', { env: { region: config.region }, config });
  const template = Template.fromStack(stack);
  return { app, stack, template, json: template.toJSON() as CfnTemplate, config };
}

export interface CfnResource {
  Type: string;
  Properties?: Record<string, any>;
  [k: string]: unknown;
}
export interface CfnTemplate {
  Resources: Record<string, CfnResource>;
  Rules?: Record<string, unknown>;
  Parameters?: Record<string, unknown>;
  [k: string]: unknown;
}

export function resourcesOfType(json: CfnTemplate, type: string): Array<[string, CfnResource]> {
  return Object.entries(json.Resources).filter(([, r]) => r.Type === type);
}
