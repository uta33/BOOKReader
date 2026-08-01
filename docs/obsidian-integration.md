# Obsidian連携

READING NOTEのAndroid版は、1冊分の読書ノートをObsidian Vaultへ書き出す。
テキストだけのノートはObsidian公式カスタムURIを使う。図・グラフ・写真を含む場合は、
Androidのシステムフォルダ選択でユーザーが許可したVaultだけへMarkdownと画像を直接保存する。
どちらもExpo Goと通常のAPKで利用できる。

公式仕様: <https://obsidian.md/help/Extending%2BObsidian/Obsidian%2BURI>

画像添付・埋め込み仕様:

- <https://obsidian.md/help/attachments>
- <https://obsidian.md/help/embeds>

## 使い方

1. Android端末へObsidianをインストールし、対象Vaultを一度開く。
2. READING NOTEの「設定」→「Obsidian連携」でVault名を入力する。
   空欄の場合は、Obsidianで最後に開いたVaultを使う。
3. 画像も書き出す場合は「Vaultフォルダを選ぶ（画像対応）」を押し、
   **Vaultのルートフォルダ**を選ぶ。権限はAndroidが保持するため、通常は初回だけでよい。
4. 「Obsidianを開いて接続確認」で対象Vaultが開くことを確認する。
5. 抜き書き編集画面の「図・グラフ・写真」から、撮影または端末内画像を選ぶ。
6. 本棚から本のノートを開き、「Obsidianへ書き出す」を押す。
7. 同名ノートを置き換える確認に同意すると、次のファイルが作成・更新される。

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
- 同名ノートの更新はObsidian側の追記も置き換えるため、実行前に確認を表示する。
- 短いノートはURIの`content`で渡し、長いノートはクリップボードと`clipboard=true`で渡す。
- 画像はImagePickerの一時領域ではなくアプリのdocument領域へコピーする。原本は変更・削除しない。
- 図中の文字を保つため、選択時の切り抜きと圧縮を行わず、元の縦横比で表示する。
- 画像は端末内だけに保持し、Cloudflare同期ペイロードへ含めない。別端末では画像の再添付が必要になる。
- Vault名と選択フォルダURIは端末設定にだけ保存し、クラウド同期の対象にはしない。
- フォルダ権限を解除した場合やVaultを移動した場合は、設定から選び直す。
- Obsidian Syncは別サービスであり、この機能はVault内ノートの作成・更新までを担当する。
- URI経路はObsidianへの引き渡し後の保存完了を読み戻せない。フォルダ経路は書き込み完了後にObsidianを開く。
