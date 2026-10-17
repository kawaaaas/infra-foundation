# infra-foundation

インフラチームの土台です。アカウント共通の仕組みと、環境ごとの共有ネットワーク・予約DBを作ります。

| スタック | リージョン | 作るもの |
| --- | --- | --- |
| `Foundation` | 東京 | CodeArtifact（部品の配布先）、GitHub の OIDC プロバイダー、CI 用のロール（`gha-check`・`gha-deploy`・`gha-publish`） |
| `Foundation-Edge` | us-east-1 | 部品の us-east-1 スタック（CloudFront 用の証明書）が読む SSM パラメーター |
| `Dev-SharedEnv` | 東京 | VPC（NAT 1台）、予約DB（RDS PostgreSQL）、DBユーザーのシークレット、ダミーデータの投入、SSM パラメーター |
| `Stg-SharedEnv`・`Prod-SharedEnv` | 東京 | デモでは作らない（`src/env/index.ts` でコメントアウト）。外せば VPC（NAT 1台）と DNS の SSM パラメーターだけを作る |

CloudFront 用の証明書と WAF は、部品（`@acme/platform`）がサービスごとに us-east-1 に作ります。ここで用意するのは、その材料（ホストゾーン）だけです。

## 使う前に

`src/env/index.ts` の `<...>` を書き換えます。

- `githubUser`：GitHub のユーザー名
- `dns`：ホストゾーンID・ドメイン（証明書は部品が DNS 検証で自動作成するので不要）
- アカウントにすでに GitHub の OIDC プロバイダーがある場合は `existingGithubOidcProviderArn` に ARN を入れる

## デプロイ

```bash
npm ci
npx cdk bootstrap --qualifier ddapp --toolkit-stack-name CDKToolkit-ddapp aws://<アカウントID>/ap-northeast-1 aws://<アカウントID>/us-east-1
npx cdk deploy --all
```

`Dev-SharedEnv` のデプロイ時に、Trigger でシード用の Lambda が1回動き、テーブル・アプリ用のDBユーザー（`app_readonly`・`app_readwrite`）・ダミーデータ（店舗500件、実行日の7日前〜14日後の予約）を作ります。デモの日がこの範囲から外れる場合は、シード用の Lambda を手動で流し直します（データは作り直しになります）。

```bash
aws lambda invoke --function-name acme-reservation-seed --region ap-northeast-1 /dev/stdout
```

初回の synth で、アベイラビリティーゾーンの一覧が `cdk.context.json` に保存されます。このファイルはコミットします。

## フォルダの規則

| フォルダ | 置くもの |
| --- | --- |
| `src/env/` | 設定（`CONFIG`）とアプリとの約束（SSM パラメーター名） |
| `src/stacks/` | Stack。construct を組み立てるだけで、リソースを直接書かない |
| `src/constructs/` | 1フォルダ＝1つの関心。`index.ts` に1つだけ書いて export する |
| `lambda/seed/` | シード用の Lambda |

## アプリとの約束

アプリ（`@acme/platform` の部品）は、VPC を名前（`acme-<環境>`）で探し、それ以外を次の SSM パラメーターから読みます。名前は `platform-constructs` の `src/env/shared-contract.ts` と同じです。

| リージョン | パラメーター | 中身 |
| --- | --- | --- |
| 東京 | `/acme/<環境>/dns/zone-id`・`zone-name` | ホストゾーン |
| 東京 | `/acme/<環境>/reservation-db/endpoint`・`sg-id` | 予約DBの接続先とセキュリティグループ |
| 東京 | `/acme/<環境>/reservation-db/readonly-secret-arn`・`readwrite-secret-arn` | アプリ用のDBユーザー |
| us-east-1 | `/acme/edge/dns/zone-id`・`zone-name` | ホストゾーン（証明書の DNS 検証用） |

## 運用のスクリプト

| スクリプト | すること |
| --- | --- |
| `scripts/reseed.sh` | 予約DBのダミーデータを作り直す（実行した日の7日前〜14日後） |
| `scripts/harden-github-repo.sh <owner/repo>` | public リポジトリの最低限のセキュリティ設定（他人の PR・Issue の制限、フォークの PR の承認、Actions の制限、secret scanning、main とタグの保護） |
| `scripts/add-synth-only-vpcs.py <cdk.context.json>` | 検証・本番の VPC の lookup の結果を、仮の値で固定する（検証・本番は synth だけなので VPC を作らない） |

部品の版の公開は `platform-constructs/scripts/release.sh`、取り込みは各アプリの `infra/scripts/upgrade-platform.sh` です。

## 費用と削除

NAT ゲートウェイ（開発環境の1台）、RDS、ALB、Fargate、WAF が動いている間は課金されます。デモが終わったら、アプリ（`Dev/Dashboard`・`Dev/DashboardEdge`）→ 各 `SharedEnv` → `Foundation-Edge` → `Foundation` の順に削除します。CodeArtifact の中身も消えるので、残したい場合は `Foundation` だけ残します。
