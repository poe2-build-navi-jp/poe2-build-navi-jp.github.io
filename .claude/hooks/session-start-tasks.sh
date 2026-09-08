#!/usr/bin/env bash
# SessionStart hook: scans data/builds.json for the thinnest build entry and
# surfaces one concrete "deepen this build" task as additionalContext.
# Never blocks the session — any failure here just yields no suggestion.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BUILDS_FILE="$REPO_ROOT/data/builds.json"

if [ ! -f "$BUILDS_FILE" ]; then
  echo '{}'
  exit 0
fi

node --input-type=module -e '
import { readFileSync } from "node:fs";

const path = process.argv[1];
let builds;
try {
  builds = JSON.parse(readFileSync(path, "utf8"));
} catch {
  console.log("{}");
  process.exit(0);
}

const RATING_FIELDS = ["beginnerRating", "damageRating", "defenseRating", "mappingRating", "bossRating"];

function score(build) {
  let s = 0;
  const missingRatings = RATING_FIELDS.filter((f) => build[f] === null || build[f] === undefined);
  s += missingRatings.length; // 0-5
  if (build.ssf === null || build.ssf === undefined) s += 2;
  const sources = Array.isArray(build.sources) ? build.sources.length : 0;
  if (sources < 2) s += 3;
  else if (sources < 3) s += 1;
  const gear = Array.isArray(build.gearPriorities) ? build.gearPriorities.length : 0;
  if (gear < 3) s += 2;
  return { score: s, missingRatings, sources, gear };
}

const scored = builds.map((b) => ({ build: b, ...score(b) }));
scored.sort((a, b) => b.score - a.score);

if (scored.length === 0) {
  console.log("{}");
  process.exit(0);
}

// Rotate among builds tied for the top score so repeated sessions surface
// different work instead of nagging about the same one every time.
const topScore = scored[0].score;
const tied = scored.filter((s) => s.score === topScore);
const dayIndex = Math.floor(Date.now() / 86400000);
const pick = tied[dayIndex % tied.length];

const b = pick.build;
const gaps = [];
if (pick.missingRatings.length > 0) {
  gaps.push(`評価指標が未設定（${pick.missingRatings.join(", ")}）`);
}
if (b.ssf === null || b.ssf === undefined) {
  gaps.push("SSF（ソロセルフファウンド）での可否が未検証・未記載");
}
if (pick.sources < 2) {
  gaps.push(`裏付けsourcesが${pick.sources}件のみで手薄`);
}
if (pick.gear < 3) {
  gaps.push("gearPrioritiesの装備方針が手薄");
}

const allMissingRatings = scored.every((s) => s.missingRatings.length === RATING_FIELDS.length);

let context = `[コンテンツ深掘り提案] data/builds.json のうち最も手薄なビルド候補: `;
context += `「${b.className}｜${b.name}」(${b.classSlug}/${b.slug})。`;
context += `\n手薄な点: ${gaps.length > 0 ? gaps.join(" / ") : "特になし"}。`;
context += `\n次の一手の例: このビルドの装備優先度を武器/防具/アクセサリごとに具体化する、SSFでの成立可否を検証して記載する、または裏付けとなる情報源(sources)を追加する。`;
if (allMissingRatings) {
  context += `\n※サイト全体の傾向: 全8ビルドで5つの評価指標(beginnerRating等)が未設定のまま。評価基準の設計自体がサイト全体の課題。`;
}
context += `\n新規ビルド追加ではなく、既存ビルド(8クラス×1本)の深掘り・裏付け強化を優先してください。ユーザーと相談の上、着手するかどうか決めること。`;

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: context
  }
}));
' "$BUILDS_FILE"
