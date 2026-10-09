# Act2攻略追加

Act2開始から最終ボスまでを1記事にまとめ、主線と任意の強化・解放、個別ボスの対処、クリア後を区別します。0.5系の変更を公式資料で照合し、古い進行ルートや未確認の固定数値をそのまま載せません。

- データ：`data/strategy-guides.json` の `act-2-walkthrough`
- 検索意図：`data/guide-search-intents.json`
- 検証：`npm test`、`node scripts/test-act2-walkthrough.cjs`
- 再生成：`docs/STRATEGY_EXPANSION.md` の順番

ホームやビルド本体、広告設定は変更せず、既存ハブとAct1関連記事からAct2へ接続します。公開後の実表示は直接URLと既存noindex QAページ `tests/mobile.html?page=act2Guide` で確認します。

## 原稿の範囲

13節・7Q&A・19出典。キャラバン、鉱山と門、角笛3素材、任意の恒久強化・セケマの試練、デシャール、現行ドレッドノート、最終ジャマンラ、クリア後を掲載。Dreadnaught Vanguard削除は公式0.5.0で照合し、古代の誓いの旧報酬表記は採用していません。攻略提案と資料にある仕様は出典で区別しています。

## 公開前検証

- `npm test` 全PASS（既存回帰、20記事検索意図、7記事出典/目次、Act2固有導線、再生成を含む）。
- 攻略21ページの628内部リンク・fragmentを確認。
- `git diff --check` PASS。
- Act2とハブのDOM axe検査は違反0。描画が必要な色コントラストは対象外。
- 再生成13対象出力がbyte-identical。ホーム・初心者おすすめHTMLは変更なし。
- 実画面・モバイルviewportは公開後に確認。QAページはnoindex,nofollowでsitemapに含めません。
