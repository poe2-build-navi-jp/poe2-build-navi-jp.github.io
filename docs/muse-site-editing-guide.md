# MUSEへの指示書：POE2ビルドナビのページを編集するとき

作成：2026-11-18。リポジトリ `poe2-build-navi-jp/poe2-build-navi-jp.github.io`。

## 1. 何が起きたか

- 2026-11-18 19:50〜19:56に、「ビルドページにnote有料記事への導線を追加」というコミットが14件、mainに直接入りました。14ページのHTMLを直接書き換え、`</main>` の直前に `<!-- note-paid:start -->`〜`<!-- note-paid:end -->` の導線を足すものでした。
- このサイトは、ページの中身が変わると `data/page-dates.json`（ページごとの内容ハッシュと更新日の台帳）を更新する仕組みです。HTMLだけを書き換えると台帳と中身が食い違い、公開前のテスト `scripts/test-page-dates.mjs` が `Ledger drift` で失敗します。
- そのため「Deploy site to GitHub Pages」が #105〜#118 で失敗し、公開サイトの更新が止まりました。
- さらに、`npm run build`（全体ビルド）はページを生成し直すので、手で足した導線は14ページすべてから消えていました。
- 手で編集したHTMLには、公開時にだけ付く印 `<meta name="poe2-release">` も紛れ込んでいました。この印はデプロイの途中で `tools/stamp-mobile-release.mjs` が自動で付けるもので、ソースに入れてはいけません。

## 2. どう直したか

| PR | 内容 |
|---|---|
| #114 | 14ページの日付台帳を正規の手順で同期し、公開を再開（Deploy #120 成功） |
| #115 | note導線をデータ化。全体ビルドでも消えないようにした |

#115 の仕組み：
- 導線の中身は `data/note-paid.json` にあります。1件につき `path`（ページ）、`title`（見出し）、`lead`（説明文）、`href`（noteのURL）、`linkText`（リンクの文言）です。
- ビルド手順 `tools/enhance-note-links.mjs` が、このデータから導線を作り、各ページの `</main>` 直前（1.0の案内の後ろ）に入れます。
- この手順は、日本語名の付与（`localize-japanese-names`）の後、日付台帳の記録（`generate-sitemap`）の前に実行されます。文言は書いたとおりに表示され、変更は台帳に正しく記録されます。
- `scripts/test-note-paid.mjs` で、データとページの一致、表示位置、再ビルドしても変わらないことを確認しています（`npm test` に含まれます）。

## 3. これからの作業手順（必ず守る）

### noteの導線を追加・変更・削除するとき
1. `data/note-paid.json` を編集する。HTMLは触らない。
   - 追加：配列の末尾に1件足す。`href` は `https://note.com/` で始まるURLだけです（それ以外はビルドでエラーになります）。
   - 変更：該当する件の `title`・`lead`・`href`・`linkText` を直す。
   - 削除：該当する件を配列から消す。
2. `npm run build` を実行する（ページ生成から日付台帳の更新までを一度に行います）。
3. 内容が変わっていないOG画像の差分を戻す：
   `git diff --name-only -- 'images/poe2/og/*.webp' | xargs -r git checkout --`
4. テストを実行し、すべてPASSすることを確認する：
   `npm test`
   （必要に応じて `npm run test:dates`、`npm run test:usability`）
5. 作業ブランチにコミットし、PRを作る。**mainに直接プッシュしない。**

### 導線以外の本文を変えるとき
- ページのHTMLを直接編集しないでください。ページは `data/*.json` と `tools/*.mjs` から生成されます。元のデータか生成スクリプトを直し、`npm run build` で作り直します。
- 迷ったら、変えたい文言を `data/` と `tools/` から検索し、出どころを先に見つけてください。
  例：`grep -rn "探したい文言" data tools`

### 公開済みのページを見本にしないでください
- 公開サイトのHTMLには、公開時に付く印（`poe2-release`）などが入っています。公開ページをコピーしてソースに貼ると、同じ問題が起きます。

## 4. やってはいけないこと

- HTMLの直接編集（日付台帳とずれて公開が止まります。次の全体ビルドで消えます）
- `data/page-dates.json` のハッシュや日付の手書き（必ずビルドの手順で更新します）
- テストを消す・飛ばす・失敗のまま main に入れること
- mainへの直接プッシュ（作業ブランチ → PR → チェックが通ってからマージ）

## 5. 公開が止まったときの確認方法

1. GitHubの Actions で「Deploy site to GitHub Pages」の失敗したステップとエラー文を見る。
2. `Ledger drift: /〜/` と出ていたら、そのページのHTMLが台帳を通さずに変わっています。テストは最初の1件で止まるので、同じ時期に編集したページはすべてずれている前提で確認してください。
3. 直し方：元の変更をデータか生成スクリプトに移してから `npm run build`。手で入れた変更を残す必要がある場合は、日付同期の手順だけを順に実行します（#114 の方法）：
   ```
   SITEMAP_DATE=YYYY-MM-DD node tools/generate-sitemap.mjs
   node tools/enhance-page-schema.mjs
   node tools/enhance-editorial-trust.mjs
   node tools/sync-asset-versions.mjs
   ```
   `YYYY-MM-DD` には、実際に変更した日（日本時間）を入れます。
4. `npm run test:dates` がPASSしてからPRを作ります。

## 6. 参考
- 作業記録：`company/memory/decisions.md`（2026-11-18 の項）
- ビルド手順の一覧：`tools/build-steps.mjs`
- 導線のデータ：`data/note-paid.json`
- 導線を入れる手順：`tools/enhance-note-links.mjs`
