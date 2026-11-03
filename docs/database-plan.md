# データベース拡充の計画（調査結果と進め方）

作成：2026-11-03。公開サイトには出ない社内メモ（`docs/` は公開対象外）。

## 結論
- ゲームのデータを**一括で抜き出して大量のページを自動生成する方法は採らない**。GGGの利用規約に抵触するおそれがあるため。
- 代わりに、**1件ずつ出典で照合して自分の言葉で書く個別ページ**（今の `data/core-entities.json` の方式）を、テンプレートとAI（Claude／Codex）で量産する。
- 量産する順番は「サイト内ですでに名前が出ているのにページがない装備」→「人気の装備・スキル」→「全ボス・クエスト」。

## 調べたデータ源

| データ源 | 内容 | 使えるか |
|---|---|---|
| GGG公式トレードAPI（`/api/trade2/data/*`） | アイテム名・ステータス文 | 外部からの取得は403（Forbidden）。利用にはAPIの規約・申請が必要 |
| RePoE（repoe-fork.github.io/poe2、0.5.5.5） | ゲームデータのJSON書き出し。ユニーク441件、スキルジェム定義1,191件（サポート・派生を含む） | 英語のみ。ユニークと効果（モッド）の対応がない。データの権利はGGGにある。**社内の網羅率チェック用にのみ使う** |
| PoE2DB（poe2db.tw） | 日本語名・効果・ドロップ元・更新履歴 | 文章は「CC BY-NC-SA 3.0」（非営利条件）。**広告のあるサイトへの転載はしない**。事実の照合と出典リンクにだけ使う |
| poe2wiki.net | コミュニティWiki | 同じく非営利条件。照合用 |

## GGG利用規約で問題になる点
GGG「Path of Exile & Path of Exile 2 – Terms of Use」第7条（Restrictions）では、GGGの事前の書面による承認なしに、次のことを禁止している。
- ウェブサイト・ゲーム素材などの複製、保存、配布、公開、二次的著作物の作成（ライセンスの範囲外のもの）
- ウェブサイトからデータ収集・抽出ツールで情報を抜き出すこと
- ゲームクライアントやデータの改変、リバースエンジニアリング

また第4条で、ゲーム内の名前・アイテム・テキスト・画像などの権利はGGGにあると定めている。

→ アイテム名や数値に触れて解説することは攻略サイトとして一般的だが、**ゲームデータの一括抽出・大量転載は避ける**。大規模にやるなら、GGGに書面で許可を取る（下の文面案）。

## 網羅率（2026-11-03時点）
- ユニーク装備：441件中 **16件**に個別ページ（試作の4件を含む。石無しの指輪はユニークではないため除く）
- サイト内で名前が出ているがページがないユニーク：**19件**
  - Against the Darkness、Beacon of Azis、Call of the Brotherhood、Cloak of Defiance、Enfolding Dawn、Guiding Palm、Heart of the Well、Heroic Tragedy、Ingenuity、Kalandra's Touch、Megalomaniac、Nascent Hope、Olroth's Resolve、Opportunity、Shavronne's Satchel、Soul Mantle、Trenchtimbre、Ventor's Gamble、Waveshaper
- スキル：掲載ビルドの主力12件のみ

## 進め方（1件あたりの手順）
1. PoE2DBの日本語版・英語版で、日本語名・ベース・装備条件・効果・ドロップ元・更新履歴を確認する。
2. `data/core-entities.json` に1件追加する。効果は**自分の言葉で言い換え**、フレーバーテキストは載せない。
3. 入手場所・ドロップ率・相場が確認できないものは「確認していない」と書く。
4. 掲載ビルドで使っていない装備は `buildIds: []` と `buildsNote` で明記し、関連記事を `relatedLinks` に入れる。
5. その装備に触れている記事の `related` から、新ページへリンクする。
6. `scripts/test-glossary-evidence.mjs` のエンティティ件数を更新する。
7. `npm run build` と全テストを通す。

1回の作業は10件までにする。名前・数値の誤りは信頼を大きく損なうため、量より照合を優先する。

## 試作（2026-11-03）
次の4件を上の手順で追加した。
- ルーンシーカーの呼び声（`/equipment/runeseekers-call/`）
- 不屈なる者として死す（`/equipment/morior-invictus/`）：運営者の撃破記録で使用
- 目の導きの掌（`/equipment/guiding-palm-of-the-eye/`）：同上
- メイジブラッド（`/equipment/mageblood/`）

## GGGへの許可依頼（文面案・英語）
送るかどうかは運営者が判断する。送り先：support@grindinggear.com

> Subject: Permission request for a Japanese Path of Exile 2 fan guide site
>
> Hello Grinding Gear Games team,
>
> I run "POE2 Build Navi" (https://poe2-build-navi-jp.github.io/), a free Japanese-language guide site for new Path of Exile 2 players. The site shows ads to cover its costs.
>
> We would like to create reference pages for unique items, skill gems and bosses, using item names, stats and in-game text, so that Japanese players can look them up in their language. Each page would credit Grinding Gear Games and link to the official site.
>
> Could you let us know whether this use is acceptable, and under what conditions? If there is an official API or data policy we should follow, we would be glad to use it.
>
> Thank you for making Path of Exile 2.
>
> Okapi Research Institute (operator of POE2 Build Navi)
