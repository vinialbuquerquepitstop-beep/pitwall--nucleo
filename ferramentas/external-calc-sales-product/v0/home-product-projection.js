'use strict';

const HOME_PROJECTION_VERSION='external-calc-home-product-projection/v1';

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
  const c01=row?.c01, c05=row?.c05;
  return !!c01&&!!c05&&
    c01.execution_status==='SUCCEEDED'&&c01.domain_outcome==='VALID'&&c01.freshness_status==='CURRENT'&&
    c05.execution_status==='SUCCEEDED'&&c05.domain_outcome==='READY'&&c05.freshness_status==='CURRENT'&&
    c01.analysis_id===c05.analysis_id&&c01.offer_id===c05.offer_id&&c01.offer_revision===c05.offer_revision;
}
function buildHomeProjection(rows,{generated_at}={}){
  const all=Array.isArray(rows)?rows:[];
  const ready=all.filter(currentReady);
  const opportunities=ready.map((row,index)=>{
    const c01=row.c01,c04=row.c04,c05=row.c05,o=c01.reviewed_offer||{};
    const ref=exactRef(c01);
    return {
      opportunity_id:`home:${ref.analysis_id}:${ref.offer_id}:r${ref.offer_revision}`,
      position:index+1,
      ...ref,
      model:label(c01),
      variant:[Number.isInteger(o.capacity_gb)?o.capacity_gb+'GB':null,o.color||null].filter(Boolean).join(' · ')||null,
      supplier:o.supplier_id||null,
      supplier_price:money(o.price),
      reason:'MARKET_POSITION',
      price_signal:['CHEAP','MARKET','EXPENSIVE'].includes(c04?.price_signal)?c04.price_signal:null,
      analysis_outcome:'READY',
      freshness_status:'CURRENT',
      evidence_refs:Array.isArray(c05.provenance_refs)?[...c05.provenance_refs]:[],
      classification_source:c04?.price_signal_run_id?{contract:'C04',run_id:c04.price_signal_run_id}:null,
      action:{type:'OPEN_OFFER',...ref}
    };
  }).sort((a,b)=>{
    const rank={CHEAP:0,MARKET:1,EXPENSIVE:2};
    return (rank[a.price_signal]??3)-(rank[b.price_signal]??3)||
      (a.supplier_price?.amount_minor??Number.MAX_SAFE_INTEGER)-(b.supplier_price?.amount_minor??Number.MAX_SAFE_INTEGER)||
      a.offer_id.localeCompare(b.offer_id);
  }).map((x,i)=>({...x,position:i+1}));

  const latest=all.filter(x=>x?.c01).sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||'')))[0]||null;
  let continuity={state:'NONE'};
  if(latest){
    const c01=latest.c01,ref=exactRef(c01);
    if(latest.c05?.freshness_status==='CURRENT'&&latest.c05?.domain_outcome==='READY')
      continuity={state:'RESULT_AVAILABLE',...ref,label:label(c01),updated_at:latest.updated_at||null,action:{type:'OPEN_OFFER',...ref}};
    else if(c01.domain_outcome==='REVIEW_REQUIRED')
      continuity={state:'REVIEW_REQUIRED',...ref,label:label(c01),updated_at:latest.updated_at||null,action:{type:'OPEN_REVIEW',analysis_id:ref.analysis_id}};
    else continuity={state:'ANALYSIS_IN_PROGRESS',...ref,label:label(c01),updated_at:latest.updated_at||null,action:{type:'OPEN_OFFER',...ref}};
  }
  return {
    contract_version:'home-data-v1',
    projection_version:HOME_PROJECTION_VERSION,
    generated_at:generated_at||new Date().toISOString(),
    continuity,
    opportunities:{status:opportunities.length?'AVAILABLE':(all.length?'INSUFFICIENT_DATA':'EMPTY'),items:opportunities},
    advisor:{status:'UNAVAILABLE',insights:[]}
  };
}
module.exports={HOME_PROJECTION_VERSION,buildHomeProjection,currentReady};
