# BOOKReader Web

AI要約、読み上げ、復習クイズ、OCRを備えたVite製PWAです。ブラウザーや
VercelにプロバイダーのAPIキーは置かず、すべて認証済みCloudflare Workerを経由します。

## ローカル開発

先にリポジトリ直下の手順でWorkerとローカルD1を `http://localhost:8787` に起動します。

```bash
cd web
npm install
cp .env.example .env
npm run dev
```

PWAは `VITE_WORKER_API_BASE_URL` のWorkerへ直接接続して匿名セッションを発行し、
以後の呼び出しへBearer tokenを付けます。ローカルの `server/lib/` は移植元ロジックの
回帰テストにだけ残してあり、
開発サーバーとしてプロバイダーへ直接接続しません。

## Vercel

Root Directoryを `web` にして、次の2変数だけを設定します。

- `WORKER_API_BASE_URL` — Vercel FunctionsからWorkerへの転送先
- `VITE_WORKER_API_BASE_URL` — ブラウザーが匿名認証に使う同じWorker URL

Workerの `ALLOWED_ORIGINS` へ固定したVercel本番オリジンを追加します。動的なpreview
ドメインをワイルドカード許可しないでください。Anthropic、Google TTS、Visionのキーは
Vercelへ登録しません。

## スクリプト

- `npm run dev` — Vite開発サーバー
- `npm run build` — 型検査とPWA本番ビルド
- `npm run typecheck` — TypeScript型検査
- `npm run test:unit` — 純ロジックの回帰テスト
- `npm run test:e2e` — Playwright E2E

公開・自己テストの手順はリポジトリ直下の
[`docs/deployment.md`](../docs/deployment.md) と
[`docs/self-test.md`](../docs/self-test.md) を参照してください。
