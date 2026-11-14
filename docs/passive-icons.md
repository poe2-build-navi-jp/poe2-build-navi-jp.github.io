# パッシブ画像の更新

現行0.5.5.5ツリー全4,913ノードを元の文字列IDで照合し、581点の画像を1枚のWebPへまとめる。計算用データ・ノードID・取得判定・保存形式は変更しない。

## 表示

- ツリー：SVGのpatternから画像を参照し、既存の枠線で取得済み・参考・選択状態を示す。画面内ノードのみ描画する既存処理を維持する。
- 一覧と詳細：ツリーと同じ対応表・画像を使う。画像は隣接する名称の補助として扱い、読み上げの重複を避ける。
- 日本語・英語：共通の対応表と元データ名を使用する。表示名の翻訳によって画像を照合しない。
- 読込失敗時：対応表は任意データとして扱い、計算と丸印での編集を継続する。

## 再生成

1. Pillow・zstandardを用意し `python tools/vendor-passive-icons.py` を実行する。ソースの固定コミット・エンジンのデータ版・ID照合の不一致は停止する。
2. `node tools/generate-simulator-runtime-en.mjs` と `node tools/sync-asset-versions.mjs` を実行する。通常のサイトビルドにも同じ処理を含む。
3. `node scripts/test-passive-icons.mjs`、`npm run test:simulator`、`npm run test:simulator:en` を実行する。
4. 画像データ障害時は `PASSIVE_ICONS_UNAVAILABLE=1 node scripts/test-simulator-ui.mjs` で既存操作を確認できる。
5. 公開CIは日本語・英語それぞれ360/390/768/1366pxでツリー・一覧・詳細を撮影し、全ノードの画像対応、ローカル画像の取得、横はみ出し、ページエラーを検査する。

出典と権利表記は `ASSET_SOURCES.md`、各画像の元ファイル・レイヤー・ハッシュは `data/passive-icons.json` に記録する。
