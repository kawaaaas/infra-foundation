#!/usr/bin/env node
import { App, Tags } from 'aws-cdk-lib';
import { CONFIG } from '../src/env';
import { Foundation } from '../src/stacks/foundation';
import { FoundationEdge } from '../src/stacks/foundation-edge';
import { SharedEnv } from '../src/stacks/shared-env';

const app = new App();
const account = process.env.CDK_DEFAULT_ACCOUNT;
const env = { account, region: CONFIG.region };

// アカウント共通（配布先とCIのロール）
new Foundation(app, 'Foundation', { env });
// アカウント共通のうち us-east-1 に置くもの（部品が読む SSM パラメーター）
new FoundationEdge(app, 'Foundation-Edge', { env: { account, region: CONFIG.edgeRegion } });

// 環境ごとの共有ネットワークと予約DB（検証・本番はVPCだけ）
for (const { envType, withDatabase } of CONFIG.envs) {
  const name = envType.charAt(0).toUpperCase() + envType.slice(1);
  const stack = new SharedEnv(app, `${name}-SharedEnv`, { env, envType, withDatabase });
  Tags.of(stack).add('acme:env', envType);
}
