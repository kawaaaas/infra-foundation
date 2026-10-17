import { Stack, aws_codeartifact as codeartifact, aws_iam as iam } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface ArtifactRegistryProps {
  /** ドメイン名（npm のスコープと同じ名前にする。例：acme → @acme/...） */
  readonly domain: string;
  readonly repository: string;
}

/** 関心：部品の配布先（CodeArtifact）と、その読み取り・公開の権限 */
export class ArtifactRegistry extends Construct {
  private readonly domainArn: string;
  private readonly repositoryArn: string;
  private readonly packagesArn: string;

  constructor(scope: Construct, id: string, props: ArtifactRegistryProps) {
    super(scope, id);
    const domain = new codeartifact.CfnDomain(this, 'Domain', { domainName: props.domain });
    const repository = new codeartifact.CfnRepository(this, 'Repository', {
      domainName: domain.attrName,
      repositoryName: props.repository,
    });

    const { account, region, partition } = Stack.of(this);
    this.domainArn = domain.attrArn;
    this.repositoryArn = repository.attrArn;
    this.packagesArn = `arn:${partition}:codeartifact:${region}:${account}:package/${props.domain}/${props.repository}/npm/${props.domain}/*`;
  }

  /** npm install できるようにする */
  public grantRead(grantee: iam.IGrantable): void {
    grantee.grantPrincipal.addToPrincipalPolicy(
      new iam.PolicyStatement({ actions: ['codeartifact:GetAuthorizationToken'], resources: [this.domainArn] }),
    );
    grantee.grantPrincipal.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['codeartifact:GetRepositoryEndpoint', 'codeartifact:ReadFromRepository'],
        resources: [this.repositoryArn],
      }),
    );
    grantee.grantPrincipal.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['sts:GetServiceBearerToken'],
        resources: ['*'],
        conditions: { StringEquals: { 'sts:AWSServiceName': 'codeartifact.amazonaws.com' } },
      }),
    );
  }

  /** npm publish できるようにする（読み取りも含む） */
  public grantPublish(grantee: iam.IGrantable): void {
    this.grantRead(grantee);
    grantee.grantPrincipal.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['codeartifact:PublishPackageVersion', 'codeartifact:PutPackageMetadata'],
        resources: [this.packagesArn],
      }),
    );
  }
}
