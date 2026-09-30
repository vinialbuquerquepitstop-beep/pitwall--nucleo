'use strict';
const assert=require('assert');
const {buildHomeProjection,currentReady}=require('./home-product-projection');
function row({signal='CHEAP',price=600000,outcome='READY',fresh='CURRENT',id='off_1'}={}){
 const c01={analysis_id:'ana_1',offer_id:id,offer_revision:1,execution_status:'SUCCEEDED',domain_outcome:'VALID',freshness_status:'CURRENT',reviewed_offer:{supplier_id:'SUP',model:{id:'iphone',label:'iPhone'},capacity_gb:256,color:'PRETO',price:{amount_minor:price,currency:'BRL'}}};
 const c04={price_signal:signal,price_signal_run_id:'sig_'+id};
 const c05={analysis_id:'ana_1',offer_id:id,offer_revision:1,execution_status:'SUCCEEDED',domain_outcome:outcome,freshness_status:fresh,provenance_refs:['decision:'+id]};
 return {c01,c04,c05,updated_at:'2026-09-30T18:00:00.000Z'};
}
let n=0;function check(name,fn){fn();n++;console.log('OK '+n+' - '+name);}
check('READY + CURRENT e a unica elegibilidade acionavel',()=>{assert.equal(currentReady(row()),true);assert.equal(currentReady(row({outcome:'INSUFFICIENT_DATA'})),false);assert.equal(currentReady(row({fresh:'STALE'})),false);});
check('Home preserva referencia exata da oferta',()=>{const x=buildHomeProjection([row()],{generated_at:'2026-09-30T18:00:00.000Z'}).opportunities.items[0];assert.deepStrictEqual(x.action,{type:'OPEN_OFFER',analysis_id:'ana_1',offer_id:'off_1',offer_revision:1});});
check('ordenacao pertence ao servidor e e deterministica',()=>{const x=buildHomeProjection([row({id:'market',signal:'MARKET',price:500000}),row({id:'cheap2',signal:'CHEAP',price:620000}),row({id:'cheap1',signal:'CHEAP',price:600000})]);assert.deepStrictEqual(x.opportunities.items.map(i=>i.offer_id),['cheap1','cheap2','market']);assert.deepStrictEqual(x.opportunities.items.map(i=>i.position),[1,2,3]);});
check('C04 e fonte explicita da classificacao',()=>{const x=buildHomeProjection([row()]).opportunities.items[0];assert.deepStrictEqual(x.classification_source,{contract:'C04',run_id:'sig_off_1'});assert.equal(x.price_signal,'CHEAP');});
check('sem C05 READY nao fabrica oportunidade',()=>{const x=buildHomeProjection([row({outcome:'INSUFFICIENT_DATA'})]);assert.equal(x.opportunities.status,'INSUFFICIENT_DATA');assert.equal(x.opportunities.items.length,0);});
check('sem fatos Home fica vazia e Advisor nao inventa insight',()=>{const x=buildHomeProjection([]);assert.equal(x.continuity.state,'NONE');assert.equal(x.opportunities.status,'EMPTY');assert.deepStrictEqual(x.advisor,{status:'UNAVAILABLE',insights:[]});});
console.log('HOME_PRODUCT_PROJECTION_V1=PASS checks='+n);
