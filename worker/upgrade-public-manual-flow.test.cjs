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
 assert.match(html,/post\('\/api\/upgrade\/v1\/lead',\{request_key:requestKey,selection,contact,consent:true\}\)/);
 assert.match(html,/const requestKey=crypto\.randomUUID\(\)/);
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
