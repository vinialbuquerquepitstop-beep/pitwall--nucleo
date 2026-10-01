'use strict';
const assert=require('assert');
const {buildHomeProjection,currentReady,HOME_ORDERING_VERSION}=require('./home-product-projection');
function row({signal='CHEAP',price=600000,outcome='READY',fresh='CURRENT',id='off_1',c04=true}={}){
 const c01={analysis_id:'ana_1',offer_id:id,offer_revision:1,execution_status:'SUCCEEDED',domain_outcome:'VALID',freshness_status:'CURRENT',reviewed_offer:{supplier_id:'SUP',model:{id:'iphone',label:'iPhone'},capacity_gb:256,color:'PRETO',price:{amount_minor:price,currency:'BRL'}}};
 const indicator=c04?{price_signal:signal,price_signal_run_id:'sig_'+id}:null;
 const c05={analysis_id:'ana_1',offer_id:id,offer_revision:1,execution_status:'SUCCEEDED',domain_outcome:outcome,freshness_status:fresh,provenance_refs:['decision:'+id]};
 return {c01,c04:indicator,c05,updated_at:'2026-09-30T18:00:00.000Z'};
}
let n=0;function check(name,fn){fn();n++;console.log('OK '+n+' - '+name);}
check('READY + CURRENT + C04 valida e a unica elegibilidade acionavel',()=>{assert.equal(currentReady(row()),true);assert.equal(currentReady(row({outcome:'INSUFFICIENT_DATA'})),false);assert.equal(currentReady(row({fresh:'STALE'})),false);assert.equal(currentReady(row({c04:false})),false);});
check('Home preserva referencia exata da oferta',()=>{const x=buildHomeProjection([row()],{generated_at:'2026-09-30T18:00:00.000Z'}).opportunities.items[0];assert.deepStrictEqual(x.action,{type:'OPEN_OFFER',analysis_id:'ana_1',offer_id:'off_1',offer_revision:1});});
check('ordenacao pertence ao servidor, usa server_position e limita cinco',()=>{const rows=[row({id:'market',signal:'MARKET',price:500000}),row({id:'cheap2',price:620000}),row({id:'cheap1',price:600000}),row({id:'cheap3',price:630000}),row({id:'cheap4',price:640000}),row({id:'cheap5',price:650000})];const x=buildHomeProjection(rows);assert.equal(x.opportunities.items.length,5);assert.deepStrictEqual(x.opportunities.items.slice(0,2).map(i=>i.offer_id),['cheap1','cheap2']);assert.deepStrictEqual(x.opportunities.items.map(i=>i.server_position),[1,2,3,4,5]);});
check('projecao publica mapeia lifecycle CURRENT para Home FRESH sem alterar C01-C05',()=>{const x=buildHomeProjection([row()]).opportunities.items[0];assert.equal(x.freshness_status,'FRESH');});
check('ordering_version e obrigatorio e projection_version nao vaza no contrato publico',()=>{const x=buildHomeProjection([row()]);assert.equal(x.opportunities.ordering_version,HOME_ORDERING_VERSION);assert.equal(Object.prototype.hasOwnProperty.call(x,'projection_version'),false);});
check('C04 fornece price_signal sem metadado interno extra no item publico',()=>{const x=buildHomeProjection([row()]).opportunities.items[0];assert.equal(x.price_signal,'CHEAP');assert.equal(Object.prototype.hasOwnProperty.call(x,'classification_source'),false);});
check('sem C05 READY nao fabrica oportunidade',()=>{const x=buildHomeProjection([row({outcome:'INSUFFICIENT_DATA'})]);assert.equal(x.opportunities.status,'INSUFFICIENT_DATA');assert.equal(x.opportunities.items.length,0);});
check('REVIEW_REQUIRED nao fabrica action fora do enum congelado',()=>{const r=row();r.c01.domain_outcome='REVIEW_REQUIRED';r.c05=null;const x=buildHomeProjection([r]);assert.equal(x.continuity.state,'REVIEW_REQUIRED');assert.equal(Object.prototype.hasOwnProperty.call(x.continuity,'action'),false);});
check('sem fatos Home fica vazia e Advisor nao inventa insight',()=>{const x=buildHomeProjection([]);assert.equal(x.continuity.state,'NONE');assert.equal(x.opportunities.status,'EMPTY');assert.equal(x.opportunities.ordering_version,HOME_ORDERING_VERSION);assert.deepStrictEqual(x.advisor,{status:'UNAVAILABLE',insights:[]});});
console.log('HOME_PRODUCT_PROJECTION_V1=PASS checks='+n);
