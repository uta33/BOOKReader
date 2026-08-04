# 依存関係セキュリティ監査

実施日: 2026-07-28

## 結果

- Worker: `npm audit --omit=dev` は0件
- Expoルート: 高severityは解消。Expoのビルドツールが経由する旧`uuid`に
  moderateが10件残る
- PWA production dependencies: highが2件。React RouterのRSC Modeに限定された
  CSRF advisory
- PWA全依存: highが9件。上記2件に加え、Workboxのビルド時依存が持つ
  brace expansion DoS advisory

## 到達可能性

PWAは`BrowserRouter`によるクライアントSPAで、React Server Components、Actions、
SSR、React Routerのサーバー処理を使用しない。このためRSC Modeのadvisory対象経路は
本アプリに存在しない。

Workboxの指摘はPWA生成時の開発依存で、配布JavaScriptのリクエスト処理経路ではない。
Expo側の`uuid`もAndroidアプリ実行時ではなく設定・Xcode生成側の依存。監査警告を消す
ための`npm audit fix --force`はExpo 46への破壊的ダウングレードを提示するため実行しない。

## 公開前ゲート

- `npm audit --omit=dev` をルート、`web/`、`worker/`で再実行
- React Router／Workbox／Expoの修正版が出たら通常の互換範囲で更新
- advisoryの影響範囲またはアプリの利用方式が変わった場合は判断を見直す
- 未評価のruntime到達可能なhigh/criticalが残る場合は公開しない

## 2026-08-04再監査

- Expo SDK 57の推奨patch版へ更新後、`npm audit --omit=dev --audit-level=high` は成功
- Expo CLIのビルド時依存に入った`brace-expansion`のhigh advisoryは、互換範囲内の
  `5.0.9`へ更新して解消
- 残る11件はExpo／Xcode設定ツール経由のmoderateで、Androidアプリの実行経路ではない
- `npm audit fix --force`はExpo 46への破壊的ダウングレードを提示するため実行しない
