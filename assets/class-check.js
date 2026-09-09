const profiles = {
  monk:{combat:["melee"],priority:["mobile"],control:["medium","complex"],theme:["weapon"]},
  mercenary:{combat:["ranged"],priority:["safe","flexible"],control:["medium"],theme:["weapon"]},
  warrior:{combat:["melee"],priority:["safe","simple"],control:["simple","medium"],theme:["weapon"]},
  sorceress:{combat:["magic","minion"],priority:["safe","flexible"],control:["medium"],theme:["spell","companion"]},
  huntress:{combat:["melee","ranged","minion"],priority:["flexible"],control:["medium"],theme:["weapon","companion"]},
  ranger:{combat:["ranged"],priority:["safe","mobile"],control:["simple","medium"],theme:["weapon"]},
  witch:{combat:["magic","minion"],priority:["safe","simple"],control:["simple","medium"],theme:["spell","companion"]},
  druid:{combat:["magic","melee"],priority:["flexible"],control:["medium"],theme:["nature","spell"]}
};

const form = document.getElementById("class-check-form");
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const answers = Object.fromEntries(new FormData(form));
  const [classes, builds] = await Promise.all([fetch("/data/classes.json").then(r=>r.json()), fetch("/data/builds.json").then(r=>r.json())]);
  const scored = classes.map((item) => {
    const p = profiles[item.slug];
    let score = 0; const reasons = [];
    if (answers.combat === "any" || p.combat.includes(answers.combat)) { score += 3; reasons.push("好きな戦い方と一致"); }
    if (p.priority.includes(answers.priority)) { score += 2; reasons.push("重視点と一致"); }
    if (p.control.includes(answers.control)) { score += 1; reasons.push("希望する操作量と一致"); }
    if (answers.theme === "any" || p.theme.includes(answers.theme)) { score += 2; reasons.push("好きなテーマと一致"); }
    return {item, score, reasons, builds:builds.filter(b=>b.classSlug===item.slug)};
  }).sort((a,b)=>b.score-a.score);
  const best = scored[0].score;
  const result = scored.filter(x=>x.score >= Math.max(3,best-1)).slice(0,3);
  const cards = document.getElementById("class-check-cards"); cards.replaceChildren();
  result.forEach(({item,reasons,builds}) => {
    const card=document.createElement("article"); card.className="quiz-result-card";
    const title=document.createElement("h3"); title.textContent=item.name;
    const why=document.createElement("p"); why.textContent=`理由：${reasons.join("・") || item.tagline}`;
    const build=document.createElement("p"); build.textContent=`掲載ビルド：${builds.map(x=>x.name).join("、") || "確認中"}`;
    const link=document.createElement("a"); link.className="button"; link.href=`/classes/${item.slug}/`; link.textContent="この職業を見る";
    card.append(title,why,build,link); cards.append(card);
  });
  const wrapper=document.getElementById("class-check-result"); wrapper.hidden=false; wrapper.scrollIntoView({behavior:"smooth",block:"start"});
});
