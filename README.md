# BOOKReader

PDF / TXT ファイルを Google Cloud Text-to-Speech で日本語読み上げする React Native アプリ。

## 機能

- **PDF / TXT インポート** — ドキュメントピッカーからファイルを選択し、テキストを自動抽出
- **Google Cloud TTS** — 5種類の日本語音声（Standard / Neural2）で読み上げ
- **音声コントロール** — 再生・一時停止、前後スキップ、速度切替（0.5x〜2.0x）、ピッチ調整
- **文単位ハイライト** — 読み上げ中の文をハイライト表示、タップで任意の文にジャンプ
- **音声キャッシュ** — 生成済み音声をローカルに保存し、再生成を回避
- **ライブラリ管理** — 読書進捗の記録、長押しで書籍と音声キャッシュを削除
- **設定画面** — 音声選択（性別フィルター付き）、試聴、速度・ピッチ設定

## 技術スタック

- **Expo SDK 53** / React Native 0.79 / React 19
- **Expo Router** — ファイルベースルーティング
- **Zustand** — 状態管理（AsyncStorage 永続化）
- **expo-av** — 音声再生・バックグラウンド再生
- **TypeScript** (strict mode)

## セットアップ

### 前提条件

- Node.js 20+
- Google Cloud Text-to-Speech API キー

### インストール

```bash
git clone <repository-url>
cd BOOKReader
npm install --legacy-peer-deps
```

### 環境変数

`.env.example` をコピーして `.env` を作成し、API キーを設定:

```bash
cp .env.example .env
```

```
EXPO_PUBLIC_GOOGLE_TTS_API_KEY=your-api-key-here
```

### 起動

```bash
npx expo start
```

## ビルド

### Android (EAS Build)

```bash
npx eas build --platform android --profile preview
```

### GitHub Actions

`main` ブランチへの push で自動ビルドが実行されます。  
GitHub Secrets に `GOOGLE_TTS_API_KEY` と `EXPO_TOKEN` の設定が必要です。

## プロジェクト構成

```
src/
├── app/                    # Expo Router 画面
│   ├── _layout.tsx         # ルートレイアウト
│   ├── index.tsx           # ホーム（ライブラリ）
│   ├── reader/[id].tsx     # リーダー画面
│   └── settings.tsx        # 設定画面
├── components/             # UI コンポーネント
│   ├── library/            # BookCard, EmptyLibrary
│   ├── player/             # PlayerBar
│   └── reader/             # TextDisplay, PageIndicator, LoadingOverlay, SentenceBlock
├── constants/              # 定数（カラー、音声、速度）
├── hooks/                  # カスタムフック
│   ├── useAudioPlayer.ts   # 音声再生制御
│   ├── useAudioSession.ts  # オーディオセッション設定
│   ├── usePdfExtraction.ts # ファイルインポート
│   └── useTTSCache.ts      # TTS 音声キャッシュ
├── services/               # ビジネスロジック
│   ├── googleTTS.ts        # Google Cloud TTS API 連携
│   ├── pdfExtractor.ts     # PDF/TXT テキスト抽出
│   └── sentenceSplitter.ts # 文分割
├── store/                  # Zustand ストア
│   ├── libraryStore.ts     # ライブラリ管理
│   ├── readerStore.ts      # リーダー状態
│   └── settingsStore.ts    # 設定
└── types/                  # TypeScript 型定義
```
