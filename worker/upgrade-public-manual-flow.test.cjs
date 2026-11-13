'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const html = readFileSync(join(__dirname,'../public/upgrade/index.html'),'utf8');

test('Upgrade starts in manual capture mode without a non-operational catalog request',()=>{
 assert.match(html,/manualCatalog\(\);\s*<\/script>/);
 assert.doesNotMatch(html,/refresh\(\);\s*loadCatalog\(\);\s*<\/script>/);
 assert.match(html,/function manualCatalog\(\)/);
});
test('public submission still targets V2 endpoint with stable request key',()=>{
 assert.match(html,/post\('\/api\/upgrade\/v1\/lead',pendingSubmission\)/);
 assert.match(html,/pendingSubmission=\{request_key:requestKey,selection,contact,consent:true\}/);
 assert.match(html,/let requestKey=crypto\.randomUUID\(\)/);
 assert.match(html,/Não foi possível confirmar o recebimento/);
});
test('financial quote UI remains disabled without approved pricing',()=>{
 assert.match(html,/id="simulate"[^>]+disabled/);
 assert.match(html,/A cotação automática da Calculadora Pitwall V2 ainda não está disponível/);
});


test('optional trade checkbox is sent as null while the normal trade path remains available',()=>{
 assert.match(html,/id="noTrade" type="checkbox"/);
 assert.match(html,/id="tradeFields"/);
 assert.match(html,/trade_in:\$\('#noTrade'\)\.checked\?null:/);
 assert.match(html,/\$\('#noTrade'\)\.checked\|\|requireFields\(\['#ownedModel','#ownedCapacity','#ownedCondition'\]\)/);
 assert.match(html,/\$\('#tradeFields'\)\.classList\.toggle\('hidden',disabled\)/);
});


test('optional address field is included in private V2 lead payload',()=>{
 assert.match(html,/id="contactAddress" maxlength="200"/);
 assert.match(html,/\.\.\.\(field\('#contactAddress'\)\?\{address:field\('#contactAddress'\)\}:\{\}\s*\)/);
 assert.match(html,/post\('\/api\/upgrade\/v1\/lead'/);
});


test('ambiguous network failure retries the identical frozen payload and key',()=>{
 const script=html.split('<script>')[1]?.split('</script>')[0];
 assert.ok(script,'expected executable landing script');
 assert.doesNotThrow(()=>new Function(script));
 for(const fragment of [
  'let pendingSubmission=null',
  'if(!pendingSubmission){',
  'pendingSubmission={request_key:requestKey,selection,contact,consent:true}',
  'lockSubmittedFields();',
  "post('/api/upgrade/v1/lead',pendingSubmission)",
  "querySelectorAll('#upgrade-form input, #upgrade-form select')",
  'sem recarregar a página'
 ])assert.ok(script.includes(fragment),fragment);
});

test('confirmed HTTP 400 allows correction with a new key but preserves disabled defaults',()=>{
 const script=html.split('<script>')[1]?.split('</script>')[0];
 const from=script.indexOf('let requestKey=crypto.randomUUID();');
 const to=script.indexOf('function field(id)',from);
 assert.ok(from>=0&&to>from);
 const controls=[{disabled:false},{disabled:true},{disabled:false}];
 const navigation=Object.fromEntries(['#next1','#next2','#back2','#back3'].map(id=>[id,{disabled:false}]));
 let counter=0;
 const scenario=new Function('document','
  const initial=requestKey;
  pendingSubmission={request_key:requestKey,contact:{name:'A'}};
  lockSubmittedFields();
  const whenLocked=controls.map(x=>x.disabled);
  unlockRejectedSubmission();
  return {initial,after:requestKey,whenLocked,afterUnlock:controls.map(x=>x.disabled),
   navLocked:Object.values(navigation).map(x=>x.disabled),pendingSubmission};
 `);
 const result=scenario({querySelectorAll:()=>controls},id=>navigation[id],{
  randomUUID:()=>String(++counter).padStart(36,'0')
 },controls,navigation);
 assert.notEqual(result.initial,result.after);
 assert.deepEqual(result.whenLocked,[true,true,true]);
 assert.deepEqual(result.afterUnlock,[false,true,false]);
 assert.deepEqual(result.navLocked,[false,false,false,false]);
 assert.equal(result.pendingSubmission,null);
});
test('HTTP rejection is distinguishable from unknown network failures',async()=>{
 const script=html.split('<script>')[1]?.split('</script>')[0];
 const from=script.indexOf('async function post(');
 const to=script.indexOf('function presentQuote(',from);
 assert.ok(from>=0&&to>from);
 const post=new Function('fetch','AbortController','setTimeout','clearTimeout',
  script.slice(from,to)+'return post;')(
   async()=>({ok:false,status:400}),AbortController,setTimeout,clearTimeout
  );
 await assert.rejects(post('/api/upgrade/v1/lead',{request_key:'x'}),
  error=>error.status===400);
 assert.ok(script.includes('const invalid=err?.status===400'));
 assert.ok(script.includes('if(invalid){\n   unlockRejectedSubmission();'));
});
,'crypto','controls','navigation',script.slice(from,to)+`
  const initial=requestKey;
  pendingSubmission={request_key:requestKey,contact:{name:'A'}};
  lockSubmittedFields();
  const whenLocked=controls.map(x=>x.disabled);
  unlockRejectedSubmission();
  return {initial,after:requestKey,whenLocked,afterUnlock:controls.map(x=>x.disabled),
   navLocked:Object.values(navigation).map(x=>x.disabled),pendingSubmission};
 `);
 const result=scenario({querySelectorAll:()=>controls},id=>navigation[id],{
  randomUUID:()=>String(++counter).padStart(36,'0')
 });
 assert.notEqual(result.initial,result.after);
 assert.deepEqual(result.whenLocked,[true,true,true]);
 assert.deepEqual(result.afterUnlock,[false,true,false]);
 assert.deepEqual(result.navLocked,[false,false,false,false]);
 assert.equal(result.pendingSubmission,null);
});
test('HTTP rejection is distinguishable from unknown network failures',async()=>{
 const script=html.split('<script>')[1]?.split('</script>')[0];
 const from=script.indexOf('async function post(');
 const to=script.indexOf('function presentQuote(',from);
 assert.ok(from>=0&&to>from);
 const post=new Function('fetch','AbortController','setTimeout','clearTimeout',
  script.slice(from,to)+'return post;')(
   async()=>({ok:false,status:400}),AbortController,setTimeout,clearTimeout
  );
 await assert.rejects(post('/api/upgrade/v1/lead',{request_key:'x'}),
  error=>error.status===400);
 assert.ok(script.includes('const invalid=err?.status===400'));
 assert.ok(script.includes('if(invalid){\n   unlockRejectedSubmission();'));
});
