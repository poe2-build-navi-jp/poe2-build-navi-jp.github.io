# POE2ビルドナビ：Web更新を反映するアプリ

Web公開先: https://poe2-build-navi-jp.github.io/ （初期画面は `/simulator/`）

## 更新の仕組み

- 記事、画像、パッシブ、装備・スキルのデータ、Webシミュレーターは公開サイトを読み込む。アプリへのWebファイルの詰め直しは不要。
- 起動・ページ移動はHTMLをサーバーへ再検証する。CSS/JSは既存の内容ハッシュ付きURLを利用し、保存済みの構成やCookieを消して更新することはしない。
- GitHub Pagesの公開工程が、実際に配信するHTMLと `mobile-version.json` に同じコミットIDを埋め込む。アプリは起動中60秒ごと・復帰時に確認し、変更があれば「更新あり」を表示する。
- 操作中に勝手に再読み込みしない。更新ボタンで確認してから反映する。未反映の入力は先にページ内の反映ボタンで保存する。
- ネイティブの画面、権限、SDK、課金等の変更はストアへの新版提出が必要。審査を回避する仕組みではない。

## アプリ内で使えるもの

- 戻る・進む、攻略とシミュレーターへの移動
- ネイティブのお気に入り（50件まで）、OSの共有画面
- 構成JSON・比較画像の保存、ページ内ファイル選択
- 保存した構成・価格・参考表示設定・保存記事をまとめたバックアップと復元
- オフライン時の再試行。**初回起動・最新版取得・シミュレーターの完全なオフライン利用には通信が必要**。オフライン動作を保証しない。

Webブラウザーとアプリの保存領域は別。初回にSafari/Chromeのデータが自動コピーされることはない。Web版の保存JSONをアプリの「保存を読み込む」で読み込める。全データのアプリ用バックアップは同じアプリ間で移せる（Web版の構成単体JSONとは別形式）。アプリを削除する前にはバックアップを書き出す。

### 名前付き構成・比較記録の端末間同期

Web版のシミュレーターに任意の暗号化同期を追加した。ブラウザーとアプリでも同じ接続コードを入力すれば、名前を付けた構成と比較記録を同期できる。自動保存の編集中データ・価格入力の下書き・記事履歴は移さない。接続コードはユーザー自身が保管する。コードのサーバー復旧やメール送信は行わない。

現在の同期先は `https://poe2-build-services-20261116.ponyoaqua143.chatgpt.site` のHTTPS API。旧AppDeploy保管庫は残し、明示的な旧データの読み戻し時だけ旧サブフレームへ接続する。メインフレームの許可サイトとネイティブブリッジの許可オリジンは既存のGitHub Pagesに限定したまま。クロスサイトのCookieを必須にしない公開APIを使用する。iPhone/Android実機では、二台の接続・オフラインからの復帰・再起動・保管庫の無効化を確認する。ページの更新だけで利用できるが、WebKitのブラウザ検証と実機WebView検証は別に扱う。

公開プライバシーポリシーの「任意のビルド同期」に処理内容を記載した。ストアに提出する説明とプライバシー申告も、同期を利用する場合のデータ処理と照合する。現在の保存先・ソース・復旧手順は `docs/build-service-recovery.md`、同期の仕様は `docs/simulator-library.md` にある。`tools/sync-service/` は旧サービスのソースとして保持する。

## iPhone / iPad：reki向け

1. MacにXcode 26以降とXcodeGenを用意する（`brew install xcodegen`）。CIはXcode 26.3で確認。アプリはiOS 17以降対応。
2. リポジトリを取得し、`cd mobile/ios` → `xcodegen generate`。
3. `Poe2BuildNavi.xcodeproj` をXcodeで開く。
4. `Signing & Capabilities` でいつものApple Developer Teamを選ぶ。仮のBundle ID `jp.poe2buildnavi.app` はApp Store Connectと揃え、一度公開した後は変えない。
5. 実機で起動、ツリーのピンチ操作、保存JSONの書き出し・読込、比較PNG保存、バックアップ復元、Web更新通知、再起動後の保存を確認。
6. 配布時は `Any iOS Device` → Product → Archive → Distribute App → App Store Connect。CIの `.xcarchive` は署名なしのビルド確認用で、そのままストア配布するものではない。

`Resources/PrivacyInfo.xcprivacy` は端末内設定のUserDefaults利用を宣言済み。アプリの広告・解析SDKは未導入で、Web側の既存Google広告・解析ホストはアプリ内でブロックする。公開前には実際の通信・提供者のプライバシーポリシーとApp Storeの申告内容を確認する。課金・広告はこの版に追加していない。

## Android

1. Android Studioで `mobile/android` を開く。JDK17・Gradle8.13・SDK36を使う。
2. Gradleの同期後、Runで実機にインストール。Android 8.0以降と更新済みのAndroid System WebViewが必要。
3. CLIは `gradle :app:assembleDebug`。公開用はAndroid StudioのGenerate Signed App Bundleで署名して作成。
4. 仮のapplicationIdはiOSと同じ `jp.poe2buildnavi.app`。公開前に確定する。秘密鍵はリポジトリに置かない。

## GitHubでのビルド

Actions → **Build POE2 native apps**。PRとmainの対象変更で、共通データ処理のテスト→iOS/Androidビルドを実行する。

成果物:

- `poe2-ios-unsigned-xcarchive`: iPhone/iPad向け署名なしアーカイブ
- `poe2-android-debug-apk`: Android実機テスト用APK
- `poe2-android-unsigned-aab`: 署名を入れる前の公開用バンドル

## 公開前に行う確認

- iPhone / iPad / Androidの実機確認。CIのビルド成功は実機確認の代わりにはならない。
- TestFlightの署名・配布、App Store / Google Playのメタデータ・スクリーンショット・プライバシー申告。
- 「非公式」であることと、GGGに承認されたアプリではないことを明示。既存画像・データの権利表記はルートの `ASSET_SOURCES.md` を引き継ぐ。
- App Store Review 4.2等はWebViewでも適用される。インタラクティブな計算、ネイティブ保存・共有等を含むが、審査通過は保証しない。

公式仕様: [Apple reloadFromOrigin](https://developer.apple.com/documentation/webkit/wkwebview/reloadfromorigin()) / [App Review](https://developer.apple.com/app-store/review/guidelines/) / [Android WebViewCompat](https://developer.android.com/reference/androidx/webkit/WebViewCompat) / [AGP 8.13](https://developer.android.com/build/releases/agp-8-13-0-release-notes)
