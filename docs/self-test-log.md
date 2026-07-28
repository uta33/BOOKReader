# 自己テスト記録

開始日: 未開始

アプリ／Worker実装commit: `82289340a2b8d8c79e08ddaa80b56a3fb3f52719`

Worker version: `862ec736-79e1-4fd9-9ab2-f28e349251fb`

APK証明書SHA-256: EASログイン後に記入

## 自動preflight（2026-07-28）

- [x] ルート／PWA／Workerの型検査とユニットテスト
- [x] Expo Doctor 20/20
- [x] PWA本番ビルド
- [x] Worker dry-run bundle
- [x] Android JavaScript/Hermes export
- [x] Android exportへ公開Worker URLを埋め込み
- [x] `AIza`、`sk-ant-`、旧TTS環境変数名がAndroid exportに無い
- [x] ローカルD1 smoke test
- [x] 公開D1 smoke test
- [x] LWW、読書位置MAX、2端末相当のDogEar和集合
- [x] 要約20件成功、21件目429、`Retry-After`
- [x] アプリ内削除、旧token 401、匿名コードによるウェブ削除
- [x] ウェブ削除後の401で匿名セッションを自動再発行しない
- [x] Worker自身の削除フォームを同一オリジンCORSで許可
- [x] 匿名アカウントのサインアウト拒否と匿名再発行枠の迂回防止
- [x] 別APAC D1へのexport/import復元（user/book/DogEar/tombstone各1）
- [x] 復元用一時D1と本番試験データを削除し、本番D1 0ユーザーへ復帰
- [x] 最終Worker版の公開smoke後、D1のuser/session/domain/quota/試験制限行が0件

## 開始ブロッカー

- [ ] Anthropic Secret
- [ ] Google TTS/Vision Secret
- [ ] Google Web OAuth client ID/Secret
- [ ] プライバシーポリシー問い合わせ先
- [ ] EASログインと既存keystore照合
- [ ] 署名付きpreview APK

## 14日運用

| 日付 | 累計冊数 | 同期・復元 | AI利用量／費用 | 5xx | 障害・修正 |
|---|---:|---|---|---:|---|
| | | | | | |

## 実機シナリオ

- [ ] 紙／JAN本5冊
- [ ] content本2冊
- [ ] 合計10冊
- [ ] ドッグイヤー20件／3冊
- [ ] 2実機の和集合
- [ ] 読書位置MAX
- [ ] オフライン復帰
- [ ] Google再インストール復元
- [ ] 旧APK上書き
- [ ] 統合三択
- [ ] サインアウト
- [ ] アプリ内削除
- [ ] ウェブ削除
- [ ] 最終候補からの一時D1復元
- [ ] APK秘密値スキャン

## 合否

- [ ] 連続14日
- [ ] 未解決S0／S1なし
- [ ] 日額2 USD／月額20 USD以内
- [ ] Play内部テストへ進める
