# Obsidian連携

READING NOTEのAndroid版は、Obsidian公式のカスタムURIを使って、1冊分の読書ノートを
Vaultへ書き出す。端末のファイル領域へ直接アクセスせず、Obsidianアプリへ処理を渡すため、
Expo Goと通常のAPKのどちらでも同じ実装を使える。

公式仕様: <https://obsidian.md/help/Extending%2BObsidian/Obsidian%2BURI>

## 使い方

1. Android端末へObsidianをインストールし、対象Vaultを一度開く。
2. READING NOTEの「設定」→「Obsidian連携」でVault名を入力する。
   空欄の場合は、Obsidianで最後に開いたVaultを使う。
3. 「Obsidianを開いて接続確認」で対象Vaultが開くことを確認する。
4. 本棚から本のノートを開き、「Obsidianへ書き出す」を押す。
5. 同名ノートを置き換える確認に同意すると、`READING NOTE/<書名>.md` が作成・更新される。

## 書き出す内容

- YAML frontmatter（出力元、作成日、出力日時、Book ID、種別、ISBN、タグ）
- 書誌情報、表紙リンク、星評価、読了日
- 読む目的
- ドッグイヤーのページ、行、引用、コメント
- まとめ
- ふりかえり
- デジタルリンク

論理削除済みのドッグイヤーとリンクは出力しない。端末に取り込んだPDF本文そのものは、
読書ノートの範囲を超え、ファイルサイズも大きいため出力しない。

## 安全性と制約

- バックグラウンド自動書き込みはしない。ユーザーが本ごとに実行したときだけ送る。
- 同名ノートの更新はObsidian側の追記も置き換えるため、実行前に確認を表示する。
- 短いノートはURIの`content`で渡し、長いノートはクリップボードと`clipboard=true`で渡す。
- Vault名は端末設定にだけ保存し、クラウド同期の対象にはしない。
- Obsidian Syncは別サービスであり、この機能はVault内ノートの作成・更新までを担当する。
- OSからObsidianへの引き渡し後、実際のファイル保存完了をREADING NOTE側から読み戻すことはできない。
