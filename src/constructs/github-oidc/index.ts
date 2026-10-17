import { aws_iam as iam } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface GithubOidcProps {
  /** すでにアカウントにある場合はその ARN（新しく作らない） */
  readonly existingProviderArn?: string;
}

/** 関心：GitHub Actions がキーなしで AWS に入るための OIDC プロバイダー */
export class GithubOidc extends Construct {
  public readonly provider: iam.IOidcProvider;

  constructor(scope: Construct, id: string, props: GithubOidcProps = {}) {
    super(scope, id);
    this.provider = props.existingProviderArn
      ? iam.OidcProviderNative.fromOidcProviderArn(this, 'Provider', props.existingProviderArn)
      : new iam.OidcProviderNative(this, 'Provider', {
          url: 'https://token.actions.githubusercontent.com',
          clientIds: ['sts.amazonaws.com'],
        });
  }
}
