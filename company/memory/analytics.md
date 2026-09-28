# Googleアナリティクスの記録

GA4プロパティ「POE2ビルドナビ」（プロパティID 555048065、測定ID G-ZTQ4RYVHPC）。
同じGoogleアカウントに別サイトのプロパティもあるため、見るときはプロパティを切り替えて確認する。
閲覧はユーザーがログインしたクラウドブラウザで行い、設定は変更しない。

## 2026-09-28 確認（過去28日＝8/31〜9/27。実際の計測データは9/19ごろから）

- 表示回数433、アクティブユーザー94、セッション133、キーイベント0（未設定）。

### 流入元（セッション）
| 参照元 / メディア | セッション | エンゲージメント率 | 平均エンゲージメント時間 |
|---|---|---|---|
| (direct) / (none) | 78 | 35.9% | 52秒 |
| bing / organic | 24 | 83.3% | 1分00秒 |
| note.com / referral（＋note / referral 1） | 17（＋1） | 70.6% | 1分51秒 |
| google / organic | 5 | 100% | 1分59秒 |
| chatgpt.com / ai-assistant | 4 | 50% | 10秒 |
| (not set) | 4 | 0% | 6秒 |

### 表示回数の多いページ
| ページ | 表示回数 | ユーザー | 平均エンゲージメント時間 |
|---|---|---|---|
| / | 91 | 52 | 12秒 |
| /builds/monk/whirling-assault/ | 42 | 8 | 1分05秒 |
| /builds/witch/minion-infernalist/ | 33 | 10 | 1分29秒 |
| /builds/ranger/ice-shot-deadeye/ | 30 | 8 | 2分43秒 |
| /tier-list/ | 22 | 8 | 29秒 |
| /builds/ | 19 | 14 | 47秒 |
| /league-starter/ | 19 | 9 | 29秒 |
| /builds/mercenary/twister-gemling/ | 17 | 5 | 1分27秒 |
| /gear-check/ | 17 | 12 | 25秒 |
| /poe2-1-0/ | 15 | 5 | 47秒 |

### 気づいた点
- Google自然検索が5セッションしかなく、Bing（24）より少ない。Googleでのインデックス状況をSearch Consoleで確認する必要がある。
- noteからの流入は滞在が長い（平均1分51秒）。note経由の導線は機能している。
- トップページは表示回数が最多だが平均12秒と短い。ビルド詳細ページは1〜3分読まれている。
- 存在しないURLへのアクセスが2件（どちらもサイト内のリンクではない。外部の記事などのリンク誤りとみられる）。
  - /builds/ranger/ice-shot-deadeye/) … 末尾に「)」が付いたURL
  - /builds/warrior/shield-wall/ … 正しくは /builds/warrior/shield-wall-smith/
- キーイベント（コンバージョン）が未設定のため、成果の計測ができていない。
