# 攻略ガイド拡張（2026-10-09）

## 公開範囲

攻略ハブに検索・カテゴリ絞り込み・件数・0件時の解除導線・URL状態復元を追加。既存13記事に、出典を確認した6記事を加えた19記事を掲載します。

- Act1開始からジオノール伯爵撃破までの進行・任意報酬・ボス対策
- キャンペーンの進行条件・変更点
- 混沌の試練の中断・報酬・再挑戦
- AtlasのTower/Fortress/Origin Core進行
- WaystoneとTabletの起動・適用条件
- Expeditionの解放とリーグ差

新規記事は5節以上（Act1は11節＋5問のQ&A）、最初の行動3つ、目次、段落の出典参照、確認日、関連記事、育成への戻り先を備えます。記事の説明と公式仕様の範囲を分け、全ボス・全Actチャート・全通貨効果の完全網羅とは表現しません。外部攻略サイトの文章や画像は転載しません。

既存9章とSEO記事のデータは変更せず、追加記事は `data/strategy-guides.json`、生成は `tools/generate-strategy-articles.mjs` に分離しています。元記事にある資料確認日を更新日で置換しません。

## 再生成順

既存記事の生成・整形を行った後に実行します。

```
node tools/generate-strategy-articles.mjs
node tools/enhance-guide-search-intents.mjs
node tools/generate-strategy-hub.mjs
node tools/generate-sitemap.mjs
node tools/enhance-one-hub.mjs
node tools/inject-analytics.mjs
node tools/sync-asset-versions.mjs
node tools/generate-sitemap.mjs
npm test
npm run test:strategy
CHROMIUM_PATH=/usr/bin/chromium npm run test:order
```

新規記事は既存のOG画像を利用します。検索とカテゴリ絞り込みはJavaScriptによる追加機能で、JavaScriptを使わなくても全19記事のリンクとカテゴリ内移動が利用できます。

## 今後の別検証が必要な範囲

全Actの恒久報酬一覧、個別ボスの攻撃パターン、アセンダンシーポイント別の入場条件、全通貨・クラフトの効果、各リーグの最適周回は未完成です。一次資料と実際の画面で確認した範囲から追加します。

## 検証結果

- `npm test`：既存回帰＋新規攻略/検索意図/再生成テストが全PASS（83 indexable URLs）。
- `git diff --check`：PASS。
- 攻略再生成2回：12対象出力がbyte-identical、ホームは変更なし。
- DOMアクセシビリティ検査：攻略ハブ・Atlas記事のWCAG A/AA検査に違反なし（色コントラストを除外）。
- コマンド環境のChromiumはUnix socket制限で起動不可。実viewport、スクリーンショット、描画コントラスト、Chromiumに依存する全enhancer-orderテストは未完了。公開後のブラウザ確認で補完します。
- `/tests/mobile.html` は既存のnoindex,nofollow検証用ページ。攻略ハブ/Atlas/Act1の選択肢と実幅計測を追加し、sitemapには含めません。
