# 自己テスト記録

開始日: 未開始（2026-08-01に単体preview APKを生成。AIプロバイダー設定後に14日計測を開始）

アプリ実装commit: `d0b31c34e0d4e5c2dbc09ef8fc7f5fda56fb5336`

Worker実装commit: `82289340a2b8d8c79e08ddaa80b56a3fb3f52719`

Worker version: `862ec736-79e1-4fd9-9ab2-f28e349251fb`

APK証明書SHA-256: `24410654cbfb391f638346cceba9374179783be5afffc87287b204a64efa2b3b`

## 単体preview APK（2026-08-01）

- EAS build: `bb4aa4b5-a667-4ed6-8f8e-3837dfc44745`
- build page: <https://expo.dev/accounts/utasan0811/projects/bookreader/builds/bb4aa4b5-a667-4ed6-8f8e-3837dfc44745>
- package / version: `com.uta33.bookreader` / `1.0.1` (`versionCode 2`)
- Expo SDK: `57.0.0`
- 署名: 既存の `Build Credentials 1b-OEwqqm3 (default)` を再利用
- APK SHA-256: `1D03D3C2F24E95CAF8B253C9AE53AD20EFE003691621E4400F3ADF556E5FDB7A`
- ローカル成果物: `.expo/BOOKReader-1.0.1-preview.apk`（git管理外）
- 公開Worker実通信: health → 匿名発行 → account取得 → 空sync → account物理削除まで成功
- APK展開検査: Worker URL 1件、`AIza` 0件、`sk-ant-` 0件、旧TTS環境変数名 0件

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

## 完全機能テストの開始ブロッカー

- [ ] Anthropic Secret
- [ ] Google TTS/Vision Secret
- [ ] Google Web OAuth client ID/Secret
- [ ] プライバシーポリシー問い合わせ先
- [x] EASログインと既存keystore照合
- [x] 署名付きpreview APK

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
- [x] APK秘密値スキャン

## 合否

- [ ] 連続14日
- [ ] 未解決S0／S1なし
- [ ] 日額2 USD／月額20 USD以内
- [ ] Play内部テストへ進める
