# 自己テスト記録

開始日: 未開始（2026-08-01に単体preview APKを生成。AIプロバイダー設定後に14日計測を開始）

アプリ実装commit: `c877b4eb188f7a97c3e1fc04d92e45735307d469`

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
- EAS build: `43ac1cc0-7866-4bce-b573-61b72dbd35d1`（status `FINISHED`、2026-08-15まで）
- build page: <https://expo.dev/accounts/utasan0811/projects/bookreader/builds/43ac1cc0-7866-4bce-b573-61b72dbd35d1>
- 検証: `npm test`、Expo Doctor 20/20、ローカルEAS release build、APK v2署名、package/version、配布URL 200
- APK展開検査: `AIza` 0件、`GOCSPX` 0件、公開Worker URLあり
- アイコン展開検査: APK内の通常／adaptive foreground／monochrome資産を抽出し、現行デザインを目視確認

### Android Obsidian連携版 1.2.0

- 設定: 任意のObsidian Vault名を端末設定へ保存し、接続確認でVaultまたはVault管理画面を開く
- 本ごとの出力: 書誌、表紙リンク、目的、ドッグイヤー、まとめ、ふりかえり、デジタルリンクをMarkdown化
- 保存先: Vault内の`READING NOTE/<書名>.md`
- 安全策: 同名ノートを`overwrite=true`で更新する前に、Obsidian側の追記も置き換わることを確認
- 長文対策: URIが15,000文字を超えるとクリップボード＋`clipboard=true`へ切り替え
- データ境界: 論理削除済み項目と取り込みPDF本文は出力せず、Vault名はクラウド同期しない
- package / version: `com.uta33.bookreader` / `1.2.0` (`versionCode 7`)
- 署名: 1.2.0以前と同じ証明書SHA-256を実APKで確認
- APK SHA-256: `4E0733233D0C956EBE53C007C97990690A93B13D34D98D5A4398211F4F19D37B`
- ローカル成果物: `.expo/READING-NOTE-1.2.0-obsidian-preview.apk`（git管理外）
- EAS build: `43bd022c-95b1-4519-b2d7-ebd7d30535cc`（status `FINISHED`、2026-08-15まで）
- build page: <https://expo.dev/accounts/utasan0811/projects/bookreader/builds/43bd022c-95b1-4519-b2d7-ebd7d30535cc>
- 検証: `npm test`、Obsidian純ロジックテスト、Android export、Expo Doctor 20/20、ローカル／クラウドEAS build
- APK展開検査: `obsidian://`と`READING NOTE`あり、`AIza` 0件、`GOCSPX` 0件、公開Worker URLあり
- 実機未確認: Obsidian接続、短文作成、同名更新、長文クリップボード経路

### 画像添付・Obsidian埋め込み版 1.3.0

- 抜き書き: カメラ撮影または端末内画像を1件添付し、元比率・無切り抜き・無圧縮で表示
- 端末保存: ImagePickerの一時URIをアプリのdocument領域へコピーし、原本は変更しない
- Obsidian: 初回にAndroidのシステム画面でVaultルートを選択し、永続フォルダ権限を保持
- 保存先: `READING NOTE/<書名>.md` と `READING NOTE/_attachments/<決定的な画像名>`
- Markdown: 各ドッグイヤーへ `![[READING NOTE/_attachments/<画像名>|720]]` を自動挿入
- データ境界: 画像URIは旧データ移行で保持するがCloudflare同期ペイロードには含めず、別端末では再添付
- package / version: `com.uta33.bookreader` / `1.3.0` (`versionCode 8`)
- 署名: 1.2.0以前と同じ証明書SHA-256をローカル／EASの両APKで確認
- ローカルAPK SHA-256: `41D27DB5C3A30D1B41728E8B4EA654CDB0819CE541842566A2E9291F9A0059E1`
- EAS APK SHA-256: `E477D3D1F9F3EF270EBD288D862DBA8BE5A085C3CE4948C47B53013451AC8171`
- ローカル成果物: `.expo/READING-NOTE-1.3.0-images-preview.apk`（git管理外）
- EAS build: `a0b8f651-c307-485f-97e0-1f1d65ad8266`（status `FINISHED`、2026-08-15まで）
- build page: <https://expo.dev/accounts/utasan0811/projects/bookreader/builds/a0b8f651-c307-485f-97e0-1f1d65ad8266>
- 検証: `npm test`、Expo Doctor 20/20、Android export、ローカル／クラウドEAS release build、APK v2署名
- APK展開検査: ImagePicker native moduleあり、画像埋め込み文字列と公開Worker URLあり、`AIza`／`GOCSPX`／`sk-ant-` 0件
- Android manifest: CAMERAあり、旧Android向けREAD/WRITE_EXTERNAL_STORAGEはmaxSdkVersion 32、RECORD_AUDIOなし
- 配布URL: HTTP 200を確認
- 実機未確認: 撮影、画像選択、旧APK上書き、Vaultフォルダ権限、Markdownと画像の同時保存、Obsidian表示

### 目的絞り込み解除修正版 1.3.1

- 原因: `router.setParams({})` は既存の `purpose` パラメータを削除せず、本棚の目的絞り込みが残っていた
- 修正: 「絞り込み中　解除」からパラメータなしの本棚へ `router.replace('/shelf')` し、読み上げ用アクセシビリティラベルも追加
- package / version: `com.uta33.bookreader` / `1.3.1` (`versionCode 9`)
- commit: `7cbf9e6`
- EAS build: `e50d2984-5801-475e-89c1-ef5e0d5bad31`（status `FINISHED`、2026-08-15まで）
- build page: <https://expo.dev/accounts/utasan0811/projects/bookreader/builds/e50d2984-5801-475e-89c1-ef5e0d5bad31>
- APK SHA-256: `C5FBA2A6DF56F89DAB898C3B6798EAEC4F0985614A48C15C1079A83A952102CF`
- 検証: `npm test`、EAS release build、APK v2署名、配布URL HTTP 200
- APK展開検査: 公開Worker URLあり、`AIza`／`GOCSPX`／`sk-ant-` 0件
- 実機未確認: 目的絞り込みの解除、1.3.0からの上書きインストール

### Android PDF取り込み修正版 1.3.2

- 原因: Android側でバイナリPDFをUTF-8文字列として開いていたため、圧縮ストリームを含む一般的なPDFが読み込み段階で失敗していた
- 修正: Expo FileSystemのバイト読み込みとserverless PDF.jsへ切り替え、ページ順に圧縮ストリームと文字対応表を解析
- 安全策: PDFは50MBまで、ページを直列処理し、失敗時にコピー途中のファイルを削除
- エラー区分: 無効なPDF、パスワード保護、画像のみのスキャンPDF、解析不能を別メッセージで案内
- package / version: `com.uta33.bookreader` / `1.3.2` (`versionCode 10`)
- commit: `a0858fb`
- EAS build: `7213afe1-be7e-4e22-8353-81719c6b76a2`（status `FINISHED`、2026-08-15まで）
- build page: <https://expo.dev/accounts/utasan0811/projects/bookreader/builds/7213afe1-be7e-4e22-8353-81719c6b76a2>
- APK SHA-256: `760909269F5EAA76BA514915BE8128702EC93D2982A968DA75386B58A20611E6`
- ローカル成果物: `.expo/READING-NOTE-1.3.2-pdf-fix-preview.apk`（git管理外、126,715,339 bytes）
- 署名: APK v2、既存版と同じ証明書SHA-256 `24410654cbfb391f638346cceba9374179783be5afffc87287b204a64efa2b3b`
- 検証: `npm test`、圧縮バイナリPDFの回帰テスト、Android Hermes export、EAS release build、配布URL HTTP 200
- APK展開検査: 公開Worker URLあり、`AIza`／`GOCSPX`／`sk-ant-`／旧TTS環境変数名 0件
- 実機未確認: 1.3.1からの上書きインストール、報告された実PDFの再取り込み、長い日本語PDFの処理時間

### 大容量PDF・Markdown対応版 1.4.0

- 大容量PDF: 上限を200MBへ拡張し、50MB超は端末ファイルを1MB単位で分割読み込みしてPDF.jsへ渡す
- 安全策: 200MB超はコピー・解析前に拒否し、ページ本文の抽出は従来どおり直列処理
- Markdown: `.md`／`.markdown`を追加し、見出し・本文・リンク表示名を残しながらコード、URL、装飾記号を読み上げ向け本文から除去
- ファイル選択: Androidのファイル管理アプリごとのMarkdown MIME差を避け、選択後に拡張子を厳密検証
- package / version: `com.uta33.bookreader` / `1.4.0` (`versionCode 11`)
- commit: `7b129cb`
- EAS build: `a530f17b-5e44-46de-9b8c-8308cca84406`（status `FINISHED`、2026-08-15まで）
- build page: <https://expo.dev/accounts/utasan0811/projects/bookreader/builds/a530f17b-5e44-46de-9b8c-8308cca84406>
- APK SHA-256: `3C984CC2982857F9E87025B31B3451BF96511D6D6682CCCD757DC752C4A107A9`
- ローカル成果物: `.expo/READING-NOTE-1.4.0-large-pdf-markdown-preview.apk`（git管理外、126,726,851 bytes）
- 署名: APK v2、既存版と同じ証明書SHA-256 `24410654cbfb391f638346cceba9374179783be5afffc87287b204a64efa2b3b`
- 検証: `npm test`、大容量range／200MB上限／Markdown変換の回帰テスト、Expo Doctor 20/20、Android Hermes export、EAS release build、配布URL HTTP 200
- APK展開検査: 公開Worker URL 1件、`AIza`／`GOCSPX`／`sk-ant-`／旧TTS環境変数名 0件
- 実機未確認: 1.3.2からの上書きインストール、実際の50MB超PDF、実Markdown、端末性能ごとの処理時間

### 検索・復習・画像同期・安全共有版 1.6.0

- 横断検索: 書名、著者、出版社、ISBN、書店、まとめ、ふりかえり、目的、抜き書き、コメント、リンクを複数語で検索
- 今日のドッグイヤー: 1日最大5件。「もう一度」は翌日、「覚えた」は1/3/7/14/30/60/120日間隔で再提示
- 接続診断: 同期、AI、TTS、OCR、Google認証、画像バックアップと当日クォータ・概算費用を設定画面で確認
- 画像同期: 端末URIを同期せず、ランダム画像IDをD1、画像本体を認証付き非公開R2へ保存
- 画像上限: 12MB/枚、500枚・250MB/アカウント。SVG、音声、動画は対象外
- アカウント処理: 統合では採用DogEarの画像所有権を移し、クラウド側だけ・アカウント削除ではR2本体も削除
- Obsidian: 管理マーカー内だけを更新し、マーカー外の追記を保持。旧形式は既存内容を残したまま管理範囲を末尾へ追加
- Android共有: Sharesheetから単一のテキスト・URL・画像を受け取り、保存先の本を確認してから抜き書き／リンクへ保存
- package / version: `com.uta33.bookreader` / `1.6.0` (`versionCode 12`)
- implementation commits: `6fb5e9a`、`a8519b9`、`7c986ff`
- Worker: `dbb63d42-2fa2-470b-8d7e-ebfd98836842`
- R2: `bookreader-attachments`、D1 migration `0004_attachments.sql`
- EAS build: `acd9f539-aa15-4bf4-bec9-ebc4297706ca`（status `FINISHED`、2026-08-15まで）
- build page: <https://expo.dev/accounts/utasan0811/projects/bookreader/builds/acd9f539-aa15-4bf4-bec9-ebc4297706ca>
- APK SHA-256: `7585CE8F182EAC01939F928F557242A241C60C4DF2694FABEA513EA0B8F82707`
- ローカル成果物: `.expo/READING-NOTE-1.6.0-preview.apk`（git管理外、126,782,283 bytes）
- 署名: APK v2、既存版と同じ証明書SHA-256 `24410654cbfb391f638346cceba9374179783be5afffc87287b204a64efa2b3b`
- 検証: `npm test`、Expo Doctor 20/20、Android Hermes export、native prebuild、Worker dry-run、ローカル／本番D1+R2 smoke、EAS release build
- 本番smoke: 画像upload/get/delete、診断、TTS provider、LWW、読書位置MAX、DogEar和集合、クォータ、アプリ内／ウェブ削除を通過
- 試験後: 本番D1は開始前と同じ3ユーザー、添付0件、Smoke本0件
- APK展開検査: `SEND text/*`／`image/*`、expo-sharing native module、公開Worker URL 1件、`AIza`／`GOCSPX`／`sk-ant-`／旧TTS環境変数名 0件
- 実機未確認: 1.4.0からの上書き、Android共有3種、別端末の画像復元、Obsidianの追記保持、500枚・250MB到達時の表示

### 紙の本・表紙検索版 1.7.1

- 自動検索: JAN/ISBN登録時にopenBDを優先し、Open LibraryのISBN照会とSearch APIを候補へ追加
- 既存本: 読書ノートの「表紙画像」から再検索し、複数候補を見て選択可能
- 表示: 端末保存画像、同期URL、ISBN直引きの順で本棚と読書ノートにフォールバック表示
- 端末保存: 選択した画像をアプリのdocument領域へ取り込み、5MB/枚・HTTPS・公式2ドメインに限定
- 同期: 公開URLだけをD1へ送り、端末URIは送らない。同じURLの同期更新では端末コピーを保持し、URL変更時は破棄
- 既存データ: `bookreader_library` の素の配列形式を維持し、`coverLocalUri` は任意フィールドとして正規化
- 自動採用: ISBN一致候補だけを採用し、書名だけの曖昧な候補は本人の選択を必須にする
- 通信保護: 書誌・表紙検索と端末取り込みを20秒でタイムアウトし、登録画面が待ち続けない
- package / version: `com.uta33.bookreader` / `1.7.1` (`versionCode 14`)
- 破棄した中間版: EAS `38918907-ca68-4cfa-9992-7a9e0a68542f`（1.7.0 / 13）は最終点検前のため実機テストに使わない
- implementation commit: `e1b99e1`
- EAS build: `cd7f9c53-e098-4021-812b-8785b54b40d7`（status `FINISHED`、2026-08-15まで）
- build page: <https://expo.dev/accounts/utasan0811/projects/bookreader/builds/cd7f9c53-e098-4021-812b-8785b54b40d7>
- APK SHA-256: `9CB3A4F70EECB60912DA0BCCC67AF376A424B390B37E801E415DF11B068B2772`
- ローカル成果物: `.expo/READING-NOTE-1.7.1-cover-preview.apk`（git管理外、126,802,275 bytes）
- 署名: APK v2、既存版と同じ証明書SHA-256 `24410654cbfb391f638346cceba9374179783be5afffc87287b204a64efa2b3b`
- 検証: `npm test`、Expo Doctor 20/20、Android Hermes export、openBD/Open Library実APIでISBN候補3件、EAS release build、配布URL HTTP 200
- APK展開検査: openBD/Open Library/公開Worker URLを確認し、`AIza`／`GOCSPX`／`sk-ant-`／旧TTS環境変数名 0件
- 実機未確認: 1.6.0からの上書き、JAN登録時の自動保存、既存本の候補選択、オフライン再表示、別端末同期後の再取得

### 日本語書影検索強化版 1.8.0（2026-08-02）

- 原因: openBDの`summary.cover`だけではONIX内の書影を取りこぼし、Open LibraryとGoogle Booksの厳密な日本語書名検索も未収録時に候補が空になった
- openBD: ONIX `CollateralDetail.SupportingResource`の表紙（種別01）を追加取得し、商品写真は除外
- Google Books: ISBN完全一致のDynamic Links書影を最優先にし、不在時だけVolumes APIのISBN・書名検索へフォールバック
- 検索品質: 一般検索は正規化後の書名一致候補だけを採用し、無関係な表紙を除外
- セキュリティ: Google CloudでBooks APIを有効化し、Books APIだけに制限した専用キーを`GOOGLE_BOOKS_API_KEY`としてWorker Secretへ登録。APK／Gitには保存しない
- 濫用対策: 認証必須の`GET /v1/books/covers`と利用者ごと100回/UTC日のD1クォータを追加
- D1 migration: `0005_book_cover_quota.sql`を本番へ適用済み
- implementation commit: `dec1ddd`
- Worker version: `64e04a85-7286-48c1-a921-6b9d5c33b260`
- 本番確認: `思考の整理学`（9784480020475）、`こころ`（9784101010137）、`コンビニ人間`（9784167911300）の3冊すべてでISBN完全一致1件・`books.google.com`画像応答成功
- 本番試験データ: D1へ一時セッションを作成して認証経路を通し、各検証後にアカウント削除済み
- package / version: `com.uta33.bookreader` / `1.8.0`（`versionCode 15`）
- EAS build: `f451cbeb-bcdc-47f8-a69e-a2687566ec35`（status `FINISHED`、2026-08-15まで）
- build page: <https://expo.dev/accounts/utasan0811/projects/bookreader/builds/f451cbeb-bcdc-47f8-a69e-a2687566ec35>
- APK SHA-256: `211DF447FD2B5990FCA01C13E0F4A3BF93AA45386F59E32DAEDB09BB737A7073`
- ローカル成果物: `.expo/READING-NOTE-1.8.0-cover-search-preview.apk`（git管理外、126,804,459 bytes）
- 署名: APK v2、既存版と同じ証明書SHA-256 `24410654cbfb391f638346cceba9374179783be5afffc87287b204a64efa2b3b`
- 検証: `npm test`、Expo Doctor 20/20、Android Hermes export、Worker dry-run、本番書影3冊、EAS build、配布URL HTTP 200
- APK展開検査: Google Books／openBD／Open Library／公開Worker URLを確認し、`AIza`／`GOCSPX`／`sk-ant-`／旧TTS環境変数名 0件
- 実機未確認: 1.7.1からの上書き、JAN登録時の自動採用、既存本の候補選択、再起動後の端末保存表紙、別端末同期後の再取得

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
- [x] 公開R2の画像upload/get/deleteとアカウント削除後のD1メタデータ消去
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
- [ ] JAN登録時に表紙が自動表示され、再起動後もオフライン表示
- [ ] 既存の紙の本で「表紙を検索」し、候補を選択して本棚とノートへ反映
- [ ] 別端末へ同期後、公開URLから表紙が再取得される
- [ ] content本2冊
- [ ] 合計10冊
- [ ] ドッグイヤー20件／3冊
- [ ] ドッグイヤーへ撮影画像／端末内画像を添付し、再起動後も表示
- [ ] 別端末で同じ画像が自動復元される
- [ ] Chrome／ギャラリーの共有からテキスト・URL・画像を既存本へ保存
- [ ] Vaultフォルダを選び、Markdownと`_attachments`画像を同時保存
- [ ] Obsidianノートの管理マーカー外へ追記し、再書き出し後も追記が残る
- [ ] Obsidianで図・グラフがノート内に表示
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
