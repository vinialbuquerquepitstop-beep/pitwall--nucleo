'use strict';

const HOME_PROJECTION_VERSION='external-calc-home-product-projection/v1';
const HOME_ORDERING_VERSION='home-opportunity-order-v1';

function money(v){
  return v&&Number.isSafeInteger(v.amount_minor)&&v.amount_minor>=0&&v.currency==='BRL'
    ? {amount_minor:v.amount_minor,currency:'BRL'} : null;
}
function label(c01){
  const m=c01?.reviewed_offer?.model;
  return m?.label||m?.attributes?.display_label||m?.id||null;
}
function exactRef(x){return {analysis_id:x.analysis_id,offer_id:x.offer_id,offer_revision:x.offer_revision};}
function currentReady(row){
  const c01=row?.c01,c04=row?.c04,c05=row?.c05;
  return !!c01&&!!c04&&!!c05&&
    c01.execution_status==='SUCCEEDED'&&c01.domain_outcome==='VALID'&&c01.freshness_status==='CURRENT'&&
    ['CHEAP','MARKET','EXPENSIVE'].includes(c04.price_signal)&&
    c05.execution_status==='SUCCEEDED'&&c05.domain_outcome==='READY'&&c05.freshness_status==='CURRENT'&&
    c01.analysis_id===c05.analysis_id&&c01.offer_id===c05.offer_id&&c01.offer_revision===c05.offer_revision;
}
function homeAction(ref){return {type:'OPEN_OFFER',...ref};}
function buildHomeProjection(rows,{generated_at}={}){
  const all=Array.isArray(rows)?rows:[];
  const ready=all.filter(currentReady);
  const opportunities=ready.map(row=>{
    const c01=row.c01,c04=row.c04,c05=row.c05,o=c01.reviewed_offer||{};
    const ref=exactRef(c01);
    return {
      opportunity_id:`home:${ref.analysis_id}:${ref.offer_id}:r${ref.offer_revision}`,
      ...ref,
      model:label(c01),
      variant:[Number.isInteger(o.capacity_gb)?o.capacity_gb+'GB':null,o.color||null].filter(Boolean).join(' · ')||undefined,
      supplier:o.supplier_id||null,
      supplier_price:money(o.price),
      reason:'MARKET_POSITION',
      price_signal:c04.price_signal,
      analysis_outcome:'READY',
      freshness_status:'FRESH',
      evidence_refs:Array.isArray(c05.provenance_refs)?[...c05.provenance_refs]:[],
      action:homeAction(ref)
    };
  }).filter(x=>x.model&&x.supplier&&x.supplier_price&&x.evidence_refs.length).sort((a,b)=>{
    const rank={CHEAP:0,MARKET:1,EXPENSIVE:2};
    return rank[a.price_signal]-rank[b.price_signal]||
      a.supplier_price.amount_minor-b.supplier_price.amount_minor||
      a.offer_id.localeCompare(b.offer_id);
  }).slice(0,5).map((x,i)=>({...x,server_position:i+1}));

  const latest=all.filter(x=>x?.c01).sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||'')))[0]||null;
  let continuity={state:'NONE'};
  if(latest){
    const c01=latest.c01,ref=exactRef(c01);
    if(latest.c05?.freshness_status==='CURRENT'&&latest.c05?.domain_outcome==='READY')
      continuity={state:'RESULT_AVAILABLE',...ref,label:label(c01),updated_at:latest.updated_at||undefined,action:homeAction(ref)};
    else if(c01.domain_outcome==='REVIEW_REQUIRED')
      continuity={state:'REVIEW_REQUIRED',...ref,label:label(c01),updated_at:latest.updated_at||undefined};
    else continuity={state:'ANALYSIS_IN_PROGRESS',...ref,label:label(c01),updated_at:latest.updated_at||undefined,action:homeAction(ref)};
  }
  const generated=generated_at||new Date().toISOString();
  return {
    contract_version:'home-data-v1',
    generated_at:generated,
    continuity,
    opportunities:{
      status:opportunities.length?'AVAILABLE':(all.length?'INSUFFICIENT_DATA':'EMPTY'),
      ordering_version:HOME_ORDERING_VERSION,
      ...(opportunities.length?{evaluated_at:generated}:{}),
      items:opportunities
    },
    advisor:{status:'UNAVAILABLE',insights:[]}
  };
}
module.exports={HOME_PROJECTION_VERSION,HOME_ORDERING_VERSION,buildHomeProjection,currentReady};
