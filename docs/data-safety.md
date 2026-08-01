# Google Play データセーフティ回答メモ

公開時は実際の本番設定と照合してPlay Consoleへ転記する。

## 収集・共有

- アカウント情報：Google連携時のメールアドレスとGoogle user ID
- アプリ内コンテンツ：書誌、読書ノート、抜き書き、利用者が添付した画像、リンク、評価
- アプリの操作：AI利用件数と同期revision
- 診断：最小限のエラー情報

読書記録はアプリ機能提供のため収集する。広告、販売、行動ターゲティングには使わない。
Anthropic、Google Cloud、Cloudflareへの処理委託は、Playの定義と最新の契約内容に
基づいて「共有」の回答を最終確認する。

## セキュリティと削除

- 通信はHTTPS
- AndroidのセッショントークンはSecureStore
- サーバーはトークンハッシュだけを保存
- アプリ内削除導線あり
- 外部削除URLあり
- 稼働中データは物理削除、災害復旧履歴は保持期限後に失効
- 添付画像は認証付き非公開R2に保存し、公開URLを発行しない

## 公開前確認

- [x] 公開プライバシーポリシーURL
- [x] `/account/delete` の未ログイン動作
- [ ] Google本人確認による削除
- [x] 匿名削除コードによる削除
- [ ] 問い合わせ先
- [ ] Anthropic／Google／Cloudflareの最新データ処理条件

公開URL:

- `https://bookreader-api.hamasan.workers.dev/privacy`
- `https://bookreader-api.hamasan.workers.dev/account/delete`
