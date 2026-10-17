import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EdgeSsmExports } from '../../constructs/edge-ssm-exports';
import { CONFIG } from '../../env';

/**
 * アカウント共通の仕組みのうち、us-east-1 に置くもの。construct を組み立てるだけ。
 * 部品の us-east-1 のスタック（CloudFront 用の証明書）が読む SSM パラメーター。
 */
export class FoundationEdge extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);
    new EdgeSsmExports(this, 'Exports', { dns: CONFIG.dns });
  }
}
