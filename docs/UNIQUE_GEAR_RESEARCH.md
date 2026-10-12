# ビルド別ユニーク装備の照合記録

確認日：2026-10-12。記事の原稿・出典・構成別候補は既存の
`data/strategy-guides.json` の `unique-gear` に保持する。ビルドの段階別データ、
対応パッチ、育成手順の確認日、評価は変更しない。

## 確認方法と範囲

12掲載ビルドの原典本文と、Mobalyticsが通常のページHTMLに公開する構成別装備データを確認。
同データの `commonItem.isUnique`、装備スロット、構成IDと構成名を対応付けた。
原典に掲載されたことと、ゲーム内効果が現在も同じであることは別に照合した。
PoE2DBは種別・効果・変種・変更履歴を確認する参照先。文章・画像・データ一式の転載はしない。
記事で使用した各URLと確認した内容は、記事データ内45件の `sources` に記録。

| 掲載ビルド | 原典で照合した範囲 |
| --- | --- |
| ワーリングアサルト | Scorpiusのベルト3候補、レア装備条件 |
| ツイスター・ジェムリング | snoobae85のAtlas Progression、Early/Mid Endgameの本文と装備 |
| シールドウォール | LundburgerrのMaps・Giga Endgameの装備データ |
| 砂と炎 | PhazePlaysのEndgame装備データ、PoE Vaultの育成用装備方針 |
| 相棒 | PoE Vaultの2武器比較・強化、MobalyticsのRed Maps/Endgame |
| アイスショット | FubgunのEquipmentとGear Progression |
| ミニオン | Thyの育成条件、PoE VaultのPowered Zealot Endgameの装備 |
| 植物 | RaxxのCheap/Expensiveの装備、Heroic Tragedyの変更履歴 |
| ED | DEADRABB1TのAtziri's DisdainとEternal Life等の組合せ |
| グレネード | DEADRABB1TのMid/Uber Endgame、別PoE Vault版の専用構成 |
| ツイスター・スピリットウォーカー | GuyThatDiesのEarly Endgame/Taming Non-Crit/Crit Swap |
| スパーク | DotGGのCoC Comet型、0.5.5更新が明記されたPoE Vaultマナスタック型 |

## 誤認を避けた点

- Darkness Enthronedの「body armour」「helmet」はソケット効果の種類。装備枠はベルト。
- The Tamingは指輪。Tangletongueの会心移行は他部位の追加ダメージも条件。
- Bones of Ullrはアンデッド生成スキルが対象。ジンへ無条件に適用しない。
- Nightscaleは非会心時のマナ再生制限を明記。通常型と変種の効果を混ぜない。
- Redemptionは弾薬不可・会心ダメージボーナスなし。一般的な武器DPS交換として案内しない。
- Atziri's DisdainのES迂回と原典の防御ノードをセットで案内。
- Maligaro's Virtuosityは250%固定の現物を確認。全変種が同じ効果とは扱わない。
- Olroth's Resolveの旧即時回復説明を採用しない。PoE2DBの0.5.1変更履歴と原典に相違。
- GemlingのLate Endgame本文には169/198 Spiritが混在。この記事では固定総量を載せない。
- Maxrollは取得できなかった。過去の資料確認を今回の採用確認とみなさない。

Enfolding Dawnの砂と炎向け候補は効果と育成の装備目標からの検討。
PhazePlaysの現行Endgame採用品としては確認できず、記事にもその旨を明記した。
PoE Vault/DotGGで今回パッチ番号を確認できない原典は、出典欄で明示を確認できないと記載。

## 未実施

運営者の実機プレイ、同条件DPS・耐久比較、相場の実測、ドロップ率やSSF入手の検証、
ビルド8段階の全面再検証。万能の最強順位や固定価格を作らない。

## 更新・検証

記事データの候補や出典を更新後、既存 `npm run build` でページ・検索・OGP・sitemapを再生成。
`npm test` と `node scripts/test-unique-gear.cjs` を実行する。
新しい候補には装備効果とビルド側の参照を両方付け、原典の構成名と購入時の条件を記録する。
