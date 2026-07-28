# 認証・同期アーキテクチャ

## 信頼境界

AndroidとPWAはプロバイダーキーを持たず、すべてのAIリクエストをWorkerへ送る。
WorkerはBearerセッション、入力上限、利用者クォータ、全体予算を確認してから
Anthropic／Googleへ接続する。

- Android：Workerへ直接接続
- PWA：Workerから匿名トークンを取得し、AIリクエストもWorkerへ直接送信
- Vercel Functions：旧URL互換のためAuthorizationと本文をWorkerへ転送するだけ
- D1：ユーザー、セッション、同期データ、クォータ、OAuth単回状態
- KV：公開情報であるGoogle JWKSのキャッシュだけ

## API契約

- `POST /v1/auth/anonymous` → `{userId, token}`
- `GET /v1/account`
- `POST /v1/sync` → `{cursor, changes, hasMore, fullResync?}`
- `POST /v1/auth/google/start|complete|resolve`
- `POST /v1/auth/signout`
- `POST /v1/account/deletion-ticket`
- `DELETE /v1/account`
- `/api/generate-summary|quiz|tts|ocr`
- `GET /account/delete`
- `GET /privacy`

エラー本文は常に `{error:string}`。要約だけ成功時はplain textストリーム。
TTSは `parts` キーの有無で分岐し、秘密鍵未設定時の `{fallback:true}` を維持する。
サインアウトは復元先を持つGoogle連携済みアカウントだけに許可する。アカウント削除は
旧アカウントを物理削除してから、クライアントが通常の匿名発行制限を通って再開する。

## 同期

Book、DogEar、DigitalLinkを別ドメイン行として保存する。クライアント時計では
カーソルを作らず、D1で利用者ごとの `rev` を採番する。

- push：最大100変更
- pull：最大500変更
- 通常競合：`updatedAt` のLWW
- 同時刻：tombstone、その後 `originDeviceId`
- `lastSentenceIdx`：常にMAX
- 未来へ5分を超える時刻：サーバー側で正規化
- tombstoneと変更履歴：90日
- 古いcursor：全スナップショットを返す
- アカウント切替時：内部の`forceFull`でサーバー正本を強制取得

取り込み本文、端末URI、音声・画像キャッシュは同期しない。別端末でcontent本を
復元した場合は書誌とREADING NOTE部分だけが戻り、本文は再取り込みする。
アカウント統合時だけ、同じID・ISBN・書名と作成日時で対応づけられた端末本文を
新しい正規レコードへ引き継ぐ。クラウド側だけを選んだ場合は引き継がない。

## Google連携

OAuth redirectはWorkerのHTTPS callbackだけ。Android OAuth SDKやクライアント
シークレットは使わない。

アプリが256bit ticketを生成し、WorkerはそのハッシュをD1へ保存する。認証コードは
Workerだけが受け取り、アプリはticketで結果をポーリングする。OAuth state、nonce、
PKCE、IDトークンの署名・aud・iss・expを検証する。

既存Googleユーザーとの衝突時は自動統合せず、冊数を表示して次から選ぶ。

1. まとめる：Google側を正規ユーザーとし、同じISBNを統合
2. クラウド側だけ使う：端末側を明示確認後に削除
3. やめる：変更しない

新セッションはSecureStore内の一時キーへ先に保存する。統合・切替・端末消去の途中で
プロセスが終了した場合は、次回起動時にサーバー正本の取得または端末消去を完了してから
通常同期を再開する。

ウェブから削除されるなどしてBearerセッションが無効になった場合、クライアントは
自動再発行しない。端末に残る記録を新しい匿名アカウントへ移すか、端末記録も削除するかを
設定画面で明示的に選ばせる。これにより、ウェブ削除直後の自動同期で削除済みデータを
別アカウントへ再作成しない。

## 費用保護

- 匿名発行：IPのHMAC単位で5件/時
- ウェブ削除用Google OAuth開始：IPのHMAC単位で5件/時
- アプリのGoogle OAuth：同一ユーザーの有効フローは最大5件
- 要約20件/日、クイズ40件/日
- TTS 100,000文字/日、OCR 200枚/日
- 全体上限：2 USD/日、20 USD/月

本文、画像、Bearer、OAuthトークン、プロバイダーキーはログへ出さない。
JSONと公開削除フォームはContent-Lengthの有無に依存せずストリーム読取中に上限を適用する。
