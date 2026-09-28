# ExileCon 2026 直後の更新手順書（SEOロードマップ P3）

ExileCon 2026 は 2026-11-07〜08（ニュージーランド時間）、オークランドで開催
（出典：Steamニュース公式「ExileCon 2026」2026-01-28、`/poe2-1-0/` に掲載）。
11月のニュージーランドは夏時間（UTC+13）なので、日本時間は現地より4時間遅い。
発表の時刻は未確認。**目標：発表から48時間以内に、確認できた内容だけをサイトとnoteに反映する。**

## 0. 事前準備（済み・2026-09-28）
- `/poe2-1-0/` と `/poe2-1-0/duelist/` に「ExileCon 2026で発表予定」の節を追加済み。
- `/poe2-1-0/pre-registration/`（事前登録）を公開済み。登録者には公式からExileConの発表メールが届く。
- note見出し画像の生成スクリプト：`tools/note-header.mjs`。

## 1. 一次情報を集める（発表後すぐ）
WebSearch・WebFetchの要約は誤りがあったため、**必ず原文で確認**する。
- Steamニュース（公式）：
  `curl -sS 'https://store.steampowered.com/events/ajaxgetpartnereventspageable/?clan_accountid=0&appid=2694490&offset=0&count=50&l=english'`
  → `events[].event_name`、`announcement_body.body`、`gid`（記事URLは `https://store.steampowered.com/news/app/2694490/view/<gid>`）
- 公式フォーラム「Early Access Announcements」（生HTMLを `curl`）：https://www.pathofexile.com/forum/view-forum/2211
- 公式サイト：https://pathofexile2.com/ 、https://pathofexile2.com/exilecon
- 配信内容だけで出た情報は、公式の文章（ニュース・フォーラム・X）で裏付けが取れるまで「発表で示された」と書き、断定しない。

## 2. 反映の優先順（検索需要の大きい順）
| 順 | 確認すること | 更新するファイル・ページ |
|---|---|---|
| 1 | 1.0の公開日に変更があるか | `data/site.json` `nextGameVersionReleaseDate`、`data/discovery.json` `poe2One`、`/poe2-1-0/release-date/` |
| 2 | Duelistのアセンダンシー・武器・スキル | `data/seo-pages.json` の `/poe2-1-0/duelist/`（ビルド・Tierは載せない） |
| 3 | EAのキャラ・リーグ・課金の1.0での扱い | 新規ページ `/poe2-1-0/early-access-characters/`（ロードマップP1-6）、`/poe2-1-0/how-to-start/` の未確認欄 |
| 4 | Mac対応・アカウント作成手順・コンソール版の日本語 | `/poe2-1-0/how-to-start/`、`/poe2-1-0/system-requirements/`、`/poe2-1-0/japanese/` の未確認欄 |
| 5 | 事前登録の残り報酬・節目の人数 | `/poe2-1-0/pre-registration/` |
| 6 | キャンペーン・エンドゲームの変更 | `/poe2-1-0/` の「Early Accessから何が変わる？」 |

各ページ共通：
- 確認できた項目を「まだ確認できていないこと」から本文へ移す。
- `sources` に出典を追加し、`checkedAt` をその日の日付にする。最終確認日は、ページ内で最も新しい `checkedAt` になる。
- FAQに問答を追加する。1.0ページではFAQPageの構造化データが自動で生成される。
- `/poe2-1-0/` の `confirmed` / `unconfirmed`（`data/discovery.json`）と更新履歴を更新する。
- 0.5.5のビルド内容はこの段階では変えない（`tools/RELEASE_1_0.md` の方針どおり）。

## 3. 生成・確認・公開
```
node tools/generate-pages.mjs && node tools/generate-sitemap.mjs && node tools/enhance-ratings.mjs && node tools/enhance-build-ux.mjs && node tools/enhance-version-notice.mjs && CHROMIUM_PATH=/opt/pw-browsers/chromium node tools/generate-og-images.mjs && node tools/sync-asset-versions.mjs && npm test
```
スマホ幅（390px）でスクリーンショットを撮って確認してから、mainにpushする。

## 4. note記事（サイト更新と同じ日に）
- 型は `company/memory/content-playbook.md`（結論→理由→方法→次の行動）。本文はサイトに載せない。
- 見出し画像：
  `CHROMIUM_PATH=/opt/pw-browsers/chromium node tools/note-header.mjs "ExileCon 2026 発表まとめ" "<確定した要点>" <出力先>.png "EXILECON 2026"`
  （出力先はリポジトリ外。公式アートワークは使わない）
- サイトへのリンクはUTM付き（`NOTE_CONTENT_MAP.md` の「投稿テーマ別リンク」を参照）。
- 投稿はユーザーが行う（アカウント操作はしない）。

## 5. 最後に
- `company/memory/seo-roadmap.md` のP3・P1-6の状況を更新する。
