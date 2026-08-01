# Obsidian連携

READING NOTEのAndroid版は、1冊分の読書ノートをObsidian Vaultへ書き出す。
Androidではシステムフォルダ選択でユーザーが許可したVaultだけへMarkdownと画像を直接保存する。
同名ノートはREADING NOTEの管理マーカー内だけを更新し、マーカー外の手書き追記を残す。
フォルダ直接保存を利用できない環境ではObsidian公式カスタムURIへフォールバックする。
どちらもExpo Goと通常のAPKで利用できる。

公式仕様: <https://obsidian.md/help/Extending%2BObsidian/Obsidian%2BURI>

画像添付・埋め込み仕様:

- <https://obsidian.md/help/attachments>
- <https://obsidian.md/help/embeds>

## 使い方

1. Android端末へObsidianをインストールし、対象Vaultを一度開く。
2. READING NOTEの「設定」→「Obsidian連携」でVault名を入力する。
   空欄の場合は、Obsidianで最後に開いたVaultを使う。
3. 「Vaultフォルダを選ぶ（安全更新・画像対応）」を押し、
   **Vaultのルートフォルダ**を選ぶ。権限はAndroidが保持するため、通常は初回だけでよい。
4. 「Obsidianを開いて接続確認」で対象Vaultが開くことを確認する。
5. 抜き書き編集画面の「図・グラフ・写真」から、撮影または端末内画像を選ぶ。
6. 本棚から本のノートを開き、「Obsidianへ書き出す」を押す。
7. 保存確認に同意すると、次のファイルが作成・安全更新される。

   - `READING NOTE/<書名>.md`
   - `READING NOTE/_attachments/reading-note-<Book ID>-<DogEar ID>.<拡張子>`

## 書き出す内容

- YAML frontmatter（出力元、作成日、出力日時、Book ID、種別、ISBN、タグ）
- 書誌情報、表紙リンク、星評価、読了日
- 読む目的
- ドッグイヤーのページ、行、引用、コメント、図・グラフ・写真
- まとめ
- ふりかえり
- デジタルリンク

論理削除済みのドッグイヤーとリンクは出力しない。端末に取り込んだPDF本文そのものは、
読書ノートの範囲を超え、ファイルサイズも大きいため出力しない。

## 安全性と制約

- バックグラウンド自動書き込みはしない。ユーザーが本ごとに実行したときだけ送る。
- 生成部分は`<!-- READING NOTE:BEGIN -->`と`<!-- READING NOTE:END -->`で囲み、同名更新ではこの範囲だけを置き換える。
- 旧形式の同名ノートに管理マーカーが無い場合は、既存内容を一文字も削除せず、最新の管理範囲を末尾へ追加する。
- 短いノートはURIの`content`で渡し、長いノートはクリップボードと`clipboard=true`で渡す。
- 画像はImagePickerの一時領域ではなくアプリのdocument領域へコピーする。原本は変更・削除しない。
- 図中の文字を保つため、選択時の切り抜きと圧縮を行わず、元の縦横比で表示する。
- 端末URIは同期ペイロードへ入れず、画像本体は認証付きCloudflare R2へバックアップする。別端末では画像IDから端末領域へ復元する。
- Vault名と選択フォルダURIは端末設定にだけ保存し、クラウド同期の対象にはしない。
- フォルダ権限を解除した場合やVaultを移動した場合は、設定から選び直す。
- Obsidian Syncは別サービスであり、この機能はVault内ノートの作成・更新までを担当する。
- URI経路はObsidianへの引き渡し後の保存完了を読み戻せない。フォルダ経路は書き込み完了後にObsidianを開く。
