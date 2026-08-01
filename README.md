# READING NOTE

紙の本とPDF/TXTを同じ本棚で扱い、openBD・Google Books・Open Libraryを使った
ISBN表紙検索と端末保存、マガジンノート、
ドッグイヤー抜き書き、図・グラフ・写真の添付、100冊の進捗、AI要約、読み上げを
まとめたExpo製Androidアプリです。

表示名は `READING NOTE`。上書き更新と既存データの互換性を守るため、技術IDの
`bookreader`（Expo slug、URL scheme、Android package、保存キー）は維持します。

## 構成

- `src/` — Expo SDK 57 / React Nativeアプリ
- `worker/` — Cloudflare Worker、D1、匿名認証、同期、Google OAuth、AIプロキシ
- `web/` — Vite PWA。Workerへ直接接続し、Vercel Functionsは互換プロキシとして維持
- `docs/` — アーキテクチャ、デプロイ、自己テスト、Play向け文書

プロバイダーのAPIキーはWorker Secretだけに保存します。APK、PWA、Vercelには
Google TTS、Vision、Books、Anthropicのキーを置きません。

## ローカル開発

前提はNode.js 20以降です。

```bash
npm install
npm --prefix web install
npm --prefix worker install
```

Workerのローカル設定を作ります。

```bash
copy worker\.dev.vars.example worker\.dev.vars
npm --prefix worker run db:migrate:local
npm --prefix worker run dev
```

別のターミナルでExpoを起動します。実機からローカルWorkerへ接続するときは、
設定画面の「開発用API」へPCのLAN内URLを指定できます。

```bash
npx expo start
```

preview／productionビルドでは設定画面からAPI URLを変更できません。公開候補URLは
`eas.json` の `EXPO_PUBLIC_API_BASE_URL` に固定しています。

## 検証

```bash
npm test
npx expo-doctor
npm --prefix worker run db:migrate:local
npm --prefix worker run test:smoke
npm --prefix worker run deploy:dry-run
```

`npm test` はAndroid純ロジック、PWA、Workerの型チェックとユニットテストをまとめて実行します。
`test:smoke` はローカルD1を使い、認証・同期競合・クォータ・削除・CORSを実APIで通します。

## 自己テスト環境

- Worker: <https://bookreader-api.hamasan.workers.dev>
- プライバシーポリシー: <https://bookreader-api.hamasan.workers.dev/privacy>
- アカウント削除: <https://bookreader-api.hamasan.workers.dev/account/delete>

匿名認証・同期・削除は稼働済みです。Anthropic、Google TTS/Vision、Google OAuthは
各サービスの資格情報をWorkerへ登録してから実機テストを開始します。
検証済みWorker versionは `862ec736-79e1-4fd9-9ab2-f28e349251fb` です。

## Androidビルド

```bash
npx eas build --platform android --profile preview
npx eas build --platform android --profile production
```

- `preview`：本人テスト用の署名付きAPK
- `production`：Play用AAB

既存APKへ上書きするため、既存ビルドと同じAndroid keystoreを必ず再利用してください。
自己テストに合格するまでPlay Consoleへアップロードしません。

詳細は [デプロイ手順](docs/deployment.md) と
[14日間の自己テスト](docs/self-test.md)、
[Obsidian連携](docs/obsidian-integration.md)、
[依存関係セキュリティ監査](docs/security-audit.md) を参照してください。
