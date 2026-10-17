import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Network } from '../../constructs/network';
import { ReservationDb } from '../../constructs/reservation-db';
import { SeedData } from '../../constructs/seed-data';
import { SsmExports } from '../../constructs/ssm-exports';
import { CONFIG, EnvType } from '../../env';

export interface SharedEnvProps extends StackProps {
  readonly envType: EnvType;
  /** false なら VPC だけ（アプリの synth の参照先） */
  readonly withDatabase: boolean;
}

/** 環境ごとの共有ネットワークと予約DB。construct を組み立てるだけ */
export class SharedEnv extends Stack {
  constructor(scope: Construct, id: string, props: SharedEnvProps) {
    super(scope, id, props);
    const network = new Network(this, 'Network', { name: `acme-${props.envType}` });

    if (!props.withDatabase) {
      new SsmExports(this, 'Exports', { envType: props.envType, dns: CONFIG.dns });
      return;
    }

    const db = new ReservationDb(this, 'ReservationDb', { vpc: network.vpc });
    new SeedData(this, 'Seed', { vpc: network.vpc, db });
    new SsmExports(this, 'Exports', { envType: props.envType, dns: CONFIG.dns, db });
  }
}
