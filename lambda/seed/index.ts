import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { Client } from 'pg';

/**
 * 共有の予約DBに、テーブル・アプリ用のDBユーザー・ダミーデータを作る。
 * 何度実行しても同じ状態になる（テーブルは作り直さず、データは入れ直す）。
 *
 * ダミーデータ：店舗500件と、実行日の7日前〜14日後の予約（平日2,600件・金土日3,600件）。
 * 乱数は固定の種を使うので、何度流しても同じ画面になる。
 */
const secrets = new SecretsManagerClient({});

interface DbSecret {
  readonly username: string;
  readonly password: string;
  readonly host?: string;
  readonly port?: number;
  readonly dbname?: string;
}

const readSecret = async (arn: string): Promise<DbSecret> => {
  const result = await secrets.send(new GetSecretValueCommand({ SecretId: arn }));
  return JSON.parse(result.SecretString!);
};

export const handler = async (): Promise<void> => {
  const admin = await readSecret(process.env.ADMIN_SECRET_ARN!);
  const readonly = await readSecret(process.env.READONLY_SECRET_ARN!);
  const readwrite = await readSecret(process.env.READWRITE_SECRET_ARN!);

  const client = new Client({
    host: admin.host,
    port: admin.port,
    database: admin.dbname,
    user: admin.username,
    password: admin.password,
    // シード用の一回きりの処理のため証明書の検証は省略する（アプリ側はRDSのCA証明書で検証する）
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS stores (
        id   int  PRIMARY KEY,
        name text NOT NULL,
        area text NOT NULL
      );
      CREATE TABLE IF NOT EXISTS reservations (
        id          bigserial   PRIMARY KEY,
        store_id    int         NOT NULL REFERENCES stores(id),
        reserved_at timestamptz NOT NULL,
        party_size  int         NOT NULL,
        channel     text        NOT NULL
      );
      CREATE INDEX IF NOT EXISTS reservations_reserved_at_idx ON reservations (reserved_at);
    `);

    for (const [user, grants] of [
      [readonly, 'SELECT'],
      [readwrite, 'SELECT, INSERT, UPDATE'],
    ] as const) {
      const name = client.escapeIdentifier(user.username);
      await client.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = ${client.escapeLiteral(user.username)}) THEN
            CREATE ROLE ${name} LOGIN;
          END IF;
        END $$;
      `);
      await client.query(`ALTER ROLE ${name} PASSWORD ${client.escapeLiteral(user.password)}`);
      await client.query(`GRANT CONNECT ON DATABASE ${client.escapeIdentifier(admin.dbname!)} TO ${name}`);
      await client.query(`GRANT USAGE ON SCHEMA public TO ${name}`);
      await client.query(`GRANT ${grants} ON ALL TABLES IN SCHEMA public TO ${name}`);
      await client.query(`GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO ${name}`);
    }

    await client.query('TRUNCATE reservations, stores RESTART IDENTITY');
    await client.query('SELECT setseed(0.42)');
    await client.query(`
      INSERT INTO stores (id, name, area)
      SELECT i,
             area || ' ' || i || '号店',
             area
      FROM generate_series(1, 500) AS i,
           LATERAL (SELECT (ARRAY['東京','大阪','名古屋','福岡','札幌','仙台','広島','横浜'])[1 + (i % 8)] AS area) a;
    `);
    // 昼（11〜13時）と夜（18〜20時）に山があり、週末は多め。人気の店に予約が偏る。
    await client.query(`
      INSERT INTO reservations (store_id, reserved_at, party_size, channel)
      SELECT CASE WHEN random() < 0.25 THEN 1 + floor(random() * 24)::int * 21   -- 人気の24店舗
                  ELSE 1 + floor(random() * 500)::int END,
             (day.d + make_interval(
                hours => (ARRAY[11,11,12,12,12,12,12,13,13,14,15,16,17,17,18,18,18,18,19,19,19,19,19,20,20,20,21])[1 + floor(random() * 27)::int],
                mins  => (floor(random() * 4) * 15)::int)
             ) AT TIME ZONE 'Asia/Tokyo',
             (ARRAY[1,2,2,2,2,3,3,4,4,4,5,6])[1 + floor(random() * 12)::int],
             (ARRAY['app','app','app','app','app','web','web','web','web','phone','phone','phone'])[1 + floor(random() * 12)::int]
      FROM generate_series(-7, 14) AS offset_days,
           LATERAL (SELECT date_trunc('day', now() AT TIME ZONE 'Asia/Tokyo') + make_interval(days => offset_days) AS d) AS day,
           generate_series(1, 3600) AS n
      WHERE n <= CASE WHEN extract(isodow FROM day.d) IN (5, 6, 7) THEN 3600 ELSE 2600 END;
    `);

    await client.query('COMMIT');
    console.log('seed completed');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
};
