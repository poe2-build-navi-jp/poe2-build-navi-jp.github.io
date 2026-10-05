# 事実確認の現在地（2026年10月6日・日本時間）

最新追補：[41掲載位置の条件別確認](clause-review-2026-10-06.md)・[機械可読の出典台帳](clause-review-2026-10-06.json)。前回のevidence_gap41行は、支持17・限定17・訂正3・理由付き未確認4として処理しました。元のUI位置を確認できなかった行は、確認できる一般説明に限定しています。全サイト・実測の確認完了を意味しません。

以下はPR19までの追加点検の記録です。基準はPR18のマージ `8a378ed625a5e63b8bd40b402a8dc6d7ac8e1102`。この最終追加点検では、DPS辞典、リーグスターター辞典、発売日ページの出典、Windows確認手順の出典を確認しました。既に訂正したビルド説明の辞典内の重複箇所も揃えました。

## PR19までの訂正

- 継続ダメージ全般に発生前の待ち時間がある、瞬間火力が低いから動く敵に当てにくい、という一般化を訂正。個々のガイドの評価と区別しました。[Essence Drain](https://poe2db.tw/us/Essence_Drain)、[PoE Vault](https://www.poe-vault.com/poe2/witch/lich/chaos-leveling-build)、[Gamerch](https://gamerch.com/poe2/954990)
- DPS比較を採点と呼ぶ古い説明を、現在の定性的な出典整理に合わせました。Shield Wallの約30%という数字は、LundburgerrのEndgame構成の見積もりとして限定しました。[評価基準](https://poe2-build-navi-jp.github.io/rating-criteria/)、[原典](https://mobalytics.gg/poe-2/builds/warrior-league-start-lundburgerr)
- リーグの固定的な4か月周期と一律Standard移行を断定せず、Forbidden Ritesの新規キャラクター・新経済、Runes of Aldurとの並行開催、EAキャラクター保持方針を公式記述に合わせました。[Forbidden Rites FAQ](https://www.pathofexile.com/forum/view-thread/4000430)、[EA FAQ](https://www.pathofexile.com/forum/view-thread/3587981)
- 1.0の2026年12月11日（PST）予定は維持。本文とFAQの根拠を、実際に確認した8月25日公式フォーラム発表に限定しました。Steamの発表予告を同日の発売日発表として扱いません。[公式発表](https://www.pathofexile.com/forum/view-thread/3999366)
- GPU・VRAM・空き容量のWindows手順は変更せず、MicrosoftとHPの説明を追加しました。[Microsoft: Display](https://support.microsoft.com/en-us/windows/hardware/display-graphics/microsoft-basic-display-adapter-in-windows)、[HP: dxdiag](https://www.hp.com/us-en/tech-takes/desktops/explainer/how-to-check-pc-specs-what-they-mean.html)、[Microsoft: 空き容量](https://support.microsoft.com/en-us/windows/experience/storage-filemanagement/free-up-drive-space-in-windows)
- Grenadeの紹介記事のSSF実績と掲載ルートの一致が未確認であることを、リーグスターター・SSF辞典の両方にも反映。Sand/Fireの辞典例は、初回アセンダンシーのKelariとLv40以降・2回目のRuzhanを分けました。[Grenade紹介](https://www.aoeah.com/news/4788--poe-2-055-best-gemling-build--top-3-best-league-start--endgame-gemling-builds)、[PhazePlays](https://mobalytics.gg/poe-2/profile/phazeplays/builds/0-4-phazeplays-sandscorcher-campaign-guide)

## 台帳の読み方

- [現在の主張台帳](current-claims-2026-10-06.csv) は、初回の304件の「掲載位置・主張グループ」を、現行テキストと追加点検に照合したものです。同じ仕様の重複掲載や複数の条件を含み、304個の独立した事実を意味しません。辞典・ガイド264行はJSONポインターと正確な現行文言を収録。R01〜R40は複数ページにまたがる主張グループの見出しであり、正確な文言は各リンク先本文を参照してください。
- [75公開URLの一覧](fact-check-2026-10-06-coverage.json)、[53件のビルド原典](fact-check-2026-10-06-builds.csv)、[96段階の育成台帳](fact-check-2026-10-06-stages.csv) も参照できます。後二つの判定は初回点検時点であり、[追加点検](follow-up-2026-10-06.md) の更新が優先します。
- 初回の `unverified` は「今回、一次資料で全条件を確認できなかった」を含みます。誤り確定件数ではありません。過去の134件という数を、現行の未解決の独立した事実の数として使用しないでください。
- `confirmed_as_scoped` は出典の範囲で確認、`secondary_corroborated` はゲームデータ・二次資料で裏付け、`corrected_or_qualified` は訂正または適用範囲を限定、`creator_route_confirmed` は作者の段階説明を確認、`qualified_source_attribution` は紹介記事の帰属のみ確認です。実測保証ではありません。
- `editorial_advice` は助言、`documentation_confirmed` は文書上の手順確認です。今回追補の `supported`・`narrowed`・`corrected`・`reasoned_unverifiable` は上記41行の判定です。`unresolved_rule`・`client_verification_not_performed` と、理由付き未確認は根拠確認の制限として残しています。全情報の検証完了を表す台帳ではありません。

## 前回抽出した文献確認（追補前の対象一覧）

アクセス障害と、まだ独立確認していないものを分けています。次の一覧は追補前に残っていた対象です。41行の現行判定は上記の追補とCSVが優先します。この一覧を現在の未処理件数として数えないでください。

- ジェム作成画面の利用条件、自然なレベル上限・未カットジェム変換、ミニオンと個別サポートのSpirit予約条件、品質通貨の効果の一部。既存資料の部分的な裏付けを、文章全体の確認に拡大しません。`guides/skill-gems:6,20`、`dictionary/skill-gem:7`、`guides/support-gems:13`、`guides/equipment-basics:12`
- 装備のレアリティ別効果数、能力値条件、アイテムレベル、通貨によるクラフト、武器セットの説明。`guides/equipment-basics:4–7,9,11,13–17`
- Interludeの進行順・エリアレベル上昇・将来の置換、Waystoneのティアとエリアレベル、Zekoaの出現場所。`guides/after-campaign:4–6`、`dictionary/mapping:4,12`
- SSFのパーティ・作成・移行の細則、アセンダンシーの基本ポイント数と現行UIの位置。`dictionary/ssf:1,2,4,7`、`dictionary/ascendancy:4,6`
- Entwined Realities、Coal Stoker、ビルド別のSpirit条件など、一部辞典例の現行の数値・適用条件。価格・耐久・所要時間の評価は、原典で言及されていても比較実測ではありません。
- サポートジェムを例外なくCorruptできないという一般化。反証は確認していませんが、現在の明確な公式規則・データフラグによる全例の確認は未完了です。
- 全ストアの正式版の最終入手手順、1.0の最終移行実装・各ビルド成立。既発表の予定・方針と、将来の実装確認を区別します。

## 取得制限・実測の限界

- Maxroll原典12ページは今回再取得できませんでした。既存引用・更新日・対応版の全面再確認は未完了です。取得できないこと自体は誤りの証拠ではありません。
- Mobalyticsの正確な段階タブは一部未取得です。MonkのLeveling Whirling 41+、TwisterのEarly Atlas、Shield WallのAct 2 Swap/Act 3、Rangerのlv24–30/lv31–41が該当します。既定タブの抽出を別タブの証明に使っていません。
- ゲーム内の日本語設定・コントローラー操作、ジェムや装備の実際の入手、全育成ルートの実走、同条件のDPS・耐久・SSF到達・市場価格は実測していません。
- 生成・回帰テストは情報の構造と表示整合性の検査です。現行クライアント、実機性能、全画面の視覚確認を代替しません。既存のラスター画像は維持しました。
- 運営者・プライバシー・利用規約ページはサイトの自己説明です。法的適合性を認証したものではありません。

この点検では、裏付けのある訂正と出典の適用範囲を反映しました。全75ページの全ての文、全ビルド、全ての将来の仕様が確認済みとはしていません。
