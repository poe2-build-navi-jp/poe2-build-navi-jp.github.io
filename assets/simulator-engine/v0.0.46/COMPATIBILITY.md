# 互換版の生成記録

`compat-wasm-*.bin` は、検証済みのPoBR 0.0.46のWASMから、Binaryen wasm-opt 125の `llvm-memory-copy-fill-lowering` だけを適用して生成する。`memory.copy` / `memory.fill` を同等のMVP命令による処理に置き換え、WebKitでの起動経路を検証するための版。ゲームデータ、計算式、schema 19、JSとのAPIは変更しない。

元の `wasm-*.bin` とPoBRのMITライセンス `LICENSE.txt` はそのまま保持する。元・互換版のSHA-256、生成ツールとパスは `runtime.json` に記録し、配信パーツにも個別のSHA-256を付ける。旧版を開いている利用者のパーツURLを上書きしない。

再生成：`node tools/prepare-safari-engine.mjs /absolute/path/to/wasm-opt`（Binaryen 125）。続いて `node tools/generate-simulator-runtime-en.mjs` と `node tools/sync-asset-versions.mjs` を実行する。

`scripts/test-simulator-engine-compat.mjs` は元・互換版の公開API、カタログと20構成の計算応答全体を比較する。起動・再読み込み、保存内容の保持はGitHub Actionsの **Check Safari engine startup** でmacOS/Linuxの通常設定のWebKit・Chromiumを使って確認する。

置換処理の出典：Binaryen 125 `src/passes/LLVMMemoryCopyFillLowering.cpp`。Copyright 2024 WebAssembly Community Group participants。Apache License 2.0の全文は `BINARYEN-LICENSE.txt` を参照。
