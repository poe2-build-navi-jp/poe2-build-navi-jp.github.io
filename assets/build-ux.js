const track=(name,data={})=>{if(typeof window.gtag==='function')window.gtag('event',name,data);};
document.addEventListener('click',event=>{
 const a=event.target.closest('a[href]');if(!a)return;
 if(a.closest('#purpose-picks'))track('quick_pick_click',{link_url:a.pathname});
 if(/^\/builds\/[^/]+\/[^/]+\//.test(a.pathname))track('build_open',{link_url:a.pathname});
 if(a.id==='quick-link')track('resume_click');
});
document.addEventListener('change',event=>{if(event.target.matches('#quick-class, #class-filter'))track('class_select',{class_name:event.target.value});});
if('IntersectionObserver' in window){
 const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){track('diagram_view',{image:entry.target.getAttribute('src')});observer.unobserve(entry.target);}}),{threshold:.5});
 document.querySelectorAll('.seo-visual img').forEach(img=>observer.observe(img));
}
// Reuse existing saved build/level keys, and keep material revision detection separate from visits.
const notice=document.getElementById('build-update-notice');
// Shares detail.js's request (window.poe2BuildsRequest): only this build's data file, once per page.
const [,,buildClass,buildSlug]=location.pathname.split('/');
if(notice)(window.poe2BuildsRequest||=fetch(`/data/builds/${buildClass}/${buildSlug}.json`).then(r=>{if(r.status===404)return null;if(!r.ok)throw new Error(`build data ${r.status}`);return r.json();})).then(data=>{
 const build=Array.isArray(data)?data.find(b=>location.pathname===`/builds/${b.classSlug}/${b.slug}/`):data?.build;if(!build)return;
 try{
  const key=`poe2:navi:seen-revision:${build.id}`;
  const revision=JSON.stringify([build.version,build.updatedAt,build.status,build.levelingStages,build.changeHistory||[]]);
  const previous=localStorage.getItem(key);
  if(previous&&previous!==revision){notice.hidden=false;notice.textContent='前回以降、このビルドの掲載内容が更新されています。資料確認日と育成手順を確認してください。';}
  localStorage.setItem(key,revision);

 }catch{} // Storage blocked: core navigation remains available.
}).catch(()=>{});
