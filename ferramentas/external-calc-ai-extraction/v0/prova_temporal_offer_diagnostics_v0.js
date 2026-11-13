'use strict';
const assert=require('node:assert/strict');
const {temporalDiagnostics,messages}=require('./temporal-offer-diagnostics');
const chat='[12/11/2026, 10:00] Quality: iPhone 17 256GB Azul R$ 5.399,99\n'+
 '[12/11/2026, 14:00] Quality: iPhone 17 256GB Azul R$ 5.299,99';
const sources=[{source_ref:'chat',text:chat}];
const offer=(ref,price,quote)=>({offer_ref:ref,model:'iPhone 17',capacity_gb:256,color:'Azul',condition:'Lacrado',price:{amount_minor:price},field_evidence:{price:[{source_ref:'chat',quote}]}});
const older=offer('old',539999,'R$ 5.399,99'),newer=offer('new',529999,'R$ 5.299,99');
let checks=0;
function ok(name,fn){fn();checks++;console.log('PASS',name)}
ok('extract two WhatsApp messages',()=>assert.equal(messages(sources[0]).length,2));
ok('valid chronological price change flags both, no winner',()=>{
 const x=temporalDiagnostics({sources,offers:[older,newer]});
 assert.equal(x.issues.length,2);
 assert.deepEqual([...new Set(x.issues.map(i=>i.reason))],['HISTORICAL_PRICE_UPDATE_REQUIRES_REVIEW']);
 assert.equal(x.selected_latest_offer_ref,null);
 assert.equal(x.chronological_authority,false);
});
ok('same value in later message becomes duplicate review',()=>{
 const x=temporalDiagnostics({sources,offers:[older,{...newer,price:{amount_minor:539999}}]});
 assert.equal(x.issues.length,2);
 assert.equal(x.issues[0].reason,'REPEATED_SAME_PRICE_MESSAGE');
});
ok('other sender never merges group',()=>{
 const changed=sources.map(s=>({...s,text:s.text.replace('14:00] Quality:', '14:00] OutraLoja:')}));
 assert.equal(temporalDiagnostics({sources:changed,offers:[older,newer]}).issues.length,0);
});
ok('unknown timestamps route conflict to review, not latest',()=>{
 const x=temporalDiagnostics({sources:[{source_ref:'chat',text:'iPhone 17 256GB Azul R$ 5.399,99\niPhone 17 256GB Azul R$ 5.299,99'}],offers:[older,newer]});
 assert.equal(x.issues.length,2);
 assert.equal(x.issues[0].reason,'CONFLICTING_PRICE_CHRONOLOGY_UNKNOWN');
});
ok('invalid calendar date is not ordering authority',()=>{
 const s=[{source_ref:'chat',text:chat.replaceAll('12/11/2026','32/11/2026')}];
 const x=temporalDiagnostics({sources:s,offers:[older,newer]});
 assert.equal(x.issues.length,2);
 assert.equal(x.issues[0].reason,'CONFLICTING_PRICE_CHRONOLOGY_UNKNOWN');
});
ok('different source files do not merge by AI supplier label',()=>{
 const s=[{source_ref:'a',text:'iPhone 17 R$ 5.399,99'},{source_ref:'b',text:'iPhone 17 R$ 5.299,99'}];
 const o=[{...older,field_evidence:{price:[{source_ref:'a',quote:'R$ 5.399,99'}]}},{...newer,field_evidence:{price:[{source_ref:'b',quote:'R$ 5.299,99'}]}}];
 assert.equal(temporalDiagnostics({sources:s,offers:o}).issues.length,0);
});
ok('partial price update without model stays unbound',()=>{
 const src=[{source_ref:'chat',text:'[12/11/2026, 10:00] Quality: iPhone 17 256GB Azul R$ 5.399,99\\n[12/11/2026, 14:00] Quality: Baixou para R$ 5.200,00'.replace('\\n','\n')}];
 const x=temporalDiagnostics({sources:src,offers:[]});
 assert.equal(x.unbound_partial_updates,1);
 assert.equal(x.selected_latest_offer_ref,null);
});
ok('CRLF long first message keeps a late price bound to the first header',()=>{
 const text=[
  '[12/11/26, 10:00] Quality: iPhone 17 Azul',
  ...Array.from({length:45},(_,i)=>'Obs '+i+' estoque'),
  'R$ 5.399,99',
  '[12/11/26, 11:00] Quality: Atualizado R$ 5.199,99'
 ].join('\r\n');
 const source={source_ref:'chat',text};
 const scoped=messages(source);
 const oldPriceOffset=text.indexOf('R$ 5.399,99');
 assert.equal(scoped.length,2);
 assert.equal(scoped[1].start,text.indexOf('[12/11/26, 11:00]'));
 assert.ok(oldPriceOffset<scoped[0].end);
 const x=temporalDiagnostics({sources:[source],offers:[offer('old',539999,'R$ 5.399,99')]});
 assert.equal(x.events[0].scope_verified,true);
});
console.log('EXTERNAL_AI_TEMPORAL_DIAGNOSTICS=PASS',checks);
