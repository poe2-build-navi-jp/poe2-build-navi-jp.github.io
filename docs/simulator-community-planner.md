# 更新確認・ゲーム内プランナー出力・ビルド投稿

公開先は既存の GitHub Pages。日本語 `/simulator/`・`/community/` と英語 `/en/simulator/`・`/en/community/` に対応。

## 更新の確認

名前付き保存と更新案内の対象条件を照合する。ジェム、反映済み装備、割り当て済みパッシブを一覧にし、現在の入力に一致する箇所を表示できる。保存構成の読み込みやポイント取得は行わない。

`data/saved-build-updates.json` の `targets` が照合範囲。`basis: review` は見直し候補であり、変更の確定や影響量を意味しない。範囲を特定できない案内ではその旨を表示する。

## `.build` 出力

GGG の Build Planner Version 1 Experimental の JSON Build オブジェクトに変換する。
仕様: https://www.pathofexile.com/developer/docs/game#build-planner

ゲームデータの PassiveSkills の文字列 ID と BaseItemTypes のメタデータパスを使用する。数値ノード ID や英語名から推測した ID は書き出さない。スキル・サポート・パッシブ・アセンダンシー・レベル範囲が対象。装備、個人メモ、計算設定は出力対象外。メタジェム、対応 ID が不明な項目、異なる版のツリーは除外項目を示し、対応分のみ書き出す場合は明示的な確認を求める。

実際のゲームクライアントへの取り込みは未検証。ファイル構造、ID 対応、実ファイルのダウンロードは Chromium・WebKit で検証する。`tools/generate-simulator-index.mjs` が既存の固定済みエンジンデータから対応表を再生成する。

## 公開ビルド

- 公開サービス: `poe2-bcr97h` / https://poe2-bcr97h.v2.appdeploy.ai/
- ソース: `tools/community-service/`。GitHub Pages の画面は `assets/community-*.js`。
- 既存の暗号化同期サービス `poe2-olc5ko` から分離している。
- 反映済み構成を明示的に確認して公開する。個人メモ・装備の下書き・出典情報は送らない。投稿は固定したスナップショット。
- ジュエルなし、既知のデータ・スキル・ツリー、64 KB 以下の構成に対応。未対応は送信前に拒否する。
- スキル・用途・同じ通貨での予算・名前で検索。最大 24 件ずつ調べ、続きは利用者が読み込む。
- 管理コードは乱数 256 bit。サーバーにハッシュを保存する。コードを保持する投稿者が取り下げできる。コードの復元や切り替え時も以前のコードを端末内に保持する。
- 取り下げは公開本体と一覧を原子的に削除し、再送による復活を防ぐ受領記録は保持する。同じ公開リクエストの再試行で投稿が増えない。
- 同じコードで同時公開は 10 件まで。SDK の利用制限時は 429 として表示し、自動で書き直さない。
- 通報は非公開の記録として受け付け、自動的な投稿非表示は行わない。
- X は投稿作成画面を開く。シミュレーターへのリンクは既存の読み取り専用共有形式を使う。長すぎる構成は保存ファイルとして読み込める。

サービス側データ更新時は同じ app ID を使用する。`src/catalog.json` は `data/community-catalog.json` と整合させる。共有 UI・モデル・CSS は `assets/` を基準にする。AppDeploy が正規化した最新版を `src_read` で読み込んでから更新する。

## 確認

`npm run test:simulator`、`npm run test:simulator:en`、`npm run test:community`。実ブラウザーは `.github/workflows/simulator-library.yml` で実行する。公開サービスを使う QA の管理コードは使い捨てテスト投稿専用で、各ケースの終了時に取り下げる。保存構成の変更や実利用者の投稿削除はしない。
