# BOOKReader — READING NOTE

天狼院書店／海の出版社の「リーディング・ノート（READING NOTE）」の仕組みを
Android アプリにしたもの。紙の本と取り込みコンテンツを同じ本棚で扱う。

> **出典について**
> 仕組みの理解は公開情報からの再構成で、原典と細部が異なる可能性があります。

## 仕組み

- **マガジンノート** — 1冊＝1見開き。ノート1冊で48冊、通算100冊で1周
- **ドッグイヤー抜き書き** — 折ったページの P（ページ）と L（行）＋線を引いた箇所を書き写す
- **デジタルリンク** — その本についての AI 対話やドキュメントの URL を紐づける
- **100冊のゲーム化と10の目的** — 通算100冊・月8冊のペース・目的別の達成度

## 機能

- **JANコードで登録** — 本の裏表紙のバーコード（ISBN-13）を読み取り、
  openBD／国立国会図書館サーチから書名・著者・書影を引く。手入力も可
- **マガジンノート** — 抜き書き・まとめ・ふりかえり・評価・リンク・読了を1画面に集約
- **進捗** — 100冊を 10×10 のマス目で表示（10の目的 × 10冊）
- **PDF / TXT 取り込みと読み上げ** — Google Cloud TTS の日本語音声、
  文単位ハイライト、速度・ピッチ調整、音声キャッシュ、バックグラウンド再生
- **AI要約（任意）** — サーバーURLを設定すると「まとめ」を AI に書かせられる

## 技術スタック

- **Expo SDK 53** / React Native 0.79 / React 19
- **Expo Router** — ファイルベースルーティング（タブ ＋ スタック）
- **Zustand** — 状態管理（AsyncStorage 永続化）
- **expo-camera** — JANコード（EAN-13）スキャン
- **expo-av** — 音声再生・バックグラウンド再生
- **TypeScript** (strict mode)

## セットアップ

### 前提条件

- Node.js 20+
- Google Cloud Text-to-Speech API キー（読み上げを使う場合）

### インストール

```bash
git clone <repository-url>
cd BOOKReader
npm install --legacy-peer-deps
```

### 環境変数

```bash
cp .env.example .env
```

| 変数 | 必須 | 用途 |
|---|---|---|
| `EXPO_PUBLIC_GOOGLE_TTS_API_KEY` | 読み上げを使うなら | Google Cloud TTS |
| `EXPO_PUBLIC_API_BASE_URL` | 任意 | AI要約サーバー。未設定なら要約機能を出さない（設定画面から上書き可） |

書誌の照会（openBD／NDLサーチ）は**キー不要**なので、何も設定しなくても
JANコードでの登録は動く。

### 起動

```bash
npx expo start
```

`expo-camera` は Expo Go のバンドルに含まれるので、開発は Expo Go のままできる。

## 検証

```bash
npm run typecheck   # tsc --noEmit
npm run test:unit   # 純ロジックのユニットテスト
npm test            # 上の両方
```

テストはフレームワークを使わず、`tsx` で `.mts` を直接実行する
（`web/tests/unit/` と同じ流儀）。対象は `react-native` を import しない
純モジュールに限る — 蔵書データの移行、100冊の集計、ISBN の検証、
書誌レスポンスの整形、要約の整形。

> `typedRoutes` の型は dev server が `.expo/types` に生成し、`.expo/` は
> gitignore されている。**ルートを追加・移動したあとは一度 `npx expo start` を
> 回してから型チェックする**こと。そうしないとルート文字列の誤りを検出できない。

手で確かめるべきこと:

- 本の**上段**（978…）のバーコードで登録できる／**下段**（192…）を読むと専用の案内が出る
- カメラを拒否しても手入力で登録できる
- アプリを終了→再起動しても抜き書きが残っている
- 旧バージョンの APK からの上書きインストールで既存の本が消えない

## ビルド

### Android (EAS Build)

```bash
npx eas build --platform android --profile preview   # APK
```

### GitHub Actions

`main` への push で自動ビルド。GitHub Secrets に `GOOGLE_TTS_API_KEY` と
`EXPO_TOKEN` が必要。

## プロジェクト構成

```
src/
├── app/                      # Expo Router 画面
│   ├── _layout.tsx
│   ├── (tabs)/               # ホーム / 本棚 / 進捗 / 設定
│   ├── book/scan.tsx         # JANコードのスキャン
│   ├── book/new.tsx          # 紙の本の登録・確認フォーム
│   ├── note/[id].tsx         # マガジンノート（1冊1見開き）
│   ├── dogear/[bookId].tsx   # ドッグイヤー抜き書きの入力・編集
│   └── reader/[id].tsx       # 読み上げリーダー
├── components/
│   ├── common/               # ScreenHeader, PurposeChips, StarRating, StatBar, DotGrid
│   ├── note/                 # NoteSection, DogEarRow, LinkRow, AddLinkModal
│   ├── library/              # BookCard, EmptyLibrary
│   ├── player/               # PlayerBar
│   └── reader/               # TextDisplay, PageIndicator, LoadingOverlay, SentenceBlock
├── constants/                # colors（紙・墨・藍・朱）, typography, purposes, readingNote
├── hooks/
├── services/                 # isbn, bookLookup, libraryMigration, readingProgress,
│                             # bookFactory, summaryApi, summaryParser, googleTTS, …
├── store/                    # libraryStore, readerStore, settingsStore
└── types/
tests/unit/                   # tsx で直接実行するユニットテスト
web/                          # 別アプリ（Vite製PWA）。AI要約APIの供給元
```

`web/` は同名の別アプリで、このリポジトリに同居している。Android アプリは
その `/api/generate-summary` を呼ぶだけで、`web/` 自体には依存しない。
