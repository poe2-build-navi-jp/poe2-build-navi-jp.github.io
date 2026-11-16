import {inspectEquipmentPhoto,equipmentPhotoText} from './simulator-photo-model.js?v=20e9a89a1c';
const $=id=>document.getElementById('sim-photo-'+id), en=document.documentElement.lang.startsWith('en');
const t=(ja,english)=>en?english:ja;
const dialog=$('dialog');
let target=null,image=null,photoURL=null,serial=0,worker=null,parsed=null,busy=false;
const api=()=>window.Poe2SimulatorLibrary;
const status=text=>{$('status').textContent=text;};
const stopWorker=async()=>{const current=worker;worker=null;current?.terminate();};
function resetReview(){
 parsed=null;$('review').hidden=true;$('confirmed').checked=false;$('stage').disabled=true;
}
function releaseImage(){if(photoURL){URL.revokeObjectURL(photoURL);photoURL=null;}image=null;}
function close(){++serial;void stopWorker();releaseImage();target=null;busy=false;dialog.close();}
function notifyError(error){
 const errors={base:t('装備のベースを選んでください。','Choose the item base.'),name:t('装備名を80文字以内で入力してください。','Enter an item name of up to 80 characters.'),value:t('数値の範囲を確認してください。','Check the numeric values.'),modifiers:t('反映するオプションを1行以上選んでください。','Select at least one modifier.'),'text-size':t('装備の説明欄だけに絞って読み取ってください。','Crop to the item tooltip only.')};
 status(errors[error.message]||t('読み取れませんでした。通信と画像を確認し、もう一度お試しください。','Could not read this image. Check your connection and image, then try again.'));
}
function check(){
 const count=$('options').querySelectorAll('input:checked').length;
 $('stage').disabled=busy||!parsed||!$('base').value||!count||!$('confirmed').checked;
}
function renderReview({initial=false}={}){
 try{
  parsed=inspectEquipmentPhoto($('text').value,target);
  if(initial){
   $('base').value=parsed.baseId;$('quality').value=parsed.quality;$('level').value=parsed.level;
   $('rarity').value='RARE';
   $('name').value=t('写真の装備','Photographed item');
  }
  else if(!$('base').value&&parsed.baseId)$('base').value=parsed.baseId;
  $('options').replaceChildren();
  parsed.modifiers.forEach((mod,i)=>{
   const label=document.createElement('label'),input=document.createElement('input'),span=document.createElement('span');
   input.type='checkbox';input.checked=true;input.value=String(i);span.textContent=mod.source+' → '+mod.text;label.append(input,span);$('options').append(label);
  });
  $('unresolved').textContent=parsed.unresolved.join('\n')||t('なし','None');
  $('properties').textContent=parsed.properties.join('\n')||t('なし','None');
  $('summary').textContent=t(`${parsed.modifiers.length}行のオプションを候補にしました。数値を写真と照合してください。`,`${parsed.modifiers.length} modifier candidates. Check each number against the photo.`);
  $('confirmed').checked=false;$('review').hidden=false;check();
 }catch(error){resetReview();notifyError(error);}
}
function crop(){
 const left=+$('left').value,top=+$('top').value,right=+$('right').value,bottom=+$('bottom').value;
 return {left,top,right:Math.max(left+5,right),bottom:Math.max(top+5,bottom)};
}
function draw(){
 if(!image)return;
 const canvas=$('canvas'),scale=Math.min(1,1000/image.width);canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);
 const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,canvas.width,canvas.height);
 const {left,top,right,bottom}=crop(),x=canvas.width*left/100,y=canvas.height*top/100,w=canvas.width*(right-left)/100,h=canvas.height*(bottom-top)/100;
 ctx.fillStyle='rgba(0,0,0,.65)';ctx.fillRect(0,0,canvas.width,y);ctx.fillRect(0,y+h,canvas.width,canvas.height-y-h);ctx.fillRect(0,y,x,h);ctx.fillRect(x+w,y,canvas.width-x-w,h);
 ctx.strokeStyle='#f2c96c';ctx.lineWidth=3;ctx.strokeRect(x,y,w,h);
 for(const key of ['left','top','right','bottom'])$('value-'+key).textContent=$(key).value+'%';
}
async function loadImage(file){
 if(!file)return;
 ++serial;await stopWorker();resetReview();releaseImage();busy=false;$('read').disabled=true;$('crop').hidden=true;
 if(file.size>20*1024*1024||!/^image\/(?:jpeg|png|webp|heic|heif|bmp)$/i.test(file.type)){
  status(t('20MB以内の写真・スクリーンショットを選んでください（JPEG・PNG推奨）。','Choose a photo or screenshot up to 20 MB (JPEG or PNG recommended).'));return;
 }
 const token=serial;photoURL=URL.createObjectURL(file);
 try{
  const decoded=new Image();decoded.src=photoURL;await decoded.decode();if(token!==serial)return;
  if(!decoded.width||!decoded.height||decoded.width*decoded.height>50000000)throw Error('image');
  // Release full camera-resolution pixels before starting a second WASM heap.
  const scale=Math.min(1,2400/Math.max(decoded.width,decoded.height)),canvas=document.createElement('canvas');
  canvas.width=Math.round(decoded.width*scale);canvas.height=Math.round(decoded.height*scale);canvas.getContext('2d').drawImage(decoded,0,0,canvas.width,canvas.height);
  image=canvas;URL.revokeObjectURL(photoURL);photoURL=null;
  for(const key of ['left','top','right','bottom'])$(key).value=['right','bottom'].includes(key)?100:0;
  $('crop').hidden=false;draw();$('read').disabled=false;
  status(t('装備の説明全体が枠に入るように調整し、「文字を読み取る」を押してください。','Frame the complete item tooltip, then choose Read text.'));
 }catch{if(token===serial)status(t('画像を開けません。JPEG・PNGで保存して選び直してください。','Cannot open this image. Save it as JPEG or PNG and choose it again.'));}
}
async function read(){
 if(!image||busy)return;
 busy=true;$('read').disabled=true;resetReview();const token=++serial;
 status(t('端末内で読み取りを準備しています。初回は約7MBのデータを読み込みます…','Preparing on-device recognition. The first read downloads about 7 MB…'));
 let timer;
 let ownedWorker=null;
 try{
  const {createPhotoReader}=await import('./simulator-photo-ocr.js?v=2a7877c36e');
  if(token!==serial)return;
  ownedWorker=createPhotoReader($('language').value,m=>{if(token===serial&&m.status==='recognizing text')status(t(`文字を読み取り中… ${Math.round(m.progress*100)}%`,`Reading text… ${Math.round(m.progress*100)}%`));});
  worker=ownedWorker;
  timer=setTimeout(()=>ownedWorker.terminate(Error('timeout')),120000);
  await ownedWorker.ready;if(token!==serial)return;
  const {left,top,right,bottom}=crop(),sx=image.width*left/100,sy=image.height*top/100,sw=image.width*(right-left)/100,sh=image.height*(bottom-top)/100;
  const canvas=document.createElement('canvas'),scale=Math.min(2,2200/Math.max(sw,sh));canvas.width=Math.round(sw*scale);canvas.height=Math.round(sh*scale);
  canvas.getContext('2d').drawImage(image,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
  const data=await ownedWorker.recognize(canvas);if(token!==serial)return;
  $('text').value=data.text;renderReview({initial:true});
  status(data.text.trim()?t('読み取りが終わりました。下の候補と未認識の行を確認してください。','Recognition finished. Review the candidates and unresolved lines below.'):t('文字が見つかりませんでした。説明欄を大きく撮り直してください。','No text found. Take a closer photo of the tooltip.'));
 }catch(error){if(token===serial)notifyError(error);}
 finally{
  clearTimeout(timer);
  if(worker===ownedWorker)worker=null;
  ownedWorker?.terminate();
  if(token===serial){++serial;busy=false;$('read').disabled=!image;check();}
 }
}
function open(source){
 const context=api()?.equipmentPhotoContext();if(!context)return;
 if(window.Poe2Host&&!window.Poe2Host.equipmentCamera){
  document.getElementById('sim-photo-help').textContent=t('この機能にはカメラ対応版アプリが必要です。アプリを更新するか、Safari・ChromeでWeb版を開いてください。','Update to the camera-enabled app, or open the website in Safari or Chrome.');return;
 }
 target=context;if(!context.bases.length){document.getElementById('sim-photo-help').textContent=t('写真取り込みは武器・防具・アクセサリーに対応しています。','Photo import supports weapons, armour and accessories.');return;}
 $('target').textContent=context.title;resetReview();$('crop').hidden=true;$('read').disabled=true;
 $('base').replaceChildren(new Option(t('ベースを選ぶ','Choose a base'),''),...context.bases.map(b=>new Option(b.label,b.id)));
 status(t('装備の説明欄を大きく、正面から撮ってください。撮影が開かない場合は「画像を選ぶ」でスクリーンショットも使えます。','Take a close, straight-on photo of the item tooltip. You can also choose a screenshot.'));
 dialog.showModal();$(source).click();
}
document.getElementById('sim-photo-camera').addEventListener('click',()=>open('capture'));
document.getElementById('sim-photo-select').addEventListener('click',()=>open('file'));
for(const source of ['capture','file'])$(source).addEventListener('change',event=>{void loadImage(event.target.files?.[0]);event.target.value='';});
for(const source of ['capture','file'])$(source).addEventListener('cancel',()=>status(t('撮影・選択をキャンセルしました。画像を選び直せます。','Capture or selection cancelled. You can choose another image.')));
$('choose-camera').addEventListener('click',()=>$('capture').click());
$('choose-file').addEventListener('click',()=>$('file').click());
$('close').addEventListener('click',close);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
$('read').addEventListener('click',read);
for(const key of ['left','top','right','bottom'])$(key).addEventListener('input',()=>{
 if(key==='left'&&+$(key).value>+$('right').value-5)$('right').value=+$(key).value+5;
 if(key==='right'&&+$(key).value<+$('left').value+5)$('left').value=+$(key).value-5;
 if(key==='top'&&+$(key).value>+$('bottom').value-5)$('bottom').value=+$(key).value+5;
 if(key==='bottom'&&+$(key).value<+$('top').value+5)$('top').value=+$(key).value-5;
 ++serial;void stopWorker();busy=false;$('read').disabled=false;resetReview();draw();
});
$('rotate').addEventListener('click',()=>{
 if(!image||busy)return;const canvas=document.createElement('canvas');canvas.width=image.height;canvas.height=image.width;const ctx=canvas.getContext('2d');ctx.translate(canvas.width,0);ctx.rotate(Math.PI/2);ctx.drawImage(image,0,0);image=canvas;
 for(const key of ['left','top','right','bottom'])$(key).value=['right','bottom'].includes(key)?100:0;
 resetReview();draw();
});
$('text').addEventListener('input',()=>renderReview());
$('review').addEventListener('change',check);
$('stage').addEventListener('click',()=>{
 try{
  if($('stage').disabled)return;
  const modifiers=[...$('options').querySelectorAll('input:checked')].map(e=>parsed.modifiers[+e.value]);
  const text=equipmentPhotoText({baseId:$('base').value,name:$('name').value,quality:$('quality').value,level:$('level').value,rarity:$('rarity').value,modifiers},target);
  if(!api()?.equipmentPhotoStage(target.key,text)){status(t('編集対象が変わりました。閉じて、取り込み先の装備からやり直してください。','The editing target changed. Close this dialog and start again from the intended item.'));$('stage').disabled=true;return;}
  close();document.getElementById('sim-photo-help').textContent=t('読み取った候補を装備テキストに入れました。「交換する前に比較」で計算を確認し、「この装備を反映」で確定してください。','Candidates are staged in the item text. Preview the comparison, then choose Apply this item to confirm.');
  document.getElementById('sim-item-text').focus();
 }catch(error){notifyError(error);}
});
window.addEventListener('pagehide',()=>{++serial;void stopWorker();releaseImage();});
