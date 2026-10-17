import { aws_ssm as ssm } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { edgeContract } from '../../env';

export interface EdgeSsmExportsProps {
  readonly dns: { readonly zoneId: string; readonly zoneName: string };
}

/**
 * 関心：部品の us-east-1 のスタック（証明書・WAF）に渡すIDを、約束した名前の SSM パラメーターに書く（us-east-1）。
 */
export class EdgeSsmExports extends Construct {
  constructor(scope: Construct, id: string, props: EdgeSsmExportsProps) {
    super(scope, id);
    const put = (id: string, parameterName: string, stringValue: string) =>
      new ssm.StringParameter(this, id, { parameterName, stringValue });

    put('DnsZoneId', edgeContract.dnsZoneId, props.dns.zoneId);
    put('DnsZoneName', edgeContract.dnsZoneName, props.dns.zoneName);
  }
}
