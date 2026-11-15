# 日本語表記・内容・狭い本文列の修正（2026-11-15）

## 一次情報

- GGG公式日本語告知: https://steamcommunity.com/app/2694490/?l=japanese
- GGG公式日本語Steamストア: https://store.steampowered.com/app/2694490/Path_of_Exile_2/?l=japanese
- GGG日本語プレスリリース（11月7日）: https://prtimes.jp/main/html/rd/p/000000004.000188965.html
- 上記プレスリリースの「発表内容の詳細」リンク先: https://docs.google.com/document/d/1miAVExDfT3xZArqbzOmSLiccTTtPJlLfSDYcQpIbv3U/edit?tab=t.8vjk0rdmue3f
- 事前登録のFAQ: https://pathofexile2.com/register

公式日本語告知の語を優先し、英語を併記する。Conquerors of Wraeclastは公式日本語発表でも英語名なので、独自の正式訳を作らず「軍勢・攻城戦がテーマの新リーグ」と説明する。

| 原語 | 公式日本語告知の表記 |
| --- | --- |
| Shadow / Duelist | シャドウ / デュエリスト |
| Assassin / Infiltrator | アサシン / インフィルトレーター |
| Knight / Master-at-Arms | ナイト / 武具マスター |
| Ready / Sand / Blood Stance | レディ / サンド / ブラッドスタンス |
| Stealth / Champion Rare | ステルス / チャンピオンレア |
| Mercenary / Infernalist / Blood Mage | マーセナリー / インファーナリスト / ブラッドメイジ |
| Acolyte of Chayula | チャユラの門弟 |
| Infernal Hound / Covenant / Corrupted Blood | インファーナルハウンド / コヴェナント / 穢れた血 |
| Quarterstaff / Varek | クォータースタッフ / ヴァレク |
| Blood Lord / Sanguar | ブラッドロード / サングア |

## 内容の訂正

- 日本語の正式リリース日は2026年12月12日。12月11日は米国太平洋標準時（PST）。以前の「日本時間の日付は未確定」は訂正。開始時刻は未確認のまま。
- 公式Steam告知はデュエリストの専門クラス2種を1.0で紹介。一方、公式プレス資料は2つ目を後日追加と記述。発売時に2つ選べると断定せず、資料の差を出典とともに掲載。プレス資料にはMaster of Armsの表記もあるが、名前は公式日本語告知の武具マスター（Master-at-Arms）を使用。
- Mac版は正式リリース時の登場が発表済み。公式資料のチップの範囲はM2シリーズ以降、M1 Pro。古いIntel Mac要件を1.0の条件として残さない。OS・メモリ・機種別の最終条件は未確認。
- 事前登録の報酬数は現在値として過去の到達数を使わない。最新状態は公式登録ページで確認する。1.0の育成・計算の再検証は未完了。

## 表示の原因と確認

`content-action li` と読みやすさCSSの固定列が、ラベルのない箇条書きにも適用されていた。テキストが匿名の1列目に入り、横にはみ出さず細い列で改行されるため、以前の横スクロール検査だけでは検出できなかった。

ラベル付きの手順だけに `action-steps` を付けてグリッドを適用する。通常の箇条書きはリスト項目のまま全文幅を使う。スマホではラベル付き手順も1列にする。

Chromiumの既存100画面に本文Rangeの幅の検査を追加。WebKitは320/390/402/768/1366pxで1.0ハブ・新クラス・既存攻略・職業ページを検査し、箇条書きの本文幅と表示形式を確認。FAQ見出しにIDが付いた後も再生成できるよう抽出を修正する。

単独で表示される英語の画面ラベル（用語辞典・育成手順・進行状況・DPS・SSFなど）にも日本語を併記。英語の出典タイトル、製品名、識別子は翻訳対象にしない。

URL、ビルドID、ノードID、計算エンジン、保存形式、英語版画面の翻訳は変更しない。共通CSSのキャッシュ更新と日本時間の案内に必要なHTMLを再出力する。
