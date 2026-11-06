# SEO・AI検索の点検（2026-11-06）

対象サイト: https://poe2-build-navi-jp.github.io/

## 調査範囲と判断方法

https://lucy.ne.jp/bazubu/articles の一覧を取得し、掲載498 URLと本文取得データを照合。498件ともHTTP 200、本文あり。一覧への掲載記事が対象で、リンク先のさらに先やサイト全体の全URLを対象としたものではない。全件を同じ深さで精読したという意味ではなく、全件のタイトル・本文を対象に関連性を抽出し、SEO・AI検索・品質・内部リンク・測定の解説を重点確認した。

[498 URLの記録](BAZUBU_ARTICLE_COVERAGE_20261106.csv)はタイトルによる一次分類と適用範囲を記録したもので、個別施策の効果を認定するものではない。AI検索32件、SEO・記事品質180件、測定・導線25件、その他261件。記事本文の転載・要約の再公開は行わない。

## 重点的に照合した参考記事

- [キーワード選定](https://lucy.ne.jp/bazubu/keywords-selection-correct-49761.html): 同じ意図の記事を増やす前に既存ページの役割を確認。
- [内部リンク](https://lucy.ne.jp/bazubu/internal-link-41279.html): 関連する記事への意味のあるリンクと、リンク先を説明する文言。
- [E-E-A-T](https://lucy.ne.jp/bazubu/what-is-e-e-a-t-49125.html): 誰が編集し、どの根拠を使ったか読者が確認できる状態。
- [低品質コンテンツ](https://lucy.ne.jp/bazubu/what-is-low-quality-content-49108.html): 未確認事項・実測・推定を区別。
- [SEO効果測定](https://lucy.ne.jp/bazubu/seo-effectmeasurement-41749.html): 流入だけでなく利用者の目的達成を測定。
- [AI施策の測定](https://lucy.ne.jp/bazubu/llmo-metrics-56147.html): ファイルへのアクセスや単発のAI回答だけで成果を判断しない。
- [独自の事例](https://lucy.ne.jp/bazubu/the-only-content-that-cannot-be-imitated-55303.html): 実在する運営者の攻略記録を根拠とともに扱う。
- [SEOとLLMOの優先順位](https://lucy.ne.jp/bazubu/seo-llmo-priority-55065.html): 対象読者と状況を具体化する考え方を確認。技術上の必須要件は一次資料を優先。

仕様の照合先:

- https://developers.google.com/search/docs/appearance/ai-features
- https://developers.google.com/search/docs/fundamentals/creating-helpful-content

GoogleはAI検索に特別なテキストファイル・専用構造化データを要求していない。llms.txt必須という説明は採用せず、クロール・本文・内部リンク・根拠と表示内容の一致を優先した。編集者リンクや構造化データを足せばE-E-A-Tや順位が機械的に上がるという意味ではない。

## サイト点検と実装

|項目|確認・対応|
|---|---|
|検索結果の基本情報|サイトマップ143 URLのタイトル・説明・H1・自己canonical・静的本文・内部リンクを確認。タイトル・説明の重複、孤立URLなし|
|記事の編集責任|Articleを持つ86ページの見出し直後にオカピ研究所と編集方針へのコンパクトなリンクを追加|
|根拠|本文の出典領域にある外部参照を既存Articleのcitationに補完。新規634件のページ別参照。元の引用情報を保持|
|構造化データ|実在する運営組織とWebSiteに一貫したIDを付け、既存Articleの既知の編集組織・出版者と整合。新しいArticleを重複生成しない|
|日付|公開日・情報源の確認日・本文更新日を保持。共通の編集者表示の追加でサイトマップの本文更新日を動かさない|
|利用成果|既存GA4で攻略・辞典・個別スキル/装備ページの目的行動を計測。新しい計測タグは増設しない|
|既存の独自情報|灰のアービターの実機記録、公式トレード出品の確認記録、Lv別ロードマップを維持。実機確認や成約価格を捏造しない|
|クロール|robots、サイトマップ、初期HTML、パンくず、サイトマップページを確認。GPTBotへの既存の学習許諾設定を維持|

## 計測イベントと評価

|イベント|対象行動|パラメータ|
|---|---|---|
|guide_build_click|本文から個別ビルドへ進む|page_path / destination_path|
|guide_next_click|本文から別の攻略記事へ進む|page_path / destination_path|
|guide_trade_click|公式トレードへ進む|page_path|
|guide_source_click|出典の外部リンクを開く|page_path / source_host|

記事本文・リンク文言・取引条件・任意のURLクエリを新イベントに送らない。クリックは結果の達成や売買成立を意味しない。GA4標準のpage_view等は従来の設定を継続。

公開後は同じ期間・記事・流入元で行動率を比較する。Search Consoleで表示回数・クリック・CTR・順位を確認し、GA4で記事→ビルドの遷移と既存のLv操作を併せて評価する。GoogleのAI検索流入は通常のWeb検索に含まれるため、この実装でAI概要だけの効果を分離できたとは扱わない。今回Search Consoleの実数取得や順位上昇の確認は行っていない。

再生成では`enhance-page-schema`の後に`enhance-editorial-trust`を実行し、`inject-analytics`と`sync-asset-versions`を続ける。

## 検証

- `test-seo` / `test-static-content`: サイトマップ143 URLの基本SEO・静的本文・ローカルリンクに合格。
- `test-guide-review-sharing` / `test-guide-reading`: 確認日と更新日の区別、出典パネル、読みやすさ、既存ジェネレーターとの整合に合格。
- `npm run test:editorial`: 86記事の編集者と組織ID、生成の冪等性、日付保持、目的行動イベント、外部サイトや同一ページ内リンクの除外、クエリ非送信に合格。
