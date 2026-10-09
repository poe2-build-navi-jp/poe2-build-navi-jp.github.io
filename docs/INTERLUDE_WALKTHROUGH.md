# 間幕攻略追加

Act4後の3地域からエンドゲーム導入までを単一記事で案内。16節・8Q&A・25出典。任意順の主線、農場や渡り路へ戻る進行、各地域のボス後の報告、スピリット・ライフ・パッシブなどの任意報酬を区別します。

- 原稿：`data/strategy-guides.json` の `interlude-walkthrough`
- SEO：`data/guide-search-intents.json` の23本目。Title/H1/冒頭回答/Article/descriptionを本文に対応させます。
- 導線：Act4↔間幕↔クリア後の準備、攻略ハブ、Atlas・ウェイストーン記事。
- 既存の白文字修正は保持。画像追加なし。

## 検証

`npm test`で記事出典、23記事の検索意図、既存回帰、間幕固有導線、繰り返し再生成、関連記事コントラストを確認。攻略ディレクトリの内部リンク・fragment744件を検査。間幕とハブのDOM axeは違反0（描画依存の色コントラストは除外）。実画面と375/390/430幅は公開後のブラウザQAで確認します。

QAページ `tests/mobile.html?page=interludeGuide` はnoindex,nofollow、sitemap対象外。ローカルChromiumは環境制限により使っていません。
