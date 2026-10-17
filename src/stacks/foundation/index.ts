import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ArtifactRegistry } from '../../constructs/artifact-registry';
import { GithubOidc } from '../../constructs/github-oidc';
import { GithubOidcRole } from '../../constructs/github-oidc-role';
import { CONFIG } from '../../env';

/** アカウント共通の仕組み。construct を組み立てるだけ */
export class Foundation extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);
    const registry = new ArtifactRegistry(this, 'Registry', { domain: 'acme', repository: 'platform' });
    const github = new GithubOidc(this, 'GitHub', { existingProviderArn: CONFIG.existingGithubOidcProviderArn });
    const owner = { owner: CONFIG.githubUser, ownerId: CONFIG.githubUserId };
    const regions = [CONFIG.region, CONFIG.edgeRegion];

    // PR：synth と diff だけ
    const check = new GithubOidcRole(this, 'CheckRole', {
      roleName: 'gha-check',
      provider: github.provider,
      ...owner,
      repo: '*',
      trigger: 'pull_request',
    });
    registry.grantRead(check.role);
    check.allowAssumeCdkRoles(regions, 'lookup');

    // main へのマージ：dashboard-app の開発環境をデプロイ
    const deploy = new GithubOidcRole(this, 'DeployRole', {
      roleName: 'gha-deploy',
      provider: github.provider,
      ...owner,
      repo: 'dashboard-app',
      trigger: 'ref:refs/heads/main',
    });
    registry.grantRead(deploy.role);
    deploy.allowAssumeCdkRoles(regions, 'lookup', 'deploy', 'file-publishing', 'image-publishing');

    // v* のタグ：部品を公開
    const publish = new GithubOidcRole(this, 'PublishRole', {
      roleName: 'gha-publish',
      provider: github.provider,
      ...owner,
      repo: 'platform-constructs',
      trigger: 'ref:refs/tags/v*',
    });
    registry.grantPublish(publish.role);
  }
}
