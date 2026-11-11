'use strict';
const assert=require('node:assert/strict');
const {buildQueue,processListIntakeCommand}=require('./list-intake-api');

const supplierA='11111111-1111-4111-8111-111111111111';
const supplierB='22222222-2222-4222-8222-222222222222';
const list={
  filename:'lista.txt',
  mime_type:'text/plain',
  content:Array.from({length:18},(_,i)=>[
    'iPhone 15 128GB',
    'Preto',
    'R$ '+(4500+i)+',00'
  ].join('\n')).join('\n\n'),
};
const a=buildQueue({...list,supplier_id:supplierA});
const b=buildQueue({...list,supplier_id:supplierA});
const other=buildQueue({...list,supplier_id:supplierB});
assert.equal(a.source_id,b.source_id);
assert.equal(a.analysis_id,b.analysis_id);
assert.deepEqual(a.queue.candidates,b.queue.candidates,
  'immutable C01 candidate snapshots must be identical on retry');
assert.notEqual(a.source_id,other.source_id);
assert.notEqual(a.queue.interpretation_run_id,other.queue.interpretation_run_id);
assert.ok(a.queue.candidates.length>8,'fixture must exercise more than one page');

const originalFetch=globalThis.fetch;
const events=[];
const persisted=new Set();
globalThis.fetch=async (url,options)=>{
  const rpc=String(url).split('/').pop();
  const payload=JSON.parse(options.body);
  events.push({rpc,payload});
  const offerId=payload.p_candidate?.offer_id||payload.p_promoted?.offer_id||'';
  const key=rpc+'|'+offerId;
  const idempotent=persisted.has(key);
  persisted.add(key);
  return {ok:true,status:200,text:async()=>JSON.stringify({ok:true,idempotent})};
};
const run=(supplier_id,offset,hash)=>processListIntakeCommand({
  env:{SUPABASE_URL:'https://stub.invalid',SUPABASE_ANON_KEY:'test-key'},
  token:'test-token',
  rawCommand:{...list,supplier_id,batch_offset:offset,
    ...(hash?{expected_content_hash:hash}:{})}
});
(async()=>{
  try{
    const hash=a.canonical.source.content_hash;
    let offset=0,pages=0,total=0,first=null;
    const all=[];
    while(offset!==null){
      events.length=0;
      const result=await run(supplierA,offset,offset===0?undefined:hash);
      assert.ok(result.persisted<=8);
      assert.ok(events.length<=17,'maximum 1 supplier bind + 2 RPCs per item');
      assert.equal(result.batch_offset,offset);
      assert.equal(result.content_hash,hash);
      if(first===null)first=result;
      assert.equal(result.source_id,first.source_id);
      assert.equal(result.analysis_id,first.analysis_id);
      all.push(result);
      total+=result.persisted;
      pages++;
      offset=result.next_offset;
      assert.ok(pages<100,'pagination must terminate');
    }
    assert.equal(total,a.queue.candidates.length);
    assert.ok(pages>=2);
    events.length=0;
    const replay=await run(supplierA,0);
    assert.equal(replay.persisted,Math.min(8,a.queue.candidates.length));
    assert.ok(replay.idempotent>0,'replaying the same page must be idempotent');
    events.length=0;
    await assert.rejects(
      run(supplierA,8,'sha256:'+'f'.repeat(64)),
      e=>e.code==='LIST_INTAKE_SOURCE_CHANGED'
    );
    assert.equal(events.length,0,'changed source must be rejected before all DB RPCs');
    const alternate=await run(supplierB,0);
    assert.notEqual(first.source_id,alternate.source_id);
    events.length=0;
    await assert.rejects(
      run(supplierA,a.queue.candidates.length+1,hash),
      e=>e.code==='LIST_INTAKE_INVALID'
    );
    assert.equal(events.length,0,'invalid offset must not write');
    console.log('INTAKE_BOUNDED_PAGING_REAL_PARSER=PASS',{
      candidates:a.queue.candidates.length,pages,replay_idempotent:replay.idempotent
    });
  }finally{
    globalThis.fetch=originalFetch;
  }
})().catch(e=>{console.error(e);process.exitCode=1});
