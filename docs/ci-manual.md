# GitHub Actions 手動修正

GitHub Appにworkflows書き込み権限がないため、このファイルだけはリポジトリ管理者が
手動で変更する。

`.github/workflows/build-android.yml` から次を削除する。

```yaml
- name: Create .env
  run: |
    echo "EXPO_PUBLIC_GOOGLE_TTS_API_KEY=${{ secrets.GOOGLE_TTS_API_KEY }}" > .env
```

GitHub Secret `GOOGLE_TTS_API_KEY` も不要になったことを確認して削除する。公開Worker
URLは `eas.json` の各profileへ固定済み。

CIへ追加する検証コマンド:

```bash
npm ci
npm --prefix web ci
npm --prefix worker ci
npm test
npx expo-doctor
npm --prefix worker run deploy:dry-run
```

workflow変更を含むpushは現在のGitHub App権限では拒否されるため、この文書の変更を
リポジトリ管理者が行うまで、mainのAndroid workflowは公開用として使用しない。
