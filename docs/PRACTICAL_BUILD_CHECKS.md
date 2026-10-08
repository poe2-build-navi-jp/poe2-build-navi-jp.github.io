# 育成途中の困りごとを解決する運用

2026-10-08：既存3ビルドへ原典照合の回答を追加。新規攻略URL・ビルド・評価は追加しない。
`data/builds.json` の任意の `practicalGuide` が唯一の原稿。回答は既存 `sources` と
`levelingStages` の添字を参照する。全育成手順の `updatedAt` は変更しない。

## 今回確認した原典と範囲

| 掲載ビルド | 原典 | 今回の範囲 | 未確認 |
| --- | --- | --- | --- |
| アイスショット | https://mobalytics.gg/poe-2/builds/ice-shot-deadeye-leveling-guide | Build Overview・Equipment・Skill Gemsの本文。タイトル0.5、タグ0.5.5 FR。Lv31、序盤武器・サポート、キャンペーン後の別ガイド移行 | 動的な各段階の全サポート構成・実機プレイ |
| スナイパーミニオン | https://mobalytics.gg/poe-2/builds/thyworm-infernalist-leveling | Equipment・FAQ。Utzaalの50 Spirit対象、Spirit部位、作者のPowered Zealot切替勧告（Lv65〜70・5リンク） | 全サポート名・実機での切替成功率 |
| シールドウォール | https://mobalytics.gg/poe-2/builds/warrior-league-start-lundburgerr | Build Variants・How it Plays。タイトル0.5、タグ0.5.5 FR。Lv22・周回起爆・アーマーブレイク後のSunder | 動的な後半サポート構成・実機性能 |
| シールドウォール使用条件 | https://poe2db.tw/us/Shield_Wall | Requires・Level EffectのジェムLv7行（Lv22・筋力41・Armoured Shield） | 上位ジェムの値をLv7へ一律適用しない |

文章・画像の転載なし。コメント欄の回答や他構成の強さを、掲載ビルドの確定性能へ昇格しない。
今回の原典確認を、過去に掲載した全8段階の全面再検証・公式パッチ確認とは扱わない。

## 実機検証の記録（現在は3ビルドとも未実施）

実機データが得られたときだけ、掲載ビルドの記録に追記する。手順が実行可能と確認した
結果と、ウェブサイトの動作テストを区別する。検索上位やAIによる概要の掲載を保証しない。

記録するもの：日付、実際のパッチ、ビルド・原典段階、LvとAct、ジェム・サポート・Spirit、
武器と防御条件、試した操作、成功/失敗、変更した1項目、その後の結果、許諾済みの自撮り画面。
アカウント名・チャット・個人情報は画像から除く。秒数などを比較する場合は敵・エリア・装備を揃える。
未記入の記録を公開したり、原典作者の経験を運営者の実体験として表示しない。

## 生成・検証

既存ページを維持した差分生成：

```sh
node tools/enhance-build-ux.mjs
node tools/enhance-practical-help.mjs
node tools/generate-build-data.mjs
node tools/generate-sitemap.mjs
node tools/sync-asset-versions.mjs
npm test
node scripts/test-practical-help.cjs
node scripts/test-strategy-hub.cjs
git diff --check
```

全ページを生成する既存チェーンでも、最後に `enhance-practical-help.mjs` を実行する。
既存の攻略ハブは `generate-strategy-hub.mjs` で復元する。更新日は実際に変えたページだけ。

## 利用結果と優先順位

フォームは送信時だけ既存GA4の `build_feedback` イベントを使う。
カスタムパラメータ：`build_id`, `stage_index`, `patch`, `issue`, `outcome`。
氏名・メール・自由記述・端末内の進捗履歴・正確なLvはこのイベントに含めない。
1段階での連打送信を抑止し、段階変更で回答をリセットする。
結果は改善する説明を選ぶ参考。自己申告と実機検証の証拠を混ぜず、成功率を公開しない。
GA4の受信と集計設定は今回は未確認。管理画面で受信を確認後、上のパラメータを必要な分だけ
イベントスコープのカスタムディメンションへ登録し、ビルド別の詰まりを集計する。

Search Consoleでは、既存URLごとに「ビルド名＋切替／Spirit／火力／サポート」の表示回数・
クリック・CTRを同条件で28日比較する。今回検索数や順位を推測してタイトルを一斉変更しない。
改善の順序は、実際に詰まり報告がある項目 → 表示回数があり検索意図が一致する項目。
