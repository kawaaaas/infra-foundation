import { join } from 'path';
import { Duration, aws_ec2 as ec2, aws_lambda as lambda, aws_lambda_nodejs as nodejs, aws_logs as logs, triggers } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ReservationDb } from '../reservation-db';

export interface SeedDataProps {
  readonly vpc: ec2.IVpc;
  readonly db: ReservationDb;
}

/**
 * 関心：テーブルとDBユーザーの作成、ダミーデータの投入。
 * DBができたあと、デプロイのたびに1回だけ実行する（中身は何度流しても同じ結果になる）。
 */
export class SeedData extends Construct {
  constructor(scope: Construct, id: string, props: SeedDataProps) {
    super(scope, id);
    const { db } = props;

    const fn = new nodejs.NodejsFunction(this, 'Function', {
      functionName: 'acme-reservation-seed', // デモの日付に合わせて手動で流し直せるよう、名前を固定する
      entry: join(__dirname, '..', '..', '..', 'lambda', 'seed', 'index.ts'),
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: Duration.minutes(5),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      logGroup: new logs.LogGroup(this, 'Logs', { retention: logs.RetentionDays.ONE_MONTH }),
      environment: {
        ADMIN_SECRET_ARN: db.instance.secret!.secretArn,
        READONLY_SECRET_ARN: db.readonlyUser.secretArn,
        READWRITE_SECRET_ARN: db.readwriteUser.secretArn,
      },
    });
    db.instance.secret!.grantRead(fn);
    db.readonlyUser.grantRead(fn);
    db.readwriteUser.grantRead(fn);
    db.instance.connections.allowDefaultPortFrom(fn, 'from the seed function');

    new triggers.Trigger(this, 'Run', {
      handler: fn,
      executeAfter: [db.instance],
      executeOnHandlerChange: true,
    });
  }
}
