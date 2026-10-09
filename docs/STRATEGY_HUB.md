# PoE2攻略入口

`/guides/` は既存の攻略記事へ送る一覧です。ゲーム仕様、ビルド評価、攻略本文を複製しません。カテゴリには既存slugだけを置き、見出し・説明は `data/guides.json`・`data/seo-pages.json`・`data/strategy-guides.json` を参照します。

トップの「もっと詳しく探す」、初心者ガイド、掲載21記事に一覧への導線を追加します。最初のビルド選択、現在Lv、比較、保存、note導線は変更しません。

元記事の生成後に実行：

```
node tools/generate-strategy-articles.mjs
node tools/enhance-guide-search-intents.mjs
node tools/generate-strategy-hub.mjs
node tools/generate-sitemap.mjs
node tools/enhance-one-hub.mjs
node tools/generate-sitemap.mjs
node tools/inject-analytics.mjs
node tools/sync-asset-versions.mjs
npm test
node scripts/test-strategy-hub.cjs
```

再実行しても導線が重複しません。攻略一覧のOGPは既存の初心者・育成画像を再利用します。元記事の出典・資料確認日は維持し、一覧を追加した日をゲーム内容の再検証日にはしません。

検索・カテゴリ絞り込みと追加8記事の範囲・再生成手順は [STRATEGY_EXPANSION.md](STRATEGY_EXPANSION.md) を参照。

Act2追加の範囲は [ACT2_WALKTHROUGH.md](ACT2_WALKTHROUGH.md) を参照。

Act3追加の範囲は [ACT3_WALKTHROUGH.md](ACT3_WALKTHROUGH.md) を参照。
