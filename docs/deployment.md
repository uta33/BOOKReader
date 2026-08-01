# デプロイ・運用手順

## 現在の自己テスト環境

- Worker: `https://bookreader-api.hamasan.workers.dev`
- D1: `bookreader`（APAC）
- KV: `JWKS_CACHE`
- Cron: 毎日 `03:17 UTC`
- 設定済みSecret: `AUTH_HMAC_SECRET`
- 検証済み実装commit: `82289340a2b8d8c79e08ddaa80b56a3fb3f52719`
- 検証済みWorker version: `862ec736-79e1-4fd9-9ab2-f28e349251fb`

D1/KVの実IDは `worker/wrangler.jsonc` が正本。既存リソースを再作成しない。
現在のWorker versionは次で確認する。

```bash
cd worker
npx wrangler deployments status --name bookreader-api
```

## 外部資格情報

本人テスト開始前に、次をWorkerへ登録する。

```bash
cd worker
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put GOOGLE_TTS_API_KEY
npx wrangler secret put GOOGLE_VISION_API_KEY
npx wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET
```

`worker/wrangler.jsonc` の通常変数も設定する。

- `GOOGLE_OAUTH_CLIENT_ID`：Google Web OAuth client ID
- `PRIVACY_CONTACT_EMAIL`：Playへ掲載する問い合わせ先
- `ALLOWED_ORIGINS`：固定した本番PWAオリジンと `http://localhost:5173`

Google Cloud Consoleへ登録するredirect URIは次の1本だけ。

```text
https://bookreader-api.hamasan.workers.dev/v1/auth/google/callback
```

秘密値をGit、APK、EAS、Vercel、`.dev.vars.example`へ書かない。登録名だけは
`npx wrangler secret list` で確認できる。

## 更新デプロイ

```bash
npm test
npm --prefix worker run db:migrate:remote
npm --prefix worker run deploy:dry-run
npm --prefix worker run deploy
```

デプロイ後はローカルと公開URLの両方でsmoke testを実行する。

```powershell
npm --prefix worker run test:smoke
$env:BOOKREADER_SMOKE_BASE_URL='https://bookreader-api.hamasan.workers.dev'
npm --prefix worker run test:smoke
Remove-Item Env:BOOKREADER_SMOKE_BASE_URL
```

公開smoke testは、アプリ内削除と別の匿名アカウントによるウェブ削除コードを
それぞれ検証する。終了後に本番D1のユーザー数が開始前と一致することを確認する。

## PWA／Vercel

PWAはWorkerへ直接接続する。Vercelには次だけを設定する。

- `VITE_WORKER_API_BASE_URL`：上記Worker URL
- `WORKER_API_BASE_URL`：旧 `/api/*` 互換Functionsの転送先

Anthropic／GoogleのキーはVercelから削除する。WorkerのCORSには固定本番オリジンを
明示し、動的previewドメインをワイルドカード許可しない。

## EAS

公開候補Worker URLは `eas.json` のdevelopment／preview／productionへ固定済み。

```bash
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

既存APKへ上書きする場合は、EASが提示するAndroid keystoreのSHA-256を既存APKと比較する。
一致しない鍵でビルドを進めない。`preview` はAPK、`production` はPlay用AAB。

2026-08-01のpreview build `bb4aa4b5-a667-4ed6-8f8e-3837dfc44745` は既存の
`Build Credentials 1b-OEwqqm3 (default)` を再利用した。成果物は
`com.uta33.bookreader` 1.0.1（versionCode 2）、証明書SHA-256は
`24410654cbfb391f638346cceba9374179783be5afffc87287b204a64efa2b3b`。
実機で旧版をアンインストールせず上書きし、署名継続とローカルデータ保持を最終確認する。

EASクラウド枠を使わず同じremote keystoreで修正版を作る場合は、Android SDK／NDKを
用意したLinuxまたはWSLから次を実行する。`--freeze-credentials`を外さない。

```bash
eas build --platform android --profile preview --local --non-interactive \
  --freeze-credentials --output .expo/READING-NOTE-preview.apk
```

2026-08-01にこの方法で1.0.2（versionCode 3）を生成し、1.0.1と証明書SHA-256が
一致することを確認した。表示名とアイコンを更新した1.1.0（versionCode 4）も同じ鍵で
生成し、証明書SHA-256の一致を確認した。

## 一時D1への復元ドリル

本番D1へ復元SQLを流さない。出力SQLにはハッシュ化済み識別子等が含まれるため、
`worker/.wrangler/` のようなGit管理外へ置き、終了後に削除する。

```bash
cd worker
npx wrangler d1 export bookreader --remote \
  --output .wrangler/restore-drill.sql --skip-confirmation
npx wrangler d1 create bookreader-restore-drill-YYYYMMDD --location apac
npx wrangler d1 execute bookreader-restore-drill-YYYYMMDD --remote \
  --file .wrangler/restore-drill.sql --yes
```

一時D1でユーザー、本、DogEar、DigitalLink、tombstone、削除対象が一致することを照合する。
ドリル専用DB名と照合結果を記録してから、対象名を再確認して削除する。

```bash
npx wrangler d1 delete bookreader-restore-drill-YYYYMMDD --skip-confirmation
```

本番バックアップやTime Travelを直接restoreする操作は、別途明示承認がある場合だけ行う。
