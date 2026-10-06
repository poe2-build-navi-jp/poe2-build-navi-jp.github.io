# 選択段階タブの追加確認（2026年10月6日）

基準コミット：`8d133249e3919838108db26757511c385f576b6a`。
[機械可読の変更前・変更後と出典](stage-tabs-2026-10-06.json)。

## 訂正1段階と確認範囲の拡大5段階

- Monk「(Leveling) Whirling 41+」：現在掲載していたFalling Thunder／Charged Staffは育成タブにありません。主力・補助・終了条件・行動をWhirling Assault、Staggering Palm、Tempest Bell、Mantra of Destructionへ訂正。育成用サポート4種とマナ対策を同じタブから反映しました。Falling ThunderがLv41で使用不能という判定ではありません。
- Ranger「lvl 24-30」：Lightning Arrow継続とFreezing Mark等の追加、準備するジェム個数、Freezing Markを優先して次のLv7でSnipeを追加する案、Snipeのサポートを具体化。
- Ranger「lvl 31-41」：Ice Shotの3サポート、Heraldの交換、Freezing Markの武器セット2割当、Freezing Salvo省略案を具体化。
- Shield Wall「Act 2 - Shield Wall Swap」：Shield Wall・Infernal Cry・Freezing Markのサポートを具体化。Lv22・盾アーマー80以上は作者の切替目安として明示し、ゲームの必須使用条件としません。
- Shield Wall「Act 3」：最初のLv9以上ジェムでFortifying Cry、次にSunderを追加する作者の案とサポート、枠不足時のLeap Slam一時除外を掲載。
- Twister Gemling「Early Atlas」：Whirling Slash Lv1・Set1とTwister Lv16・Set2、掲載サポートと補助スキルを具体化。War Banner／Fangs of Frostはこの一覧にありません。共通操作説明を段階固有の本文として扱いません。ジェムLv16はキャラクターレベルを意味しません。

原典の各選択URLはJSONの各レコードを参照。今回の取得はクラウドブラウザの通常操作で選択段階を直接確認したものです。別の既定タブや共通How it Playsを根拠にしていません。

## 最新公式パッチ

[0.5.5e公式投稿](https://www.pathofexile.com/forum/view-thread/4009785)を確認。投稿者Alexander_GGG、表示日時はOct 5, 2026, 6:32:07 PM。表示タイムゾーンは明示されていないためJSTへの断定換算はしません。

内容は低VRAM向けTexture Quality設定、Ritual開始、Tomb of the Fallen Knightアクセス、エリア読み込み、Sovereign Hideoutアートの修正です。ビルドバランスやサポート共通規則の変更を意味しません。最新パッチメタデータを0.5.5eへ更新し、既存の主張確認日・ビルド全体の確認日・対応版は維持しました。現行CSVの最新パッチ欄だけを追補への参照付きで更新しています。

## 残る制限

- Maxroll原典12ページは未確認。取得不能を誤りとは扱いません。
- サポート全種類共通のレベル上げ・コラプト可否は`qualified_unresolved`を維持。
- 6段階の掲載内容取得と、全装備条件・全動的ツリーノード・ゲーム内入手・実走の検証は異なります。
- 生成・回帰テストは構造と表示整合性の確認です。全サイトの全情報を検証完了したとは扱いません。

## 検証

- `npm test`：通過（サイト構造、75公開URLのSEO・リンク、ビルドUI、行動案内、選択の明確さ、事実訂正の回帰テスト）。
- `OG_METADATA_ONLY=1 npm run test:order`：4通りの生成順でHTML一致。既存ラスター画像は維持。
- `git diff --check`：通過。
- `CHROMIUM_PATH=/usr/bin/chromium npm run test:contrast`：Chromium起動時に`socket() failed: Operation not permitted`で停止。コントラスト検証は未実施であり、通過とは扱いません。
