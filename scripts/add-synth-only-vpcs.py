# 使い方: python3 -I <infra-foundation>/scripts/add-synth-only-vpcs.py <アプリの infra/cdk.context.json>
# 検証・本番は synth だけなので、VPC は作らずに lookup の結果を固定する。dev のエントリーを写して ID と CIDR を変える。
import json, sys

path = sys.argv[1]
ctx = json.load(open(path))
dev_key = next(k for k in ctx if k.startswith('vpc-provider:') and 'Name=acme-dev:' in k)
dev = ctx[dev_key]

for n, env in ((1, 'stg'), (2, 'prod')):
    entry = json.loads(json.dumps(dev))
    entry['vpcId'] = f'vpc-{n:017x}'
    entry['vpcCidrBlock'] = f'10.{n}.0.0/16'
    i = 0
    for group in entry['subnetGroups']:
        for subnet in group['subnets']:
            i += 1
            subnet['subnetId'] = f'subnet-{n * 100 + i:017x}'
            subnet['cidr'] = subnet['cidr'].replace('10.0.', f'10.{n}.', 1)
            subnet['routeTableId'] = f'rtb-{n * 100 + i:017x}'
    ctx[dev_key.replace('Name=acme-dev:', f'Name=acme-{env}:')] = entry

json.dump(ctx, open(path, 'w'), indent=2)
open(path, 'a').write('\n')
print('added acme-stg, acme-prod to', path)
