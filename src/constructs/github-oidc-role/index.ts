import { DefaultStackSynthesizer, Stack, aws_iam as iam } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface GithubOidcRoleProps {
  readonly roleName: string;
  readonly provider: iam.IOidcProvider;
  /** GitHub のユーザー名と、その数字の ID */
  readonly owner: string;
  readonly ownerId: string;
  /** 信頼するリポジトリ（`*` で全部） */
  readonly repo: string;
  /** 信頼するきっかけ（例：pull_request、ref:refs/heads/main） */
  readonly trigger: string;
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
    const { owner, ownerId, repo, trigger } = props;
    // GitHub の sub は2つの形式がある。新しい既定は名前に数字の ID が付く（名前を変えても乗っ取られないため）
    const subjects = [`repo:${owner}/${repo}:${trigger}`, `repo:${owner}@${ownerId}/${repo}@*:${trigger}`];
    this.role = new iam.Role(this, 'Role', {
      roleName: props.roleName,
      assumedBy: new iam.WebIdentityPrincipal(props.provider.openIdConnectProviderArn, {
        StringEquals: { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com' },
        StringLike: { 'token.actions.githubusercontent.com:sub': subjects },
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
