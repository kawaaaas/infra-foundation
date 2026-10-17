import { DefaultStackSynthesizer, Stack, aws_iam as iam } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface GithubOidcRoleProps {
  readonly roleName: string;
  readonly provider: iam.IOidcProvider;
  /** 信頼する GitHub の条件（例：repo:<user>/dashboard-app:ref:refs/heads/main） */
  readonly subject: string;
}

/** CDK の bootstrap が作るロールの種類 */
export type CdkRoleKind = 'lookup' | 'deploy' | 'file-publishing' | 'image-publishing';

/**
 * 関心：CI 用のロール1つ。
 * デプロイの権限そのものは持たせず、CDK の bootstrap ロールを引き受ける権限だけを渡す。
 */
export class GithubOidcRole extends Construct {
  public readonly role: iam.Role;

  constructor(scope: Construct, id: string, props: GithubOidcRoleProps) {
    super(scope, id);
    this.role = new iam.Role(this, 'Role', {
      roleName: props.roleName,
      assumedBy: new iam.WebIdentityPrincipal(props.provider.openIdConnectProviderArn, {
        StringEquals: { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com' },
        StringLike: { 'token.actions.githubusercontent.com:sub': props.subject },
      }),
    });
  }

  /**
   * CDK の bootstrap ロールを引き受けられるようにする。
   * 部品の証明書と WAF は us-east-1 のスタックに入るため、東京と us-east-1 の両方を許可する。
   */
  public allowAssumeCdkRoles(regions: readonly string[], ...kinds: CdkRoleKind[]): void {
    const { account, partition } = Stack.of(this);
    // cdk.json の @aws-cdk/core:bootstrapQualifier（ddapp）と同じ値を使う
    const qualifier: string =
      this.node.tryGetContext('@aws-cdk/core:bootstrapQualifier') ?? DefaultStackSynthesizer.DEFAULT_QUALIFIER;
    this.role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: regions.flatMap((region) =>
          kinds.map((kind) => `arn:${partition}:iam::${account}:role/cdk-${qualifier}-${kind}-role-${account}-${region}`),
        ),
      }),
    );
  }
}
