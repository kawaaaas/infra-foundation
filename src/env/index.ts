/** 環境の種別 */
export type EnvType = 'dev' | 'stg' | 'prod';

/**
 * このリポジトリの設定。<...> の部分を書き換えてから使う。
 */
export const CONFIG = {
  region: 'ap-northeast-1',

  /** CloudFront 用の証明書・WAF を置くリージョン（AWS の決まりで us-east-1 だけ） */
  edgeRegion: 'us-east-1',

  /** GitHub のユーザー名（リポジトリは public で、このユーザーの下に置く） */
  githubUser: 'kawaaaas',

  /** すでにアカウントに GitHub の OIDC プロバイダーがあれば、その ARN（なければ undefined のまま） */
  existingGithubOidcProviderArn: undefined as string | undefined,

  /** 手持ちのドメインの Route 53 ホストゾーン。証明書はサービスごとに部品が自動で作る（DNS 検証） */
  dns: {
    zoneId: 'Z05304943LWOKTQXC7P8D',
    zoneName: 'kawaaaas.com',
  },

  /** 環境の一覧。検証・本番は synth の参照先として VPC だけ作る */
  envs: [
    { envType: 'dev', withDatabase: true },
    // { envType: 'stg', withDatabase: false },
    // { envType: 'prod', withDatabase: false },
  ] as const satisfies ReadonlyArray<{ envType: EnvType; withDatabase: boolean }>,
} as const;

/** 共有の予約DBのデータベース名 */
export const SHARED_DATABASE_NAME = 'reservation';

/**
 * アプリとの約束（東京リージョンのSSMパラメーター名とVPC名）。
 * platform-constructs の src/env/shared-contract.ts と同じ名前にする。
 */
export const sharedContract = (envType: EnvType) => {
  const prefix = `/acme/${envType}`;
  return {
    vpcName: `acme-${envType}`,
    dnsZoneId: `${prefix}/dns/zone-id`,
    dnsZoneName: `${prefix}/dns/zone-name`,
    dbEndpoint: `${prefix}/reservation-db/endpoint`,
    dbSecurityGroupId: `${prefix}/reservation-db/sg-id`,
    dbReadonlySecretArn: `${prefix}/reservation-db/readonly-secret-arn`,
    dbReadwriteSecretArn: `${prefix}/reservation-db/readwrite-secret-arn`,
  };
};

/**
 * アプリとの約束（us-east-1 のSSMパラメーター名）。環境によらず共通。
 * platform-constructs の src/env/shared-contract.ts の edgeContract と同じ名前にする。
 */
export const edgeContract = {
  dnsZoneId: '/acme/edge/dns/zone-id',
  dnsZoneName: '/acme/edge/dns/zone-name',
} as const;
