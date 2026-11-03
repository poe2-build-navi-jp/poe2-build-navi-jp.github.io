// Copy only the canonical resource URL; no page contents or saved progress are sent.
document.querySelectorAll('[data-guide-share]').forEach(card=>{
 const button=card.querySelector('[data-copy-guide]'),input=card.querySelector('[data-guide-url]'),status=card.querySelector('[data-guide-copy-status]');
 if(!button||!input||!status)return;
 button.hidden=false;
 button.addEventListener('click',async()=>{
  try{
   if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');
   await navigator.clipboard.writeText(input.value);
   status.textContent='リンクをコピーしました。';
  }catch{
   input.closest('details').open=true;input.focus();input.select();
   status.textContent='URLを選択しました。コピーして使ってください。';
  }
 });
});
