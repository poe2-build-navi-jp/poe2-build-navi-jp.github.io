// Device-local reading shortcuts. Search remains an ordinary GET form without JS.
const STORE='poe2:reading-library:v1';
export function readingPath(value,origin) {
 try {const url=new URL(value,origin);return url.origin===origin&&/^https?:$/.test(url.protocol)&&url.pathname.startsWith('/')?url.pathname:null;}catch{return null;}
}
export function readLibrary(raw,origin) {
 try {const value=JSON.parse(raw);const rows=key=>Array.isArray(value?.[key])?value[key].flatMap(row=>{const path=readingPath(row?.path,origin);return path&&typeof row?.title==='string'?[{path,title:row.title.slice(0,160)}]:[];}).filter((row,index,all)=>all.findIndex(other=>other.path===row.path)===index).slice(0,key==='favorites'?40:12):[];return {favorites:rows('favorites'),recent:rows('recent')};}catch{return {favorites:[],recent:[]};}
}
export function installSiteUsability(document) {
 const window=document.defaultView,strip=document.querySelector('[data-site-tools]');if(!strip)return;
 const en=document.documentElement.lang==='en';
 const copy=en?{saved:'Saved articles',recent:'Recently viewed',empty:'No saved articles yet. Use “Save this page” on a guide.',none:'Your recently viewed guides will appear here.',save:'Save this page',remove:'Saved · remove',close:'Close',limit:'You can save up to 40 articles. Remove one first.',error:'Device storage is unavailable. Use your browser bookmarks.',notice:'Saved on this browser only.',title:'Your reading list',open:'Reading list'}:{saved:'お気に入り',recent:'最近見た記事',empty:'気になる記事で「この記事を保存」を押すと、ここから開けます。',none:'閲覧した攻略記事や装備ページがここに並びます。',save:'この記事を保存',remove:'保存済み・解除',close:'閉じる',limit:'保存は40件までです。先に1件解除してください。',error:'端末に保存できません。ブラウザーのブックマークをご利用ください。',notice:'このブラウザー内に保存されます。',title:'お気に入り・閲覧履歴',open:'保存記事'};
 const origin=window.location.origin;
 let library;
 const read=()=>{try{return readLibrary(window.localStorage.getItem(STORE),origin);}catch{return readLibrary(null,origin);}};
 library=read();
 const currentPath=strip.dataset.readingPath,currentTitle=strip.dataset.readingTitle;
 const saveButton=strip.querySelector('[data-reading-save]'),openButton=strip.querySelector('[data-reading-open]'),status=strip.querySelector('[data-reading-status]');
 const write=()=>{try{window.localStorage.setItem(STORE,JSON.stringify(library));return true;}catch{status.textContent=copy.error;return false;}};
 const renderButton=()=>{if(saveButton){const active=library.favorites.some(row=>row.path===currentPath);saveButton.textContent=active?copy.remove:copy.save;saveButton.setAttribute('aria-pressed',String(active));}if(openButton)openButton.textContent=copy.open+(library.favorites.length?` (${library.favorites.length})`:'');};
 if(currentPath&&currentTitle){library.recent=[{path:currentPath,title:currentTitle},...library.recent.filter(row=>row.path!==currentPath)].slice(0,12);write();}
 let dialog,returnFocus;
 function renderList() {
  for(const [key,title,empty]of [['favorites',copy.saved,copy.empty],['recent',copy.recent,copy.none]]){
   const box=dialog.querySelector(`[data-reading-list="${key}"]`);box.replaceChildren();
   const heading=document.createElement('h3');heading.textContent=title;box.append(heading);
   if(!library[key].length){const p=document.createElement('p');p.textContent=empty;box.append(p);continue;}
   const list=document.createElement('ul');for(const row of library[key]){const li=document.createElement('li'),a=document.createElement('a');a.href=row.path;a.textContent=row.title;li.append(a);list.append(li);}box.append(list);
  }
 }
 function openReading() {
  if(!dialog){dialog=document.createElement('dialog');dialog.className='site-reading-dialog';dialog.id='site-reading-dialog';dialog.setAttribute('aria-labelledby','site-reading-title');
   dialog.innerHTML='<div class="site-reading-head"><h2 id="site-reading-title"></h2><button type="button" data-reading-close></button></div><p data-reading-note></p><section data-reading-list="favorites"></section><section data-reading-list="recent"></section>';
   dialog.querySelector('h2').textContent=copy.title;dialog.querySelector('[data-reading-close]').textContent=copy.close;dialog.querySelector('[data-reading-note]').textContent=copy.notice;
   document.body.append(dialog);dialog.querySelector('[data-reading-close]').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>returnFocus?.focus({preventScroll:true}));
  }
  returnFocus=openButton;library=read();renderList();dialog.showModal();dialog.querySelector('[data-reading-close]').focus();
 }
 openButton?.addEventListener('click',openReading);
 saveButton?.addEventListener('click',()=>{const old=library;library=read();const active=library.favorites.some(row=>row.path===currentPath);if(!active&&library.favorites.length>=40){status.textContent=copy.limit;return;}library.favorites=active?library.favorites.filter(row=>row.path!==currentPath):[{path:currentPath,title:currentTitle},...library.favorites];if(!write())library=old;else status.textContent=active?(en?'Removed from saved articles.':'お気に入りを解除しました。'):(en?'Article saved.':'お気に入りに保存しました。');renderButton();});
 window.addEventListener('storage',event=>{if(event.key===STORE){library=read();renderButton();if(dialog?.open)renderList();}});
 renderButton();
 const menu=document.querySelector('.menu-button'),nav=document.querySelector('.site-nav');
 if(menu&&nav){
  const close=()=>{nav.classList.remove('open','is-open');menu.setAttribute('aria-expanded','false');};
  document.addEventListener('click',event=>{if(event.target.closest('.menu-button')===menu){event.preventDefault();event.stopImmediatePropagation();const open=menu.getAttribute('aria-expanded')!=='true';nav.classList.toggle('open',open);nav.classList.toggle('is-open',open);menu.setAttribute('aria-expanded',String(open));}else if(!event.target.closest('.site-header')||event.target.closest('.site-nav a'))close();},true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.getAttribute('aria-expanded')==='true'){close();menu.focus();}});
 }
 document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'&&!event.altKey&&!document.querySelector('dialog[open]')){const input=strip.querySelector('input[type="search"]');if(input){event.preventDefault();input.focus();input.select();}}});
}
if(typeof document!=='undefined')installSiteUsability(document);
