# 情報点検結果（2026年10月6日・日本時間）

## 結論

公開対象75 URLと12ビルドを棚卸しし、本文・出典・掲載条件の不整合を修正しました。全情報の正しさを保証する認定ではありません。取得できなかった原典、動的な装備・パッシブツリー、ゲーム内実測が必要な箇所は未確認のまま区別しています。

- 基準コミット：`586ba159c56b247031bf683a6e4aa05b2ae9ebc3`
- 公式で確認した最新パッチ：0.5.5d。1.0の予定日は2026年12月11日（PST）
- ビルド原典：53件を対象、41件取得、12件（Maxroll）は再取得不可
- 基礎ガイド・辞典：264記録。一次確認45、記述誤り4、一次未確定134、編集上の助言81
- 一次未確定には、WikiやPoE2DBによる二次確認がある項目も含みます。「誤り134件」という意味ではありません。
- 96の育成段階を一覧化。すべての動的構成を再現・実測した確認ではありません。

## 修正内容

1. The Tamingを指輪として訂正。Unset Ringをユニーク限定とした説明を修正。
2. BarrageをTwisterより前に使用する操作順へ修正。Gemling完成形のSniper's Markと最新Spirit条件を追記。
3. Raging SpiritsのLv10・Spirit条件、植物ビルドの手動Thunderstorm、Whirling育成と完成形のサポート条件を区別。
4. 別作者・別構成の長所、SSF実績、キャンペーンとEndgameの評価を混同しないよう限定。古い出典日付・対応版の取り違えを修正。
5. スキル重複制限・Lineageサポートの例外、鑑定方法などを公式パッチに照合。
6. EA参加はアクセス権が必要という説明へ修正。サブアカウント・課金共有の制限、PST表記、既発表のキャラクター保持方針を補足。
7. 全ビルドの一括再検証日を更新せず、個別変更履歴とパッチ確認日を分けて保持。

## 台帳の読み方

- [主張台帳](fact-check-2026-10-06-claims.csv)：修正前の主張と、その監査判定・出典。errorは修正前の判定です。公開文面は修正後のソースを参照してください。
- [ビルド原典台帳](fact-check-2026-10-06-builds.csv)：取得できた原典・版・更新日・確認範囲。
- [育成段階台帳](fact-check-2026-10-06-stages.csv)：96段階の確認範囲と残る制限。判定は修正前の記述に対するものです。修正後の手順は現在のビルドデータを参照してください。
- [URL網羅表](fact-check-2026-10-06-coverage.json)：75 URLを主張・ビルドに対応付け。
- 元ガイドの長所・弱点を確認したことは、同一予算・装備で性能を実測した意味ではありません。数値ランキングは新設していません。

## 検証

- npm test：合格（SEO、75 URLの本文とリンク、12ビルドの表示、フィルター・比較・Lv操作・復帰・出典導線・今回の誤り再発防止）
- OG_METADATA_ONLY=1 npm run test:order：合格（4実行順でHTML一致）
- git diff --check：合格
- 未実施：変更後の実ブラウザ・モバイル目視とコントラスト。Chromiumが実行環境のsocket制限で起動できませんでした。
- 既存ラスター画像は保持。SVGロードマップと本文・構造化データを更新。OG画像の再描画は未実施。

## ページ一覧

| URL | 確認範囲 |
| --- | --- |
| https://poe2-build-navi-jp.github.io/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/builds/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/classes/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/leveling/ | 共通データ・編集上の案内・機能説明を照合 |
| https://poe2-build-navi-jp.github.io/gear-check/ | 共通データ・編集上の案内・機能説明を照合 |
| https://poe2-build-navi-jp.github.io/class-check/ | 共通データ・編集上の案内・機能説明を照合 |
| https://poe2-build-navi-jp.github.io/beginner-guide/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/dictionary/ | 共通データ・編集上の案内・機能説明を照合 |
| https://poe2-build-navi-jp.github.io/tier-list/ | 共通データ・編集上の案内・機能説明を照合 |
| https://poe2-build-navi-jp.github.io/league-starter/ | 共通データ・編集上の案内・機能説明を照合 |
| https://poe2-build-navi-jp.github.io/best-builds/ | 共通データ・編集上の案内・機能説明を照合 |
| https://poe2-build-navi-jp.github.io/poe2-1-0/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/about/ | 共通データ・編集上の案内・機能説明を照合 |
| https://poe2-build-navi-jp.github.io/editorial-policy/ | 共通データ・編集上の案内・機能説明を照合 |
| https://poe2-build-navi-jp.github.io/rating-criteria/ | 共通データ・編集上の案内・機能説明を照合 |
| https://poe2-build-navi-jp.github.io/privacy/ | 共通データ・編集上の案内・機能説明を照合 |
| https://poe2-build-navi-jp.github.io/terms/ | 共通データ・編集上の案内・機能説明を照合 |
| https://poe2-build-navi-jp.github.io/classes/monk/ | 共通データ・編集上の案内・機能説明を照合 |
| https://poe2-build-navi-jp.github.io/classes/mercenary/ | 共通データ・編集上の案内・機能説明を照合 |
| https://poe2-build-navi-jp.github.io/classes/warrior/ | 共通データ・編集上の案内・機能説明を照合 |
| https://poe2-build-navi-jp.github.io/classes/sorceress/ | 共通データ・編集上の案内・機能説明を照合 |
| https://poe2-build-navi-jp.github.io/classes/huntress/ | 共通データ・編集上の案内・機能説明を照合 |
| https://poe2-build-navi-jp.github.io/classes/ranger/ | 共通データ・編集上の案内・機能説明を照合 |
| https://poe2-build-navi-jp.github.io/classes/witch/ | 共通データ・編集上の案内・機能説明を照合 |
| https://poe2-build-navi-jp.github.io/classes/druid/ | 共通データ・編集上の案内・機能説明を照合 |
| https://poe2-build-navi-jp.github.io/builds/monk/whirling-assault/ | 原典確認・残る制限はビルド台帳参照 |
| https://poe2-build-navi-jp.github.io/builds/mercenary/twister-gemling/ | 原典確認・残る制限はビルド台帳参照 |
| https://poe2-build-navi-jp.github.io/builds/warrior/shield-wall-smith/ | 原典確認・残る制限はビルド台帳参照 |
| https://poe2-build-navi-jp.github.io/builds/sorceress/sand-and-fire/ | 原典確認・残る制限はビルド台帳参照 |
| https://poe2-build-navi-jp.github.io/builds/huntress/companion/ | 原典確認・残る制限はビルド台帳参照 |
| https://poe2-build-navi-jp.github.io/builds/ranger/ice-shot-deadeye/ | 原典確認・残る制限はビルド台帳参照 |
| https://poe2-build-navi-jp.github.io/builds/witch/minion-infernalist/ | 原典確認・残る制限はビルド台帳参照 |
| https://poe2-build-navi-jp.github.io/builds/druid/plant-oracle/ | 原典確認・残る制限はビルド台帳参照 |
| https://poe2-build-navi-jp.github.io/builds/witch/ed-contagion-lich/ | 原典確認・残る制限はビルド台帳参照 |
| https://poe2-build-navi-jp.github.io/builds/mercenary/grenade-gemling/ | 原典確認・残る制限はビルド台帳参照 |
| https://poe2-build-navi-jp.github.io/builds/huntress/twister-spirit-walker/ | 原典確認・残る制限はビルド台帳参照 |
| https://poe2-build-navi-jp.github.io/builds/sorceress/spark-stormweaver/ | 原典確認・残る制限はビルド台帳参照 |
| https://poe2-build-navi-jp.github.io/guides/skill-gems/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/guides/support-gems/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/guides/passive-tree/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/guides/equipment-basics/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/guides/resistance/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/guides/increase-damage/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/guides/why-i-die/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/guides/after-campaign/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/guides/mapping/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/dictionary/build/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/dictionary/dps/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/dictionary/skill-gem/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/dictionary/support-gem/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/dictionary/passive-tree/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/dictionary/resistance/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/dictionary/mapping/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/dictionary/endgame/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/dictionary/league-starter/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/dictionary/ssf/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/dictionary/ascendancy/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/dictionary/spirit/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/dictionary/energy-shield/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/guides/poe2-0-5-5-builds/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/guides/forbidden-rites-beginner/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/guides/gear-upgrade/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/guides/mana-problem/ | 共通データ・編集上の案内・機能説明を照合 |
| https://poe2-build-navi-jp.github.io/guides/cant-beat-boss/ | 共通データ・編集上の案内・機能説明を照合 |
| https://poe2-build-navi-jp.github.io/guides/slow-mapping/ | 共通データ・編集上の案内・機能説明を照合 |
| https://poe2-build-navi-jp.github.io/poe2-1-0/release-date/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/poe2-1-0/how-to-start/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/poe2-1-0/system-requirements/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/poe2-1-0/japanese/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/poe2-1-0/microtransactions/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/poe2-1-0/controller/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/poe2-1-0/pre-registration/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/poe2-1-0/build-status/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/poe2-1-0/duelist/ | 個別主張の判定は台帳参照 |
| https://poe2-build-navi-jp.github.io/what-is-poe2/ | 個別主張の判定は台帳参照 |

## 対象外の技術ページ

旧URLのリダイレクト、404、所有確認HTML、モバイルテスト用HTMLはゲーム情報の新規掲載ページではありません。既存のURL・リダイレクトは維持し、ナビゲーション・生成順テストで確認しています。
