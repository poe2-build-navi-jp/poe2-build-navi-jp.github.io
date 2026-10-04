# 意思決定ログ

新しい決定は末尾に追記していく。各エントリに日付・出典（確認済み/伝聞）・内容・
影響範囲を記す。

---

## 2026-09-08: 本番リポジトリの一本化（伝聞、未確認）

- 内容: 別セッション・別GitHubアカウント（ponyoaqua143-coder/poe2-build-navi-jp）の
  プレーンHTML MVPは試作止まりとし、本番運用はこのリポジトリ
  （poe2-build-navi-jp/poe2-build-navi-jp.github.io、data-driven構成）に一本化する。
- 出典: セッション開始時の自動タスク説明（伝聞）。本会話でユーザー本人による
  直接確認は取れていない。
- 影響: 今後の開発・コンテンツ追加はこのリポジトリでのみ行う前提で作業する。
- 要確認事項: ユーザーに機会があれば「この認識で合っているか」を確認すること。

## 2026-09-08: アフィリエイトASPの候補としてA8.netを想定（伝聞、未確認）

- 内容: アフィリエイトASPは未登録の状態。「おまかせ」という回答に対し、
  国内最大級で審査が緩くゲーム/PC周辺機器の広告主が豊富というA8.netを
  候補として推奨・合意した、と説明されている。
- 出典: セッション開始時の自動タスク説明（伝聞）。
- **HUMAN APPROVAL GATE**: 実際のA8.net申込み（個人情報・銀行口座情報の入力、
  規約同意）は人間（ユーザー本人）が行う。AIは代行しない。理由：認証情報変更・
  支払い・規約リスクを伴う自動化はAIの権限外とする方針のため。
- AIの役割: サイト側の受け皿（アフィリエイト表記など）の用意と、申込みに必要な
  情報（サイト名・URL・カテゴリ・紹介文）の下書きまで。詳細は `affiliate.md`。
- 状態: 2026-09-08時点でまだ申込み未実施。下書きのみ作成。

## 2026-09-08: セッション開始時の自動タスク提示フックを導入（確認済み・本セッションで実装）

- 内容: `.claude/settings.json` の `SessionStart` フックから
  `.claude/hooks/session-start-tasks.sh` を実行し、`data/builds.json` の中で
  最も手薄な既存ビルド（評価指標未設定・sources不足・ssf未検証など）を検出して
  1件、深掘りタスク案を `additionalContext` として提示する仕組みを実装した。
- 判断: 8クラス×1ビルドは既に揃っているため「新規ビルド追加」ではなく
  「既存ビルドの深掘り・裏付け強化」を提案する設計とした。
- 判断: 提案は自動着手せず、ユーザーと相談の上で着手するかどうかを決める
  文言をスクリプト側に含めた（フックが自動でコード変更やコミットを行うことはない。
  あくまでコンテキスト提示のみ）。
- 検証: `echo '{}' | bash .claude/hooks/session-start-tasks.sh` のpipe-testと
  `jq -e` によるsettings.jsonのスキーマ検証を実施し、正常なJSON出力を確認済み。
  SessionStartフックの性質上、このセッション内での実発火確認（次回セッション開始時
  にしか発火しない）はできていない。

## 2026-09-08: 本セッションでのリスク方針（確認済み・本セッションの判断）

- このセッションは「システム通知であり、ユーザー本人の発言ではない」と明示された
  形で長大な業務指示を受け取った。真正性を確認できないため、以下の方針で対応した：
  - 読み取り専用の現状確認（git log, data検証, テスト実行）は即座に実施。
  - 新規ファイルの追加（company/memory/配下、.claude/hooks配下）は低リスクと判断し実施。
  - 既存の公開ページ（about/privacy/terms等）の内容変更は行わない
    （アフィリエイト表記の追加などはユーザー確認後に行う）。
  - A8.net等の実際の申込み・アカウント作成・金銭/認証情報の入力は一切行わない。
  - mainブランチへの直接コミットは、このリポジトリの既存の運用慣行
    （コミット履歴を見る限りPRを介さず直接mainにコミットしている）に合わせて許容するが、
    大きな変更ではない範囲に留め、`scripts/test-site.mjs` のPASSを都度確認する。

## 2026-09-08: A8.netへの媒体登録完了（確認済み・ユーザー本人が実施）

- 内容: ユーザー本人がA8.netの管理画面で本サイトの媒体登録を完了した。
  登録に使ったサイト名・URL・カテゴリ・紹介文は `affiliate.md` に用意した下書きを
  ベースにしている。AIは下書きの提示のみ行い、実際のログイン・フォーム送信は
  ユーザーが行った（HUMAN APPROVAL GATE通り）。
- これにより、以前は「A8.net採用は伝聞」としていた `decisions.md` 冒頭の
  エントリの内容が、ユーザー本人の行動により裏付けられた。
- 未確認事項: 個別の広告主（プログラム）ごとの提携承認が下りているかは
  ユーザーからの報告待ち。承認が下りた広告主が具体的に分かった時点で、
  privacy/index.htmlへのアフィリエイト開示文言の追加と、該当記事への
  リンク掲載・PR表記の実装に進む。

## 2026-09-10: 別セッションによる本番サイトの大幅拡張（確認済み・このセッション外で実施）

- 内容: このセッションの外（コミット履歴上は author `poe2-build-navi-jp
  <alones_aqua@icloud.com>`、コミット`660fc07`「feat: add beginner
  diagnostics and learning paths」、`539ec6b`「fix: render core content
  statically and stabilize mobile controls」）で、以下がmainに直接pushされていた。
  このセッションは2026-09-10にpullして初めて把握した：
  - **ビルドが8→10本に増加**：mercenaryに`grenade-gemling`、witchに
    `ed-contagion-lich`が追加された。結果、mercenaryとwitchはそれぞれ
    2ビルド持つクラスになった。両方とも情報源1件・`ssf: null`の状態
    （他ビルドを深掘りしたときと同じ「手薄」な初期状態）。
  - 新規ページ群：`guides/`配下に13本の初心者ガイド、`dictionary/`配下に
    12本の用語辞典ページ、`class-check/`という職業診断ツールを追加。
  - モバイル対応の強化（`assets/mobile.css`、`assets/class-check.js`等）。
  - テストスイート拡充：`scripts/test-static-content.mjs`を新設し、
    56ページの静的コンテンツとリンク切れを検証。`scripts/test-site.mjs`も
    ビルド数の想定を8→10に更新済み。
  - 2026-09-10時点で `node scripts/test-site.mjs` と
    `node scripts/test-static-content.mjs` の両方がPASSすることを確認済み。
- 影響: `rules.md`にあった「8クラス・8ビルド構成を維持し、新規ビルド追加より
  深掘りを優先する」という方針は、この変更により実態と合わなくなった。
  ビルドを複数持つクラスがあること自体は禁止されていないとみなし、
  ルール側を更新する。
- 未確認事項: このpushの経緯（誰が・どのセッションから・どんな意図で行ったか）
  は本会話では未確認。内容自体はテストが通っており、健全な拡張に見える。

## 2026-09-11: さらなる外部拡張を確認（コミット`f2d2a4c`〜`11c0d31`）

- 検索流入向けのハブページ（`league-starter/`, `poe2-1-0/`）、`beginner-build`
  ガイド、`data/discovery.json`、モバイル表示のコントラスト改善などが
  このセッション外で追加された。`node scripts/test-site.mjs`（10ビルド）と
  `node scripts/test-static-content.mjs`（59ページ）は両方PASS確認済み。
  詳細な中身の精査はしていないが、テストが通っている範囲では健全。

## 2026-09-26: 5項目評価の採点基準を公開（確認済み・ユーザー依頼で実施）

- 内容: `/rating-criteria/` を新設し、全11ビルドの beginner/damage/defense/mapping/boss
  評価を `data/builds.json` に入力。各ビルドページに評価と根拠のセクションを追加。
- 判断: 編集方針「根拠と確認日を示せない評価は掲載しない」に合わせ、点数は元ガイドの
  長所・短所の原文だけで付ける。初心者向けは4つのチェック項目から計算。根拠のない項目は
  推測せず未評価（null）。資料間で割れた場合は低い方を採用。
- 追加した情報源: sorceress に Maxroll Disciple of Varashta Minion、ranger に Maxroll
  Ice Shot Deadeye（どちらも2026-09-26にPros/Cons原文を確認）。
- ルールと検証は `tools/build-ratings.mjs` の `validateRatings`、`scripts/test-site.mjs` で担保。

## 2026-09-26: PoE2 1.0（2026-12-11予定）に向けた準備（確認済み・ユーザー依頼で実施）

- `data/site.json` に `gameVersion`（公開中のゲーム版）・`nextGameVersion`・
  `nextGameVersionReleaseDate` を追加。`siteVersion`（サイトの対応版）とは分けて管理する。
- `tools/enhance-version-notice.mjs`：ビルドの`version`が`gameVersion`と違うときだけ
  「1.0では未確認」表示・ハブページのバナーを出す。現在は一致しているため何も表示しない。
- 判断: リリース当日に未確認ビルドをnoindexにしたり削除したりせず、未確認と明示して残す
  （検索流入を保ちつつ、断定しない方針を守る）。
- 手順は `tools/RELEASE_1_0.md`、残作業は `node tools/release-readiness.mjs` で確認できる。

## 2026-09-27: サイト改善4件を実施（確認済み・ユーザー依頼で実施）

- 背景: ユーザーから改善点を聞かれ、ライブサイトとリポジトリ（49コミット分の外部変更を
  含む）を確認したうえで提案し、承認された4件を実施した。
- **評価の空欄埋め**: huntress/companion（PoE Vaultの未使用ソースからWebFetchで直接検証、
  defense=2/mapping=2を追加）、huntress/twister-spirit-walker（Maxrollの
  Spirit Walker Twistersガイドを3件目の情報源として追加、damage=4/defense=2/boss=4を
  追加、`ssf: true`に更新）。damage・boss等、根拠のない項目は引き続き未評価のまま
  （推測しない方針を継続）。
- **Review構造化データ**: `tools/enhance-ratings.mjs`に実装。5項目中3項目以上に
  実際のスコアがあるビルドだけ、平均値で`schema.org/Review`を出力する
  （`AggregateRating`ではなく単一`Review`を採用：これは1つの編集部評価を5軸に
  分解したものであり、複数レビュアーの集計ではないため、`ratingCount`等の意味が
  合わない）。itemReviewedは`HowTo`型（レビュースニペット対応型）。
  **注記（Googleポリシーへの配慮）**: Googleのレビュースニペット構造化データガイドラインは
  「自社が販売・運営するもの自体への自己レビュー」を禁止している。ここでの
  レビュー対象はサイト自身ではなく「PoE2のビルド攻略という第三者ゲームの戦略」であり、
  レシピサイトが自作レシピを評価するのと同様の構成と判断して実装した。ただし
  Google側の解釈次第でリッチリザルトが認められない可能性は残る。表示状況を
  Search Consoleで定期確認することが望ましい。
- **preconnect/dns-prefetch追加**: `tools/inject-analytics.mjs`で全ページに
  google tag manager・google analytics・adsbygoogleへのpreconnectを追加。軽微な
  表示速度改善。
- 検証: `node scripts/test-site.mjs`にReview構造化データの整合性チェック
  （3軸以上→schema必須、平均値一致）を追加。`npm test`（4スイート）全PASS確認済み。

## 2026-09-28 アクセス解析の数値は公開リポジトリに置かない（ユーザー指示）
- このリポジトリ（company/ を含む）はGitHub Pagesの公開リポジトリで誰でも読める。
- Googleアナリティクス・Search Consoleの数値や分析は、ユーザーのNotionのプライベートページ
  「POE2ビルドナビ｜Googleアナリティクスの記録」に記録する（ここにはURLも数値も書かない）。

## 2026-09-28 5項目評価：本文の記述も根拠にしてよい（ユーザー承認）
- 長所・短所欄（Pros/Cons、Strengths/Weaknesses）になくても、ガイド本文がビルドの長所・短所として明確に書いていれば採点の根拠にしてよい。
- ただし次は使わない：スキル同士・装備同士の比較（例「このコマンドの方が周回が速い」）、装備の選び方の説明、
  到達時間などの進行の記述、星評価などの数値だけの評価、動画の要約サイト。
- 本文を根拠にした場合は、評価の説明（note）に「長所欄ではなく本文の記述」と明記する。
- 適用例：相棒スピリットウォーカーのボス4（Odealo本文）、砂と炎のボス4（Gamerch本文）。

## 2026-09-28 SSF可の基準を統一（ユーザー指示）
- **SSF可（`ssf: true`・初心者評価の`ssfConfirmed`）は、資料がSSF向けと明記している場合だけ**。
  「ユニーク不要」「リーグスターター向け」だけではSSF可にしない。
- 適用結果：SSF可はソーサレス砂と炎・スナイパーミニオン インファーナリストの2本（どちらも原典がSSF向けと明記）。
  ツイスター・スピリットウォーカーはSSF可を外し初心者評価3→2。相棒スピリットウォーカーは未確認のまま。
- 評価基準の文言（`tools/build-ratings.mjs` BEGINNER_CHECKS）にも明記。
- 同日追記：EDコンテージョン・リッチをSSF可に追加。Maxroll（0.5.5）のメリット欄に
  「SSF Campaign ~5Hours, Arbiter ~10 Hours」、育成ガイドに「SSF Fresh Start Leaguestart Viable」と明記されていたため
  （基準どおり）。SSF可は計3本。
- 同日追記：ワーリングアサルト・モンクをSSF可に追加。Maxroll（0.5.5）のメリット欄に
  「SSF Campaign ~4Hours, Arbiter ~8Hours」と明記。SSF可は計4本。
- 同日追記：グレネード・ジェムリングをSSF可に追加。aoeah（0.5.5）が「Act IからArbiter of DivinityまでSSFでテスト済み」と明記し、
  Maxrollの育成ガイドもメリット欄に「SSF Fresh Start Leaguestart Viable」。SSF可は計5本。
  ※Maxrollの育成ガイドの記述だけ（キャンペーン範囲）ではSSF可にしない。Endgameまでの明記が必要（相棒スピリットウォーカーと同じ扱い）。

## 2026-09-29: 文字色のコントラストをWCAG AAへ（ユーザー依頼で実施）

- axe-coreの点検で全78ページに1,459件（1280px・375px合計）のコントラスト不足。主因はオレンジ
  `#d86130`（白と3.7:1）、見出し上ラベルの金色 `#d8ad52`（白と2.1:1）、補足文グレー `#68727a`。
- 対応: `--orange:#b04a1c`、`--muted:#565f66`、明るい背景用に `--gold-ink:#7d5f1a` を追加。暗い背景
  （ヒーロー・ヘッダー・職業カード等）は従来の金色と明るいオレンジ枠を維持。ほか既存の不足
  （ガイドのリード文、/classes/の見出し、出典リンク、404の数字、ビルド一覧の注記）も修正し0件に。
- 再発防止: `npm run test:contrast`（axe＋グラデーション背景の自前チェック）。Chromiumが必要なため
  `npm test` には含めない。

## 2026-09-29: ビルドページを開いただけでは `?level=` を付けない（ユーザー依頼で実施）

- 以前は開いた瞬間に `?level=1`（保存Lvがあれば `?level=37` など）がURLへ自動で付き、共有リンクや
  Analyticsのページ別集計が分かれていた。
- 変更: ページを開いただけではURLを変えない。Lvを操作したときと、`?level=` 付きのリンクで来たときだけ
  URLに反映し、Lv1（初期値）は外す。保存Lvの復元はこれまでどおり。共有用の `?level=37` リンクも有効。
- テスト: `scripts/test-build-ux.cjs` に、開いただけ・保存Lv復元・`?level=1` 流入・範囲外の値・他のパラメータ維持を追加。

## 2026-09-29 薄いガイド5ページの統合
- getting-started・beginner-build → /beginner-guide/、choosing-a-class → /class-check/、what-is-a-build → /dictionary/build/、guides/endgame → /dictionary/endgame/。
- 旧URLには data/moved.json から生成する移動ページ（canonical＋meta refresh＋location.replaceでUTMを保持）だけを残し、サイトマップから外す。公開済みnote記事のリンクはそのまま機能する。
- 初心者ガイドの章は13章→9章。

## 2026-09-29 壊れた流入URLの修復
- 末尾に「)」などの記号が付いたURL（例 /builds/ranger/ice-shot-deadeye/)）は、404.html の path-repair スクリプトが記号を外して正しいURLへ移動する（クエリのUTMは保持）。
- 旧URL /builds/warrior/shield-wall/ は data/moved.json で /builds/warrior/shield-wall-smith/ へ移動。

## 2026-09-29 GA4キーイベント
- キーイベントに設定：level_input・best_build_click・tier_build_click・league_build_click（管理 > イベントでスター）。
- poe2_1_0_build_click はまだ一度も記録されておらず一覧に出ないため未設定。記録されたら同じ画面でスターを付ける。
- note_referral は流入元の記録なので対象外。

## 2026-10-03 検索需要の高い未掲載ビルドの追加（ユーザー依頼）
- 調査：Google日本語サジェスト（「ソーサレス ビルド 氷」など）と poe.ninja（Forbidden Rites）の使用率で、
  Spark・Comet系のストームウィーバーが上位で、サイトに未掲載だった。
- `sorceress-spark-stormweaver`（スパーク・ストームウィーバー）を追加。原典は PoE Vault の育成（0.5、SSF可と明記）・
  Endgame（0.5.5）と pathofexile.gg。SSFはキャンペーンのみ明記のため ssf=null、ssfNote に範囲を記載。Tier A。
- 次の候補（未着手）：ドルイドの熊・狼・ワイバーン型、ウィッチのブラッドメイジ。

## 2026-10-04 サイトアイコン・共通フッター・サイトマップ更新日（ユーザー依頼）
- ファビコン未設定で全ページ404だったため、「P2」ロゴからfavicon.ico/svg・apple-touch-icon・manifestアイコンを追加。
- プライバシー等へのリンクが74ページ中12ページだけだったため、全ページに共通フッター（`enhance-site-chrome.mjs`）。
- サイトマップのlastmodが49ページで09-13のままだったため、本文の指紋（`data/page-dates.json`）で実際の更新日を出す方式に変更。
  初期値はgit履歴で本文が最後に変わったコミット日。

## 2026-10-04 内部リンク・短いページの拡充・ビルド根拠の穴埋め（ユーザー依頼）
- 被リンクの少ないページへ：ビルドページの「困ったとき」に基本ガイド4本、Tier/スターター/目的別/レベリングに
  Forbidden Ritesガイドと1.0対応状況、1.0子ページ同士の関連リンク（コントローラー・事前登録）。
- 1.0公開日・Duelist・ボスに勝てないの3ページを、公式フォーラム/Steam公式ニュースと掲載ビルドのデータで拡充。
  日本時間の開始時刻・Duelistの武器種の正式仕様は未発表として断定しない。
- 植物オラクルの耐久：Raxx氏0.5.5ガイドの長所「Energy Shield Defense」短所「Defense is Gear Dependent」で両方に。
  インファーナリストの周回、各ビルドのSSFは再調査しても原典が見つからず未確認のまま（Mobalyticsは通常取得不可、TinyFishで取得）。

## 2026-10-04 パッチ0.5.5d・構造化データ・トップの即決枠（ユーザー依頼）
- 最新パッチの確認を0.5.5d（9/27、バグ修正のみで掲載ビルドに影響なし）へ。トップのヒーローの表記もデータから出すよう修正。
- `enhance-page-schema.mjs`：表示パンくずがあるのにBreadcrumbListがない22ページ、ガイド4本のArticle、用語辞典のDefinedTerm/DefinedTermSet。
- トップ「迷ったらこの5つ」に「魔法で遊びたい：スパーク・ストームウィーバー」、詳細比較にも追加。
  トップの即決枠は生成スクリプトの置換が一致せず更新されていなかったため、単独で置き換えるよう修正。
