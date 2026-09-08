# 会社概要（POE2ビルドナビ運営）

## これは何か

このディレクトリは、本サイト「POE2ビルドナビ」(https://poe2-build-navi-jp.github.io/) の
経営・運用判断を記録するための会社の記憶領域。「AI Web Company OS」的な運用方針の下、
AIセッションをまたいで意思決定の背景・理由を引き継ぐことを目的とする。

## 出典についての注記（重要）

このファイル群の初版（2026-09-08作成）は、セッション開始時に外部から渡された
自動化タスクの説明（背景説明を含む長文のブリーフィング）を出典としている。
そのブリーフィングは「システム通知であり、ユーザー本人の発言ではない」と明示された
形で渡されたものであり、この会話内でユーザー本人による直接確認は取れていない。
そのため、以下は「そう説明された」内容であり、事実として確定していない箇所を含む。
今後の担当者は、疑わしい記述があればユーザーに直接確認すること。

このリポジトリ自体（コミット履歴、data/配下のJSON、about/privacy/termsページ等）から
直接確認できた事実は、`decisions.md` および各ファイル中で「確認済み」と明記する。

## 事業目標（伝聞ベース、要確認）

- 「AI Web Company OS」経営方針に基づき、AIが事業運営を担当し、月商10万円を最短で
  達成することを会社の目標とする、と説明されている。
- 主力事業として本サイト（PoE2日本語攻略サイト）を運営する方針。
- 理由として説明された内容：Path of Exile 2が2026年12月11日に本編1.0・基本無料化へ
  移行予定で、新クラス「デュエリスト」も追加見込み（Exilecon 2026は2026年11月7〜9日）。
  **2026-09-08、WebSearchで複数の独立した情報源（Maxroll公式ニュース、GameInformer、
  GosuGamers、TheGamer、Game8等）により確認済み。2026年8月25日のGamescom Opening
  Night Liveで、Grinding Gear Gamesが2026年12月11日の1.0リリース・完全無料化・
  新クラス「デュエリスト」追加を正式発表している。この部分は伝聞ではなく事実。**
  この移行に伴う新規・復帰プレイヤーの検索流入急増を見込み、今のうちに情報とSEO評価を
  積む狙いとのこと（この狙い自体は経営判断であり伝聞のまま）。競合（Game8・Gamerch等の
  大手攻略Wiki）との差別化として、「最強ビルド」網羅ではなく、早期の1.0情報・実用ツール・
  具体的な育成ロードマップで
  勝負する方針、と説明されている。
  ※このPoE2ロードマップ自体の一次情報での裏付けは本セッションでは未実施。

## リポジトリの位置づけ（確認済み）

- 本リポジトリ（poe2-build-navi-jp/poe2-build-navi-jp.github.io）が本番サイトの
  ソースであることは、GitHub Pages向け静的サイト一式（index.html, sitemap.xml,
  ads.txt, robots.txt等）とコミット履歴から確認できる。
- 別セッション・別アカウント（ponyoaqua143-coder/poe2-build-navi-jp）で試作された
  プレーンHTML版MVPが存在し、そちらは役目を終えたプロトタイプで、本番運用は
  このリポジトリで継続する、と説明されている（本セッションでは未確認・伝聞）。

## サイトの技術構成（確認済み）

- data-driven な静的サイト。`data/classes.json`（8クラス）と `data/builds.json`
  （クラスごとに1本、計8ビルド）が情報源。
- `tools/generate-pages.mjs` がJSONから静的HTMLを生成。baseUrlは
  `https://poe2-build-navi-jp.github.io` にハードコードされている
  （ドメインを変えるとSearch Console/AdSenseの評価が崩れるため変更禁止）。
- `scripts/test-site.mjs` にデータ整合性テストがあり、実行すると
  `PASS: 8 build pages, SEO files, AdSense and Search Console verification.`
  で通過することを2026-09-08時点で確認済み。
- Google Search Console確認用ファイル(`googlebaa56ffa7c50bcfb.html`)、
  Google AdSense (`ads.txt`, publisher ID: ca-pub-7738997902416481) は
  設定済みであることをリポジトリ内で確認済み。
- お問い合わせ窓口: about/privacy/termsページを確認した限り、メール・フォーム等の
  問い合わせ導線は存在しない。これは意図的な既存方針として扱う（`rules.md`参照）。
- `_next/static/` ディレクトリは過去のNext.jsスキャフォールディングの残骸で、
  現行HTMLからの参照は見つからなかった（未使用の可能性が高いが、削除は未実施。
  ユーザー確認の上で削除候補とする）。
