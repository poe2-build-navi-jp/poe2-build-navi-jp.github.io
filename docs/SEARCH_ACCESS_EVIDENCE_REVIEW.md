# Search access and evidence presentation

## Inventory and scope

Base: 9d8ea218a136566e39da2a1650529211913d7fc1. New branch content/search-access-evidence. Existing worktree was clean; unrelated PRs and branches were not incorporated. No repository AGENTS.md or applicable .agents skill was found.

The site has 22 strategy records and 35 guide search-intent records. Strategy pages already have a direct answer, three next actions, section instructions, references and source dates. Other page families (builds, dictionary/entities, beginner chapters, landing/search pages) use separate templates and are not rewritten by this change.

This change enables an optional shared evidence block only for these five existing articles:

- `/guides/atlas-progression/`: Atlas攻略｜Fortressとパッシブポイントの進め方
- `/guides/waystones-tablets/`: Waystone・Tablet攻略｜使い方と入れない時の確認
- `/guides/arbiter-of-divinity/`: 神性のアービター攻略｜Lv87ジェムリングの撃破装備・ステータス
- `/guides/mageblood-legacies/`: メイジブラッドの選び方｜遺産14種と重複効果の計算
- `/guides/tier-16-waystones/`: ウェイストーンT16の入手方法｜T15コラプトと供給の整え方

For these pages, readers see the existing conclusion/actions followed by article-specific method, confirmed evidence and unverified scope. The method distinguishes an operator-reported clear and screenshot-visible data from researched mechanics and theoretical calculations. Existing images and full-size links remain unchanged. References retain the original source-check dates; no new playtest, author, review or blanket latest-patch certification is claimed. Waystone/Tablet and Atlas metadata now name the actual cited patches rather than inheriting a generic default. Mageblood/T16 metadata distinguish historical patch evidence from dated database checks.

Remaining strategy records (no new evidence text in this change):

- `/guides/campaign-progression/`
- `/guides/trial-of-chaos/`
- `/guides/expedition/`
- `/guides/act-1-walkthrough/`
- `/guides/act-2-walkthrough/`
- `/guides/act-3-walkthrough/`
- `/guides/act-4-walkthrough/`
- `/guides/interlude-walkthrough/`
- `/guides/endgame-contents/`
- `/guides/endgame-items/`
- `/guides/atlas-passive-trees/`
- `/guides/ascendancy-trials/`
- `/guides/permanent-rewards/`
- `/guides/budget-gear-crafting/`
- `/guides/pinnacle-bosses/`
- `/guides/arbiter-of-ash-clear-record/`
- `/guides/unique-gear/`

Remaining pages need their own provenance review before adopting this block. In particular, other inherited default version labels were inventoried but are not upgraded to a purported current verification. This is a bounded five-article improvement, not certification of every site page.

## Crawler policy

- OAI-SearchBot is explicitly allowed public pages and assets, while retaining every existing non-site path exclusion. Its specific group repeats those exclusions because a specific user-agent group must not accidentally broaden access beyond the wildcard group.
- GPTBot is disallowed site-wide. Google/Bing and other agents continue to use the unchanged wildcard policy.
- Sitemap remains unchanged. No WAF, DNS, credentials, permissions, analytics or deployment settings are modified.
- This is a robots.txt preference for OpenAI's automatic crawlers, not a block against every training organization or an access-control mechanism. It does not guarantee search indexing, ranking or citation. User-requested fetches may have different robots handling.

Official references consulted 2026-10-25:
- https://developers.openai.com/api/docs/bots
- https://help.openai.com/en/articles/9237897-searching-the-web-with-chatgpt

Game-reference review uses the articles' existing linked GGG sources; no mechanics are newly invented. 0.5.5d explicitly describes inactive Tablet-slot feedback; 0.5.5c describes presence at the relevant bosses' deaths. Existing T16, Mageblood and Divinity evidence and their limits are retained.

## Validation

Crawler access matrix: OAI-SearchBot/Googlebot/bingbot/other bot public paths and assets allowed; all existing excluded paths denied; GPTBot denied. Rendered checks: exactly five opt-in blocks, conclusion/actions/evidence/source order, source dates, no image loss. Full build and npm test passed (128 pages). All five pages passed browser checks at 390px and 1440px: no page overflow, one H1, three evidence rows, working source anchors and zero axe WCAG 2 A/AA violations. Mobile T16 and desktop Divinity screenshots were visually inspected. Publication is pending parent review; no merge is requested.

The existing IndexNow verifier assumed a single wildcard robots group. It now also accepts exactly the reviewed OAI-SearchBot group matching the wildcard restrictions and GPTBot deny-all group. Unexpected groups or policy changes still fail closed; regression tests cover these cases. All IndexNow tests use mocked requests; no submission was performed.

Editorial modification dates in the generated sitemap use the site’s JST date (2026-10-26 during this run); game-source checkedAt values remain unchanged. Only the five target article HTML files change. Their opt-in stylesheet avoids cache-key churn on other page families.
