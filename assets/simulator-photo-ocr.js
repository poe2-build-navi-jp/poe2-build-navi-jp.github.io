// Tesseract.js 7 worker transport. Owning the worker before initialization lets
// cancellation/network failure release its memory at every stage, including boot.
// The protocol and generated assets are version-locked together and browser-tested.
export function createPhotoReader(lang,progress=()=>{}) {
  if(!['jpn','eng'].includes(lang))throw Error('language');
  const worker=new Worker('/assets/equipment-ocr/v7/worker.min.js'),pending=new Map();let sequence=0,closed=false;
  const terminate=(error=Error('cancelled'))=>{
    if(closed)return;closed=true;worker.terminate();for(const p of pending.values())p.reject(error);pending.clear();
  };
  worker.onmessage=({data:m})=>{
    if(m.status==='progress'){progress(m.data);return;}
    const task=pending.get(m.jobId);if(!task)return;pending.delete(m.jobId);
    m.status==='resolve'?task.resolve(m.data):task.reject(Error(String(m.data).slice(0,300)));
  };
  worker.onerror=()=>terminate(Error('worker'));
  const call=(action,payload)=>new Promise((resolve,reject)=>{
    if(closed){reject(Error('cancelled'));return;}
    const jobId='photo-'+(++sequence);pending.set(jobId,{resolve,reject});worker.postMessage({workerId:'poe2-equipment',jobId,action,payload});
  });
  const ready=(async()=>{
    await call('load',{options:{lstmOnly:true,corePath:location.origin+'/assets/equipment-ocr/v7',logging:false}});
    await call('loadLanguage',{langs:lang,options:{langPath:location.origin+'/assets/equipment-ocr/v7',cachePath:'poe2-equipment-ocr-v7-best-int',gzip:true,lstmOnly:true}});
    await call('initialize',{langs:lang,oem:1,config:{}});
    await call('setParameters',{params:{tessedit_pageseg_mode:'6',preserve_interword_spaces:'1'}});
  })();
  return {ready,terminate,async recognize(canvas){
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('image')),'image/png'));
    const bytes=new Uint8Array(await blob.arrayBuffer());
    return call('recognize',{image:bytes,options:{},output:{text:true}});
  }};
}
