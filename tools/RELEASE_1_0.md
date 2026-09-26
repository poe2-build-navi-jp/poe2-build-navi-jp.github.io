# PoE2 1.0 リリース手順書

正式版1.0の公開予定日は 2026-12-11（PST）です（`data/site.json` `nextGameVersionReleaseDate`、
出典は `data/discovery.json` `poe2One`）。本サイトの方針どおり、**確認できた内容だけ**を1.0対応として
表示し、未確認の育成手順は削除せず「1.0では未確認」と明示して残します。

残作業はいつでも次のコマンドで確認できます（読み取り専用）。

```
node tools/release-readiness.mjs
```

## いま（リリース前）

- 0.5.5の掲載内容は変更しない。1.0の予想・推測ビルドは掲載しない。
- 公式から1.0の情報（パッチノート、Duelistのスキル・アセンダンシー）が出たら、
  `data/discovery.json` `poe2One` と `/poe2-1-0/` 系ページを更新する。
- 1.0対応の元ガイド（Maxroll・Mobalytics等）が各ビルドで出ているかを定期的に確認する。

## リリース当日

1. 公式サイトで1.0の公開を確認する（予定日の変更に注意）。
2. `data/site.json` の `gameVersion` を `"1.0"` にする。`siteVersion` はまだ変えない
   （サイトの主な内容が1.0対応になった時点で変える）。
3. 次を実行する。全ビルドページに「1.0では未確認」、一覧・Tier・職業ページ等に案内バナーが出る。
   ```
   node tools/enhance-version-notice.mjs
   node tools/sync-asset-versions.mjs
   npm test
   ```
4. `/poe2-1-0/` に「公開済み」と確認日を反映する。
5. PRを作ってマージし、本番で表示を確認する。

## ビルドごとの再確認（1本ずつ）

1.0対応の元ガイドが出たビルドから、次をすべて確認する。どれかを確認できない場合はそのビルドを1.0対応にしない。

- [ ] 主力スキル・サポートジェムが1.0に存在し、名前と解禁Lvが一致する（8段階すべて）
- [ ] アセンダンシーとキーとなるパッシブが削除・大幅変更されていない
- [ ] 必須ユニーク・装備条件、SSF可否が元ガイドと一致する
- [ ] 元ガイドが1.0対応と明記している（`sources` に1.0の確認日で追加・更新する）
- [ ] 5項目評価の根拠（`ratingEvidence`）を1.0対応ガイドの長所・短所で見直す
- [ ] `nowActions` と各段階の本文を必要な分だけ更新する

すべて確認できたら、そのビルドの `version` を `"1.0"`、`updatedAt` を確認日にし、
`changeHistory` に変更内容を1行追記する。その後、次を実行する。

```
node tools/enhance-ratings.mjs
node tools/enhance-build-ux.mjs
node tools/enhance-version-notice.mjs   # そのビルドの「未確認」表示が消える
node tools/generate-og-images.mjs
node tools/sync-asset-versions.mjs
npm test
```

大きく変わって元ガイドが見つからないビルドは、`status` を `"needs-review"` にする（ページは
noindexになり、ビルド一覧の扱いも変わる）。1.0で成立しないと確認できたビルドは掲載を見直す。

## 主要ビルドの確認後

- タイトル・見出しの「0.5.5」表記を1.0へ変更する。`release-readiness.mjs` の一覧で、
  タイトルに含むページから優先する。生成スクリプト（`tools/generate-*.mjs`）側の表記も同時に直す。
- `siteVersion` を `"1.0"` にし、OG画像（`generate-og-images.mjs`）を再生成する。
- Duelistを `data/classes.json` に追加し、確認済みビルドができた時点で職業ページを公開する。
  テスト（`scripts/test-site.mjs` の職業数・ビルド数）も合わせて更新する。
- Tier・目的別おすすめは、1.0で確認済みのビルドだけで組み直す。
