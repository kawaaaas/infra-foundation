import { RemovalPolicy, aws_ec2 as ec2, aws_rds as rds, aws_secretsmanager as secretsmanager } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SHARED_DATABASE_NAME } from '../../env';

export interface ReservationDbProps {
  readonly vpc: ec2.IVpc;
}

/**
 * 関心：複数のサービスが使う、共有の予約DBとアプリ用のDBユーザー。
 * DBユーザー（読み取り専用・読み書き）はシークレットだけをここで作り、DBの中のユーザーは SeedData が作る。
 */
export class ReservationDb extends Construct {
  public readonly instance: rds.DatabaseInstance;
  public readonly readonlyUser: secretsmanager.Secret;
  public readonly readwriteUser: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props: ReservationDbProps) {
    super(scope, id);
    this.instance = new rds.DatabaseInstance(this, 'Instance', {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16 }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      port: 5432,
      databaseName: SHARED_DATABASE_NAME,
      credentials: rds.Credentials.fromGeneratedSecret('dbadmin'),
      storageEncrypted: true,
      multiAz: false,
      deletionProtection: false,
      removalPolicy: RemovalPolicy.DESTROY, // デモ終了後に削除するため
    });
    this.readonlyUser = dbUserSecret(this, 'ReadonlyUser', 'app_readonly');
    this.readwriteUser = dbUserSecret(this, 'ReadwriteUser', 'app_readwrite');
  }
}

const dbUserSecret = (scope: Construct, id: string, username: string) =>
  new secretsmanager.Secret(scope, id, {
    removalPolicy: RemovalPolicy.DESTROY,
    generateSecretString: {
      secretStringTemplate: JSON.stringify({ username }),
      generateStringKey: 'password',
      excludePunctuation: true,
      passwordLength: 32,
    },
  });
