# BOOKReader

PDF・テキストファイルを日本語音声で読み上げるスマートフォンアプリ（iOS / Android）。

Google Cloud Text-to-Speech で音声を生成し、端末にキャッシュするためオフライン再生にも対応。読み上げ中の文はハイライト表示され、画面ロック中もバックグラウンドで再生が続きます。

## 主な機能

- **PDF / TXT インポート**：テキスト選択可能な PDF（デジタル作成）と `.txt` に対応。スキャン画像 PDF は非対応
- **日本語 TTS**：男女5種類の音声（Neural2 / Standard）、速度 0.5×〜2.0×、ピッチ調整
- **文単位ハイライト**：再生中の文を自動ハイライト＆スクロール。タップでその文から再生
- **オフライン再生**：一度生成した音声は端末にキャッシュ
- **複数の本の切り替え**：本ごとに読了位置を記憶し、いつでも再開可能
- **バックグラウンド再生**：画面ロック中も再生継続

## セットアップ

### 1. 必要なもの

- Node.js 18 以上
- Google Cloud アカウント（TTS API用）
- ローカル実行する場合：Android Studio（エミュレーター or 実機）

### 2. インストール

```bash
git clone https://github.com/uta33/BOOKReader.git
cd BOOKReader
npm install --legacy-peer-deps
```

### 3. Google Cloud TTS API キーの取得

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. 「APIとサービス → ライブラリ」で **Cloud Text-to-Speech API** を有効化
3. 「APIとサービス → 認証情報 → 認証情報を作成 → APIキー」でキーを作成
4. **推奨：キーの制限を設定**
   - 「APIの制限」→ Cloud Text-to-Speech API のみに制限
   - 「アプリケーションの制限」→ Android アプリ（パッケージ名 `com.uta33.bookreader`）

### 4. `.env` の作成

プロジェクトルートに `.env` を作成：

```
EXPO_PUBLIC_GOOGLE_TTS_API_KEY=あなたのAPIキー
```

> **⚠️ Windows ユーザーへの重要な注意**
>
> PowerShell の `echo "..." > .env` は UTF-16 でファイルを作るため、**Expo が環境変数を読めず TTS が 403 エラーになります**。必ず以下のコマンドで作成してください：
>
> ```powershell
> Set-Content -Path .env -Value "EXPO_PUBLIC_GOOGLE_TTS_API_KEY=あなたのAPIキー" -Encoding ascii
> ```
>
> `.env` を変更した後は必ずキャッシュをクリアして再起動：
>
> ```bash
> npx expo start --clear
> ```

## ローカル実行（Android エミュレーター）

1. Android Studio をインストールし、Virtual Device Manager でエミュレーターを作成・起動
2. 環境変数を設定（Windows PowerShell）：
   ```powershell
   [System.Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
   [System.Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Android\Android Studio\jbr", "User")
   # PATH に platform-tools と jbr\bin も追加
   ```
3. 実行：
   ```bash
   npx expo run:android
   ```

## APK ビルド（EAS Build）

```bash
npx eas-cli login
npx eas build --platform android --profile preview
```

ビルド完了後、[expo.dev](https://expo.dev) のダッシュボードから APK をダウンロードできます。

GitHub Actions による自動ビルドも設定済み（`.github/workflows/build-android.yml`）。リポジトリの Secrets に `EXPO_TOKEN` と `GOOGLE_TTS_API_KEY` を設定すると、ブランチへのプッシュごとに自動でビルドされます。

## 使い方

| 操作 | 方法 |
|------|------|
| 本を追加 | 右下の **＋** ボタン → PDF / TXT を選択 |
| 読み上げ | 本を開いて **▶** ボタン。事前に「音声生成」で一括生成も可能 |
| 文から再生 | 読みたい文をタップ |
| 速度変更 | プレイヤー左の速度ボタン（タップで循環） |
| 音声・ピッチ変更 | ホームの ⚙️ → 設定 |
| 本の削除 | ホームで本を長押し |

## トラブルシューティング

| 症状 | 原因と対処 |
|------|-----------|
| TTS 403 "unregistered callers" | APIキーが読み込まれていない。`.env` を **UTF-8（ascii）** で再作成し `npx expo start --clear` |
| TTS 403 "PERMISSION_DENIED"（キー送信済み） | Cloud Text-to-Speech API が未有効化、またはキー制限が厳しすぎる |
| PDFからテキストを抽出できない | スキャン画像PDFは非対応。テキスト選択可能なPDFか `.txt` を使用 |
| 音声を変えたのに古い声で再生される | 旧バージョンの問題。現バージョンは設定ごとにキャッシュを分離済み |

## 技術スタック

- Expo SDK 53 / React Native 0.79 / React 19
- expo-router v5（ファイルベースルーティング）
- expo-av（音声再生・バックグラウンド再生）
- zustand（状態管理）+ AsyncStorage（永続化）
- Google Cloud Text-to-Speech API
