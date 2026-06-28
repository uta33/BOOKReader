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

## スマホで使う（HTTPS公開 → ホーム画面に追加）

スマホでアプリのように使うには、HTTPSで公開してからスマホのブラウザで開き、ホーム画面に追加します。
HTTPS公開なら全画面・オフライン（PWA）で動作し、APIキーもサーバ側に安全に置けます。

### Vercel に公開する（おすすめ）
`web/api/` はVercelのサーバレス関数形式で実装済みなので、そのまま公開できます。

**ダッシュボードから:**
1. [vercel.com](https://vercel.com) で GitHub リポジトリ `uta33/BOOKReader` をインポート
2. プロジェクト設定で **Root Directory = `web`** を指定（Framework は自動で Vite）
3. **Environment Variables** に登録（サーバ側のみ・ブラウザには出ません）:
   - `ANTHROPIC_API_KEY` … Claude（AI要約生成）。未設定でもサンプル台本で動作
   - `GOOGLE_TTS_API_KEY` … 高品質音声（任意）。未設定はブラウザ内蔵音声
4. **Deploy** → 払い出された `https://<your-app>.vercel.app` を使う

**CLI から:**
```bash
cd web
npx vercel            # 初回: Root を web に、設定に従う（プレビュー公開）
npx vercel --prod     # 本番公開
# 環境変数は: npx vercel env add ANTHROPIC_API_KEY
```

### スマホでホーム画面に追加
- **iPhone (Safari)**: 公開URLを開く → 共有ボタン → 「ホーム画面に追加」
- **Android (Chrome)**: 公開URLを開く → メニュー(⋮) → 「アプリをインストール」/「ホーム画面に追加」

追加後はアイコンから全画面起動でき、一度開いた内容は機内/オフラインでも閲覧・復習できます。

### 代替: 同一Wi-FiのPCから（動作確認用）
PCで `npx vite --host` を起動し、スマホのブラウザで `http://<PCのIP>:5173` を開く。
ただし `http://` のLANはセキュアコンテキストでないため、**PWAのインストール／オフラインは不可**
（ブラウザ内での通常利用のみ）。フル機能はHTTPS公開（上記）が必要です。

> Cloudflare Pages を使う場合、Functions のシグネチャ（`onRequestPost`）が Vercel と異なるため
> `functions/` 用のアダプタが別途必要です（本リポジトリでは未対応）。

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
