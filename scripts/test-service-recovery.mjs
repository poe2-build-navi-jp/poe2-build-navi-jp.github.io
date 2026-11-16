import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SyncHttpTransport,serviceRequest,SERVICE_ORIGIN,LEGACY_RETRY_AT} from '../assets/simulator-service.js';
import {PublicBuildTransport} from '../assets/community-transport.js';
const realFetch=globalThis.fetch,realNow=Date.now;
try {
  const ciphertext='L'.repeat(2799000),hash=value=>createHash('sha256').update(value).digest('hex'),calls=[];
  const body={room:'r'.repeat(43),token:'t'.repeat(43),revision:0,requestId:'multipart-request-0001',iv:'v'.repeat(16),ciphertext};
  globalThis.fetch=async(url,options)=>{
    assert(url.startsWith(SERVICE_ORIGIN));assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');
    const op=url.split('/').at(-1),input=JSON.parse(options.body);calls.push({op,input});
    if(op==='upload-start')return Response.json({started:true});
    if(op==='upload-chunk'){assert(input.ciphertext.length<=150000);return Response.json({uploaded:true});}
    if(op==='upload-commit')return Response.json({revision:1});
    if(op==='read-chunk')return Response.json({revision:1,ciphertext:ciphertext.slice(input.index*150000,(input.index+1)*150000)});
    if(op==='read')return Response.json(input.revision===1?{revision:1,unchanged:true}:{revision:1,envelope:{iv:body.iv,count:19,chunked:true,hash:hash(ciphertext)}});
    throw Error('Unexpected operation');
  };
  const transport=new SyncHttpTransport();
  assert.equal((await transport.request('write',body)).revision,1);
  assert.equal(calls.filter(call=>call.op==='upload-chunk').length,19);
  assert.equal(calls[0].input.hash,hash(JSON.stringify([body.revision,body.iv,ciphertext])));
  assert.equal((await transport.request('read',{room:body.room,token:body.token})).envelope.ciphertext,ciphertext);
  globalThis.fetch=async()=>Response.json({code:'APP_TEMPORARILY_UNAVAILABLE'},{status:402});
  await assert.rejects(serviceRequest('/api/public/list',{}),cause=>cause.status===402&&cause.message==='APP_TEMPORARILY_UNAVAILABLE');
  Date.now=()=>LEGACY_RETRY_AT+1;
  const sourceCalls=[],oldPost={id:'legacy-public-post-000001',title:'Previous post'};
  const publicTransport=new PublicBuildTransport({legacy:{async request(op,input){sourceCalls.push({op,input});return op==='mine'?{posts:[oldPost]}:op==='read'?oldPost:{ok:true};}}});
  publicTransport.current=async(op)=>{
    if(op==='read')throw Object.assign(Error('PUBLIC_NOT_FOUND'),{status:404});
    return {posts:[]};
  };
  assert.equal((await publicTransport.request('read',{id:oldPost.id})).title,oldPost.title);
  await publicTransport.request('report',{id:oldPost.id});await publicTransport.request('withdraw',{id:oldPost.id});
  assert.deepEqual(sourceCalls.map(call=>call.op),['read','report','withdraw']);
  assert.equal((await publicTransport.request('mine',{token:'x'.repeat(43)})).posts[0].id,oldPost.id);
  publicTransport.legacy.request=async()=>{throw Object.assign(Error('APP_TEMPORARILY_UNAVAILABLE'),{status:402});};
  const partial=await publicTransport.request('mine',{token:'x'.repeat(43)});
  assert.equal(partial.partial,true,'legacy unavailability must never claim there are no previous posts');
  publicTransport.current=async()=>{throw Object.assign(Error('PUBLIC_WITHDRAWN'),{status:404});};
  await assert.rejects(publicTransport.request('read',{id:'withdrawn-current-00000001'}),cause=>cause.message==='PUBLIC_WITHDRAWN');
  console.log('PASS: bounded direct HTTP, chunk hash/revision checks, generic 402, source-routed old posts/reports/withdrawal and partial ownership');
} finally {globalThis.fetch=realFetch;Date.now=realNow;}
