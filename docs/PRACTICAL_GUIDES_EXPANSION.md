# 試練・恒久報酬・装備実践・終盤ボス

最新main589c345（PR34）の全体ビルドを継承して4記事を追加、合計30記事へ拡充します。

- ascendancy-trials：初回と追加ポイント、キーの表示、名誉と部屋選び、必要階層と祭壇、混沌の継続とFate。
- permanent-rewards：Act1〜4・間幕の取り逃し確認。討伐/提出/使用を分離し、選択報酬や旧Cruelの二重計上を防ぐ。
- budget-gear-crafting：1部位の検索購入、実物/価格/Gold確認、予備ベースへの通貨使用と中止条件。
- pinnacle-bosses：Arbiter of AshとXeshtの予兆・回避・短い反撃。資料確認の範囲を明示。

既存記事は関連導線と装備基礎のAlchemy説明を更新。画像は追加せず、4記事の `ogImage` に既存共通OGを明示しています。OG生成器は明示された画像を再利用し、上書き生成しません。

## 検証環境と手順

- 通常 `npm run build` はChromiumのUnix socket制限でOG描画段階が停止。
- 既存対応モード `OG_METADATA_ONLY=1 npm run build` で画像を再利用して全体生成可能。
- 環境のフォント差による既存OGの再描画差分は採用しない。
- 新記事が初回ビルドの共通案内から漏れないよう、enhance-one-hubはstrategy-guidesデータも直接読み込む。
- `npm test`、全リンク/fragment、canonical/Article/OG画像実在性、全30カード完全タイトル、検索/履歴、関連記事文字色を検証。
- DOM axeは新4記事とハブを検査（描画依存の色コントラストを除く）。
- 実画面375/390/430は公開承認後にブラウザQA。現在はDraft PRまでで、マージ/公開は含めない。
