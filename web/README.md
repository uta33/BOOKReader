# BOOKReader (Web)

ビジネス書の **AI要約台本**を聴き、**自分の言葉でふりかえり**、**間隔反復**で身につける
mobile-first PWA。競合の「15分要約を受動的に消費する」モデルの弱点（受動消費・間隔反復の欠如・
流暢性の錯覚）を、学習科学にもとづく2つの仕組みで補うことを狙いとしています。

- **効果#2 — 言い換え/生成効果（elaboration）**: 読了後に自分の言葉で要約し、適用方法を書き出す
- **効果#3 — 間隔反復（spaced repetition）**: 1日/3日/1週/2週/1ヶ月の Leitner 方式で能動的想起

## コンテンツの取り込み
- **AI生成**: 書名/トピックを指定 → Claude が要約台本を生成（サーバ経由）
- **台本取り込み**: 既成の要約テキストを貼り付け

PDFの取り込みは行いません。

## 構成
- フロント: Vite + React 19 + TypeScript + Zustand（localStorage 永続化）/ PWA
- 音声: 文単位で IndexedDB にキャッシュ。Google Cloud TTS（サーバ経由）→ 無ければブラウザ内蔵の
  SpeechSynthesis → さらに無ければ時間送り、の順でフォールバック
- バックエンド: `server/`（ローカル開発用 Express）と `api/`（Vercel/Cloudflare 互換のサーバレス関数）が
  `server/lib/` を共有。**APIキーはサーバ側のみ**で、ブラウザには出しません。

## セットアップ
```bash
cd web
npm install
cp .env.example .env   # ANTHROPIC_API_KEY / GOOGLE_TTS_API_KEY（任意）を設定
npm run dev            # Vite(5173) と API(8787) を並走。/api は Vite が 8787 にプロキシ
```

キー未設定でも動作します（AI生成はサンプル台本、音声はブラウザ内蔵音声にフォールバック）。

## スクリプト
- `npm run dev` — フロント＋APIを並走
- `npm run build` — 型チェック＋本番ビルド（PWA生成）
- `npm run typecheck` — `tsc --noEmit`
- `npm run preview` — ビルド成果物のプレビュー

## 環境変数（サーバ側のみ）
- `ANTHROPIC_API_KEY` — Claude（要約台本生成）。未設定時はサンプル台本を返す
- `GOOGLE_TTS_API_KEY` — Google Cloud TTS。未設定時はブラウザ内蔵音声にフォールバック
- `API_PORT` — ローカルAPIのポート（既定 8787）

## 補足
- Claude は `claude-opus-4-8` を使用。インストール済み SDK (0.70.x) の型が adaptive thinking 未対応の
  ため、要約生成では `thinking` パラメータを指定していません（要約用途では品質に影響なし）。
- 既存の Expo/React Native 版（リポジトリ直下の `src/`）はそのまま温存しています。
