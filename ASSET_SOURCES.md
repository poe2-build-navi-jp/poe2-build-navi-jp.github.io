# 画像素材台帳

最終確認日: 2026-09-26

## 公式素材の調査結果

### 確認した一次情報

- Grinding Gear Games「Path of Exile & Path of Exile 2 - Terms of Use」
  - URL: https://www.pathofexile.com/legal/terms-of-use-and-privacy-policy
  - 確認日: 2026-09-26
  - 条項4: ゲーム・Webサイトの画像、ロゴ、グラフィック等の権利はGrinding Gear Gamesまたはライセンサーに帰属。
  - 条項6: 明示されたライセンスは個人的・非商用利用に限定。
  - 条項7: 書面による事前承認なしの複製、表示、公開、派生物作成等を制限。
  - 条項24: リンクにGGGのロゴ・商標・専有グラフィックを使うには明示的な事前承認が必要。

### 利用可否

- 利用可能と確認できた公式画像: なし
- 利用条件不明のため見送り: Path of Exile 2 Press Kit、公式キーアート、クラス画像、Ascendancy画像、公式ロゴ
- 使用禁止として扱う範囲: Google画像検索、攻略サイト、Wiki、Reddit、YouTube、X、ファンアートからの転載
- 代替: 下記のPOE2ビルドナビ独自図解。公式画像、ゲーム内画像、第三者画像は含めない。

広告掲載サイトでの利用、改変、合成、OGP利用を明示的に許可するPress Kit内ライセンスまたはGGGの書面承認を確認できるまで、公式素材は追加しない。

## 独自画像

全画像の提供元はPOE2ビルドナビ。`data/builds.json`、`data/classes.json`、`data/discovery.json`にある確認済み情報から`tools/generate-image-assets.mjs`で生成する。外部画像は使用しない。

| ファイル | 生成元 | 改変 | 使用ページ |
|---|---|---|---|
| images/poe2/guides/poe2-beginner-recommended-builds.svg | discovery/builds | 可 | / |
| images/poe2/guides/poe2-beginner-build-tier.svg | discovery/builds | 可 | /tier-list/ |
| images/poe2/guides/poe2-league-starter-builds.svg | discovery/builds | 可 | /league-starter/ |
| images/poe2/guides/poe2-leveling-guide.svg | サイト導線 | 可 | /leveling/ |
| images/poe2/guides/poe2-recommended-classes.svg | classes | 可 | /classes/ |
| images/poe2/classes/poe2-{class}.svg | classes | 可 | 各職業ページ |
| images/poe2/builds/poe2-{build}-leveling-roadmap.svg | builds.levelingStages | 可 | 主要5ビルド |
| images/poe2/og/*.webp | 上記独自図解とページ役割 | 可 | 主要18ページのOGP |

## 更新手順

1. 元データを確認・更新する。
2. `node tools/generate-image-assets.mjs`で図解を再生成する。
3. `node tools/enhance-image-seo.mjs`と`node tools/generate-sitemap.mjs`を実行する。
4. 本文と画像内情報、alt、OGP、画像サイトマップが一致していることをテストする。

公式素材を将来追加する場合は、元URL、Press Kit名、取得日、対象媒体での利用条件、クレジット要否、改変可否、使用ページを個別に追記する。
