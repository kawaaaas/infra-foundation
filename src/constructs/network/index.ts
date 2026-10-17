import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface NetworkProps {
  /** VPC の名前。アプリ側（部品）はこの名前で探す */
  readonly name: string;
}

/**
 * 関心：環境のネットワーク。
 * 公開（ALB）・アプリ（Fargate、NAT経由で外へ）・データ（RDS、外に出ない）の3層。
 */
export class Network extends Construct {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props: NetworkProps) {
    super(scope, id);
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: props.name,
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'app', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 22 },
        { name: 'data', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
    });
  }
}
