import { aws_ssm as ssm } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EnvType, sharedContract } from '../../env';
import { ReservationDb } from '../reservation-db';

export interface SsmExportsProps {
  readonly envType: EnvType;
  readonly dns: { readonly zoneId: string; readonly zoneName: string };
  /** 予約DB（検証・本番では作らないので省略） */
  readonly db?: ReservationDb;
}

/**
 * 関心：アプリに渡すIDを、約束した名前のSSMパラメーターに書く（東京）。
 * スタック間の参照を作らないので、インフラとアプリは別々にデプロイできる。
 */
export class SsmExports extends Construct {
  constructor(scope: Construct, id: string, props: SsmExportsProps) {
    super(scope, id);
    const names = sharedContract(props.envType);
    const put = (id: string, parameterName: string, stringValue: string) =>
      new ssm.StringParameter(this, id, { parameterName, stringValue });

    put('DnsZoneId', names.dnsZoneId, props.dns.zoneId);
    put('DnsZoneName', names.dnsZoneName, props.dns.zoneName);

    if (props.db) {
      put('DbEndpoint', names.dbEndpoint, props.db.instance.dbInstanceEndpointAddress);
      put('DbSecurityGroupId', names.dbSecurityGroupId, props.db.instance.connections.securityGroups[0].securityGroupId);
      put('DbReadonlySecretArn', names.dbReadonlySecretArn, props.db.readonlyUser.secretArn);
      put('DbReadwriteSecretArn', names.dbReadwriteSecretArn, props.db.readwriteUser.secretArn);
    }
  }
}
