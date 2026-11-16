# 同期・公開投稿の復旧

公開サイトのURLは変更しない。暗号化同期・新規公開投稿だけを新しい保存サービスへ切り替える。

- API: `https://poe2-build-services-20261116.ponyoaqua143.chatgpt.site`
- Sites project: `appgprj_6afac43071648191ad40a559f40e714b`
- Backend source commit: `6ace1722af91f7f0d05c3d9c0a2c7156514d8307` (Sites source repository)
- Frontend contract: `assets/simulator-service.js`, `assets/simulator-sync.js`, `assets/community-transport.js`
- Storage: Cloudflare D1, schema-managed migrations. Legacy backend sources under `tools/sync-service` and `tools/community-service` remain intact.
- Production verification: encrypted write/read, revoked-code rejection, public publishing/read, owner checks and durable withdrawal; disposable QA records cleaned up. Real browser integration also runs on the recovery PR.

## 原因の確認範囲

AppDeploy月間クレジットは残っていた。追加デプロイは日次の無料枠で停止しており、解除時刻は `2026-11-17T00:00:00Z`（日本時間11月17日9時）。旧APIは `APP_TEMPORARILY_UNAVAILABLE` / HTTP 402を返していた。日次デプロイ制限と実行停止の因果関係までは確定していない。HTTP 402だけで利用枠到達と表示しない。課金・プラン変更は行わない。

## 端末内・旧サーバーの保存を守る

接続コードの暗号鍵導出は変更しない。保存メタデータには保管庫の提供元IDを追加する。提供元が違う場合、旧サーバーの削除判定用baselineを新しい空の保管庫へ流用しない。保存済みの接続情報と有効な端末内構成がある場合に限り、同じコードで新しい保管庫を作り、構成を同期する。手入力の「接続」は新規作成をしない。無効化済みの保管庫は再作成しない。

旧クラウドだけにある構成は自動移行済みではない。旧サーバーの再開後、「以前の保管庫から読み込む」で、まず旧コードによる認証・復号を行い、現在の端末と新保管庫を照合してから追加する。異なる編集は競合コピーとして保持。旧保管庫は変更・削除しない。保存上限を超える場合は切り捨てず中止する。比較記録は入力だけでなく保存時点の数値・エンジン・データ版も比較する。

「現在の保管庫を無効化」は新しい保管庫だけに作用する。旧AppDeploy保管庫は別に残る。旧保管庫を無効化したい場合は、旧同期管理画面 `https://poe2-olc5ko.v2.appdeploy.ai/` が再開後、以前の接続コードで接続して無効化する。コードをURL・記事・解析イベントへ含めない。

## 以前の公開投稿

既存の `community/?build=...` は維持する。新しい保存先で未登録のIDは、再開時刻以降に旧サーバーで確認する。新しい保存先で取り下げ済みのIDは旧サーバーへ探しに行かない。

管理コードで新旧の所有投稿を確認し、旧側が停止中なら「過去の投稿は未確認」と表示する。閲覧・通報・取り下げは投稿の保存先に送る。認証エラーだけを理由に別の保存先で変更処理を試さない。旧投稿を無断で複製しない。

## 保守・確認

Sitesの同じproject IDでソースを開いて編集する。認証情報はGitやファイルに保存しない。D1のschemaとDrizzle migrationを更新し、SQLiteトランザクション検証、型検査、ビルド後に公開する。DBの初期化やリセットは不要。

フロントエンドは `node scripts/test-service-recovery.mjs`、`node scripts/test-simulator-library.mjs`、`npm run test:community` で単体検証できる。GitHub ActionsではChromium/WebKitの別々の保存領域で2MiB近傍の同期・競合・投稿・取り下げまで検証する。外部への実書き込みを伴うCIは、同期・公開APIに関係する変更だけで実行し、通常の画面変更では重複実行しない。

新しい保管庫を使い始めた後、提供元を区別しない旧クライアントへ巻き戻すと削除判定を誤る可能性がある。障害時も新旧のDB・端末内保存を残し、同じ提供元IDでの復旧、またはファイルへの書き出しを優先する。
