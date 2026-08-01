# 自己テスト記録

開始日: 未開始（2026-08-01に単体preview APKを生成。AIプロバイダー設定後に14日計測を開始）

アプリ実装commit: `d0b31c34e0d4e5c2dbc09ef8fc7f5fda56fb5336`

Worker実装commit: `82289340a2b8d8c79e08ddaa80b56a3fb3f52719`

Worker version: `05d25035-c207-41b5-b78e-2924f0ac97fe`

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

### 実機表示修正版 1.0.2

- 実機発見: 選択中のNeural2音声カードで主ラベルが白背景と同色になり、文字が消える
- 原因: `voiceLabelSelected` が濃色背景用の `COLORS.onAccent` を使用していた
- 修正: 選択ラベルを `COLORS.accentBright` に変更し、内部名Cの男性Neural2を「男性C」と表示
- 回帰: 音声ID／表示名の一意性と音声記号一致テストを追加
- package / version: `com.uta33.bookreader` / `1.0.2` (`versionCode 3`)
- 署名: 1.0.1と同じ証明書SHA-256を確認
- APK SHA-256: `73787C18773F2CFA1F0DF6D49F181D57B8C8CCF2A67E91F0A9A3B176ACD66AC6`
- ローカル成果物: `.expo/BOOKReader-1.0.2-voice-fix.apk`（git管理外）
- 検証: `npm test`、Expo Doctor 20/20、Android export、ローカルEAS release build
- 既知制約: TTS試聴はWorkerのGoogle TTS Secret設定まで「音声サーバーが設定されていません」となる

### 正式名称・アイコン版 1.1.0

- 表示名: `BOOKReader` から `READING NOTE` へ統一
- アイコン: 読書ノート、栞、ドッグイヤーを紙・藍・朱で表現した新規アイコン
- Android: 通常、round、adaptive、Android 13+ monochrome資源をAPK内で確認
- package / version: `com.uta33.bookreader` / `1.1.0` (`versionCode 4`)
- 署名: 1.0.1／1.0.2と同じ証明書SHA-256を確認
- APK SHA-256: `BABC68BB4478736D649AE7B0C37C10C6960E6A0F9D5D8E3E273BBDF3F1A3D3AA`
- ローカル成果物: `.expo/READING-NOTE-1.1.0-preview.apk`（git管理外）
- 検証: `npm test`、Expo Doctor 20/20、PWA本番ビルド、Worker dry-run、Android export、ローカルEAS release build
- APK展開検査: `AIza` 0件、`sk-ant-` 0件、旧TTS環境変数名 0件、公開Worker URLあり
- 互換性: Expo slug、URL scheme、Android package、保存キー、バックアップenvelopeは変更なし

### アイコン余白・TTS復旧版 1.1.1

- 実機発見: Androidの円形マスクでアダプティブアイコンの本が大きく見え、外周に詰まっていた
- 修正: foreground／monochromeを従来比82%へ縮小し、表示領域を約678×612pxから556×502pxへ変更
- package / version: `com.uta33.bookreader` / `1.1.1` (`versionCode 5`)
- 署名: 1.1.0と同じ証明書SHA-256を実APKで確認
- APK SHA-256: `BEEB03E4F6304E2D16F224F1FA6C0330816F6C0623B3FBA6F053E68DFD82E24D`
- ローカル成果物: `.expo/READING-NOTE-1.1.1-preview.apk`（git管理外）
- 検証: `npm test`、Expo Doctor 20/20、ローカルEAS release build、APK v2署名、package/version
- APK展開検査: `AIza` 0件
- 公開Worker実通信: Google TTSを制限付きAPIキーで有効化し、匿名発行 → TTS音声生成 → 試験アカウント削除まで成功
- Google OAuth: Worker callback URIと新しいclient secretを設定し、認証開始200、client ID／redirect URI／PKCE／state／nonceを確認
- Google認可画面: `redirect_uri_mismatch`なしでアカウント選択画面まで到達（試験ではアカウントを選択せず、紐付けは未実施）

### アイコン参照・書影自動補完版 1.1.2

- 実機申告: アイコンが旧デザインへ戻って見える状態と、表紙が入らない本を確認
- 原因: Android用アイコン資産は現行版だったが、Web版のMedia Sessionだけ旧`icon-*-v2.png`を参照していた
- 修正: Android／PWA／通知・ロック画面を`icon-reading-note-*`へ統一し、更新キャッシュを避けるためversionCodeを更新
- 書影: openBDの書影を優先し、未収録時はOpen Library Covers APIをISBNで照会
- 新規本: ISBN照会画面に書影プレビューを表示し、登録データへ保存
- 既存本: 本棚に表示されたカードだけ書影を補完し、取得成功時に端末保存とクラウド同期へ反映
- package / version: `com.uta33.bookreader` / `1.1.2` (`versionCode 6`)
- 署名: 1.1.1と同じ証明書SHA-256を実APKで確認
- APK SHA-256: `C784ED977C3343401C6FE125495E143820A974549FDAE07D10D3066774B3D8D9`
- ローカル成果物: `.expo/READING-NOTE-1.1.2-preview.apk`（git管理外）
- 検証: `npm test`、Expo Doctor 20/20、ローカルEAS release build、APK v2署名、package/version、配布URL 200
- APK展開検査: `AIza` 0件、`GOCSPX` 0件、公開Worker URLあり
- アイコン展開検査: APK内の通常／adaptive foreground／monochrome資産を抽出し、現行デザインを目視確認

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
- [x] Google TTS/Vision Secret（TTS/Visionだけに制限した既存キーをWorkerへ登録）
- [x] Google Web OAuth client ID/Secret
- [ ] プライバシーポリシー問い合わせ先
- [x] EASログインと既存keystore照合
- [x] 署名付きpreview APK

## 14日運用

| 日付 | 累計冊数 | 同期・復元 | AI利用量／費用 | 5xx | 障害・修正 |
|---|---:|---|---|---:|---|
| 2026-08-01 | 未記録 | 未実施 | 0／0 USD | 0 | 選択音声ラベル欠落を発見し1.0.2で修正。14日計測は未開始 |

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
