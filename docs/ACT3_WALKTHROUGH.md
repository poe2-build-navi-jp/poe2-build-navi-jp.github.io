# Act3攻略追加

Act3開始から最終ボス、Act4への移行までを1記事にまとめます。必須進行・任意強化・時代切替と戻り方を区別し、現在のエリア順とクエスト条件を資料で確認します。

- データ：`data/strategy-guides.json` の `act-3-walkthrough`
- 検索意図：`data/guide-search-intents.json`
- 検証：`npm test`、`node scripts/test-act3-walkthrough.cjs`
- 再生成：`docs/STRATEGY_EXPANSION.md` の順番

既存ホーム・ビルド本体・広告設定は変更しません。Act2↔Act3と攻略ハブを接続し、未作成のAct4ページは追加しません。実表示は直接URLと既存noindex QAページ `tests/mobile.html?page=act3Guide` で確認します。

## 原稿の範囲

15節・8Q&A・24出典。大型コアと現行水路、神殿の鍵とケツーリ後の儀式、過去のナプアツィ/ドリヤニ、スピリットや心臓の任意報酬、再鍛造ベンチ、Act4移行を掲載します。水路の圧力床化、現行エリア順、試練再取得は公式変更と照合しています。

## 公開前検証

- `npm test` 全PASS（既存回帰、21記事検索意図、8記事出典/目次、Act2・Act3固有導線、再生成を含む）。
- 攻略22ページの653内部リンク・fragmentを確認。
- `git diff --check` PASS。
- Act3とハブのDOM axe検査は違反0。描画が必要な色コントラストは対象外。
- 再生成14対象出力がbyte-identical。ホーム・初心者おすすめHTMLは変更なし。
- 実画面・モバイルviewportは公開後に確認。QAページはnoindex,nofollowでsitemapに含めません。
