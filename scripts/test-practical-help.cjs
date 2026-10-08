const {JSDOM}=require('jsdom');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8');
const builds=JSON.parse(read('data/builds.json'));
const curated=builds.filter(b=>b.practicalGuide);
assert.equal(curated.length,3);
for(const b of builds){
 const html=read(`builds/${b.classSlug}/${b.slug}/index.html`);
 const doc=new JSDOM(html).window.document;
 assert.equal(doc.querySelectorAll('#roadmap details[data-stage-index]').length,8);
 for(let i=0;i<8;i++)assert.equal(doc.querySelector(`#roadmap-stage-${i}`).dataset.stageIndex,String(i));
 assert(doc.querySelector('#now-stage-detail'));
 assert(doc.querySelector('#build-feedback-form').hidden,'No empty/loading feedback form without JS');
 assert(!doc.querySelector('#build-feedback-form input, #build-feedback-form textarea'),'No free text or personal identifiers');
 if(b.practicalGuide){
  assert.equal(b.updatedAt,'2026-09-07','A scoped source check is not a full leveling review');
  const questions=[...doc.querySelectorAll('#practical-guide details')];
  assert.equal(questions.length,3);
  questions.forEach((el,i)=>{
   const q=b.practicalGuide.questions[i];
   assert(el.textContent.includes(q.answer));
   assert.equal(el.querySelector('a[target="_blank"]').href,b.sources[q.sourceIndex].url);
   assert(doc.querySelector(el.querySelector('a[href^="#"]').getAttribute('href')));
  });
  assert(doc.querySelector('#practical-guide').textContent.includes('実機プレイによる検証結果ではありません'));
 }
}
const minion=curated.find(b=>b.id==='witch-minion-infernalist');
assert.match(minion.practicalGuide.questions[0].answer,/Utzaal.*50 Spirit/);
assert.match(minion.practicalGuide.questions[2].answer,/5リンク.*4リンク/);
assert.match(curated.find(b=>b.id==='warrior-shield-wall-smith').practicalGuide.questions[0].answer,/Lv22.*筋力41.*盾/);
assert(read('privacy/index.html').includes('端末内のチェック履歴'));
const flush=()=>new Promise(resolve=>setImmediate(resolve));
async function open(level,hash=''){
 const b=minion;
 const page=new JSDOM(read(`builds/${b.classSlug}/${b.slug}/index.html`),{runScripts:'outside-only',url:`https://poe2-build-navi-jp.github.io/builds/${b.classSlug}/${b.slug}/?level=${level}${hash}`});
 const events=[];
 page.window.fetch=async()=>({ok:true,json:async()=>({build:structuredClone(b),related:[]})});
 page.window.gtag=(...args)=>events.push(args);
 page.window.eval(read('assets/practical-help.js'));
 page.window.eval(read('assets/detail.js'));
 await flush();
 return {page,events,doc:page.window.document};
}
function change(ctx,level){const input=ctx.doc.getElementById('level-input');input.value=level;input.dispatchEvent(new ctx.page.window.Event('input'));}
(async()=>{
 const ctx=await open(37);
 assert.equal(ctx.doc.getElementById('now-stage-detail').hash,'#roadmap-stage-3');
 assert.equal(ctx.events.length,0,'Never send a feedback event on load');
 const form=ctx.doc.getElementById('build-feedback-form');
 assert(!form.hidden);
 assert.match(ctx.doc.getElementById('feedback-stage').textContent,/Lv31〜40/);
 ctx.doc.getElementById('feedback-issue').value='transition';
 ctx.doc.getElementById('feedback-outcome').value='blocked';
 form.dispatchEvent(new ctx.page.window.Event('submit',{cancelable:true}));
 assert.equal(ctx.events.length,1);
 assert.deepEqual(JSON.parse(JSON.stringify(ctx.events[0])),['event','build_feedback',{build_id:minion.id,stage_index:3,patch:'0.5.5',issue:'transition',outcome:'blocked'}]);
 form.dispatchEvent(new ctx.page.window.Event('submit',{cancelable:true}));
 assert.equal(ctx.events.length,1,'Repeated submission is suppressed');
 change(ctx,70);await flush();
 assert.equal(ctx.doc.getElementById('now-stage-detail').hash,'#roadmap-stage-5');
 assert.equal(ctx.doc.getElementById('feedback-outcome').value,'','Clear old answers on stage change');
 assert(!form.querySelector('button').disabled);
 // jsdom does not implement navigation; keep the application click handler active.
 const previousStageLink=ctx.doc.querySelector('a[href="#roadmap-stage-3"]');
 previousStageLink.addEventListener('click',event=>event.preventDefault());
 previousStageLink.click();await flush();
 assert(ctx.doc.getElementById('roadmap-stage-3').open);
 assert.equal(ctx.doc.getElementById('level-input').value,'70','Reading another stage must not change saved Lv');
 change(ctx,80);await flush();
 assert(!ctx.doc.getElementById('roadmap-stage-3').open,'Old hash must not re-open an old stage on level changes');
 assert(ctx.doc.getElementById('roadmap-stage-6').open);
 ctx.page.window.gtag=undefined;
 ctx.doc.getElementById('feedback-issue').value='supports';ctx.doc.getElementById('feedback-outcome').value='progressed';
 form.dispatchEvent(new ctx.page.window.Event('submit',{cancelable:true}));
 assert.match(ctx.doc.getElementById('feedback-status').textContent,/共有できません/);
 ctx.page.window.close();
 const incoming=await open(37,'#roadmap-stage-5');
 assert(incoming.doc.getElementById('roadmap-stage-5').open,'An incoming guide anchor opens its stage');
 assert.equal(incoming.doc.getElementById('level-input').value,'37');
 incoming.page.window.close();
 console.log('PASS: three scoped source-backed answers, 12 stable stage anchors, Lv37/70/80 links, explicit GA feedback only, no personal fields, safe resets and unavailable GA');
})().catch(e=>{console.error(e);process.exitCode=1;});
