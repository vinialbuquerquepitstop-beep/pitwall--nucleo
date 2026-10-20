'use strict';
// Synthetic, offline, no database writes.
// Proves that a large source keeps its original content across bounded Worker invocations.
const assert=require('node:assert/strict');
const {buildQueue,processListIntakeCommand,MAX_INTAKE_OFFERS_PER_INVOCATION}=
  require('./list-intake-api');

const supplier='33333333-3333-4333-8333-333333333333';
const raw=Array.from({length:32},(_,i)=>[
  'iPhone 15 128GB',
  '🎨 Preto',
  '💵 R$ '+(4500+i)+',00'
].join('\n')).join('\n');
const command={filename:'catalogo-incomum.txt',mime_type:'text/plain',content:raw,supplier_id:supplier};
const one=buildQueue(command),two=buildQueue(command);
assert(one.queue.candidates.length>MAX_INTAKE_OFFERS_PER_INVOCATION);
assert.equal(one.queue.candidates.length,two.queue.candidates.length);
assert.equal(one.queue.candidates[0].interpretation_run_id,two.queue.candidates[0].interpretation_run_id,
  'the same source must produce stable interpretation run IDs across Worker requests');
assert.deepEqual(one.queue.candidates.map(x=>x.offer_id),two.queue.candidates.map(x=>x.offer_id));

const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'synthetic'};
const seen=new Map();
const calls=[];
const previousFetch=globalThis.fetch;
globalThis.fetch=async(url,request)=>{
  const rpc=String(url).split('/rpc/')[1];
  const payload=JSON.parse(request.body);
  calls.push(rpc);
  if(rpc==='extcalc_bind_source_supplier_v0'){
    return {ok:true,status:200,text:async()=>JSON.stringify({
      ok:true,source_id:payload.p_source_id,supplier_id:payload.p_supplier_id
    })};
  }
  const entry=payload.p_candidate||payload.p_promoted;
  assert(entry?.offer_id);
  const key=rpc+':'+entry.offer_id;
  const snapshot=JSON.stringify(entry);
  if(seen.has(key))assert.equal(seen.get(key),snapshot,'retries must preserve exact JSON');
  else seen.set(key,snapshot);
  return {ok:true,status:200,text:async()=>JSON.stringify({ok:true,idempotent:seen.get(key)===snapshot})};
};

async function main(){
  try{
    await assert.rejects(
      processListIntakeCommand({env,token:'synthetic',rawCommand:command}),
      err=>err.code==='LIST_INTAKE_PAGING_REQUIRED'
    );
    assert.equal(calls.length,0,'unpaged requests must be rejected before any DB mutation');

    let offset=0,processed=0,pages=0;
    const identity=[];
    while(true){
      calls.length=0;
      const result=await processListIntakeCommand({
        env,token:'synthetic',rawCommand:{...command,page_offset:offset}
      });
      const page=result.pagination;
      assert.equal(page.offset,offset);
      assert.equal(page.contract_version,'external-calc-list-intake-pagination/v0');
      assert.equal(result.candidates,one.queue.candidates.length);
      assert(page.processed_count>0&&page.processed_count<=MAX_INTAKE_OFFERS_PER_INVOCATION);
      assert(result.persisted===page.processed_count);
      assert(calls.length<=1+2*MAX_INTAKE_OFFERS_PER_INVOCATION,
        'Worker external subrequests must stay far below 50');
      identity.push([result.analysis_id,result.source_id,result.content_hash]);
      processed+=page.processed_count;pages++;
      if(page.complete){
        assert.equal(page.next_offset,null);
        break;
      }
      assert.equal(page.next_offset,offset+page.processed_count);
      offset=page.next_offset;
      assert(pages<20,'pagination must terminate');
    }
    assert.equal(processed,one.queue.candidates.length);
    assert(pages>1);
    for(const triplet of identity)assert.deepEqual(triplet,identity[0]);
    const firstPage=await processListIntakeCommand({
      env,token:'synthetic',rawCommand:{...command,page_offset:0}
    });
    assert(firstPage.idempotent>0,'same page must be safely retryable');
    await assert.rejects(
      processListIntakeCommand({env,token:'synthetic',
        rawCommand:{...command,page_offset:processed+1}}),
      err=>err.code==='LIST_INTAKE_INVALID'
    );
    console.log('EXTERNAL_CALC_LIST_INTAKE_PAGING_V0=PASS');
  }finally{globalThis.fetch=previousFetch;}
}
main().catch(err=>{console.error(err);process.exitCode=1;});
