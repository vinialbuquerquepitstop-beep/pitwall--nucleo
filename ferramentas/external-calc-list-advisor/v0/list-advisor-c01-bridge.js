'use strict';

const crypto = require('crypto');
const { buildKnowledgeIndex, resolveEntityCandidate } = require('../../interpreter-core/v1/core');
const knowledge = require('../../interpreter-core/v1/domains/apple-iphone-v0.knowledge.json');
const { partitionCandidates } = require('../../external-calc-list-intake/v0/auto-promotion-authority');

const CONTRACT_VERSION = 'external-calc-c01-readonly/v1';
const ENGINE_VERSION = 'external-calc-list-advisor/v0';

function hash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}
function stableId(prefix, ...parts) {
  return prefix + '_' + hash(parts.join('\x1f')).slice(0, 24);
}
function fallbackModelId(label) {
  const slug=String(label)
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLocaleLowerCase('pt-BR')
    .replace(/gb\b/g,'')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'')
    .replace(/-+/g,'-');
  if(!slug) throw new Error('modelo sem identidade utilizavel');
  return slug.slice(0,96);
}
function normalizeModel(label) {
  const index=buildKnowledgeIndex(knowledge);
  const field={name:'model',resolver:{kind:'entity',entity_kind:'model',match:['alias','label']}};
  const resolved=resolveEntityCandidate({
    field:'model',
    value:String(label).trim(),
    score:1,
    evidence:{line_number:null}
  },field,index);
  return resolved&&resolved.entity_id
    ? { id:resolved.entity_id, label:resolved.value, attributes:resolved.attributes||{} }
    : { id:fallbackModelId(label), label:String(label).trim(), attributes:{identity_source:'list-advisor-fallback-v0'} };
}
function lineNumbersForExcerpt(content, excerpt) {
  const needle=String(excerpt||'').trim();
  if(!needle) return [];
  const lines=String(content).split(/\r?\n/);
  const exact=[];
  for(let i=0;i<lines.length;i++){
    if(lines[i].includes(needle)||needle.includes(lines[i].trim())&&lines[i].trim()) exact.push(i+1);
  }
  if(exact.length) return [...new Set(exact)];
  const normalizedNeedle=needle.replace(/\s+/g,' ').trim().toLowerCase();
  for(let i=0;i<lines.length;i++){
    const normalizedLine=lines[i].replace(/\s+/g,' ').trim().toLowerCase();
    if(normalizedLine&&normalizedNeedle.includes(normalizedLine)) exact.push(i+1);
  }
  return [...new Set(exact)];
}
function money(amountMinor,currency) {
  if(!Number.isSafeInteger(amountMinor)||amountMinor<=0) throw new Error('price_amount_minor invalido para C01');
  const cur=String(currency||'BRL').toUpperCase();
  if(!/^[A-Z]{3}$/.test(cur)) throw new Error('currency invalida');
  return {amount_minor:amountMinor,currency:cur};
}
function makeTrace(offer, lines) {
  const score=offer.confidence;
  const trace=[
    {field:'model',chosen:offer.model,sources:lines,derived_from:[],rules:['list_advisor:structured_output'],alternatives:[],score},
    {field:'price',chosen:offer.price_amount_minor/100,sources:lines,derived_from:[],rules:['list_advisor:structured_output'],alternatives:[],score}
  ];
  if(Number.isInteger(offer.capacity_gb)) trace.push({field:'capacity_gb',chosen:offer.capacity_gb,sources:lines,derived_from:[],rules:['list_advisor:structured_output'],alternatives:[],score});
  if(offer.color) trace.push({field:'color',chosen:offer.color,sources:lines,derived_from:[],rules:['list_advisor:structured_output'],alternatives:[],score});
  if(offer.condition) trace.push({field:'condition',chosen:offer.condition,sources:lines,derived_from:[],rules:['list_advisor:structured_output'],alternatives:[],score});
  if(offer.variant) trace.push({field:'variant',chosen:offer.variant,sources:lines,derived_from:[],rules:['list_advisor:structured_output'],alternatives:[],score});
  return trace;
}
function bridgeListAdvisorToC01({interpretation,content,analysis_id,source_id,supplier_id}) {
  if(!interpretation||interpretation.contract_version!=='external-calc-list-advisor/v0') throw new Error('List Advisor interpretation v0 obrigatoria');
  if(interpretation.supplier_id!==supplier_id) throw new Error('supplier_id divergente');
  const sourceLines=String(content).split(/\r?\n/);
  const candidates=interpretation.offers.map((offer,index)=>{
    const lines=lineNumbersForExcerpt(content,offer.source_excerpt);
    const model=normalizeModel(offer.model);
    const interpretedOffer={
      supplier_id,
      model,
      capacity_gb:Number.isInteger(offer.capacity_gb)?offer.capacity_gb:null,
      condition:offer.condition||null,
      color:offer.color||null,
      price:money(offer.price_amount_minor,offer.currency)
    };
    const identityFp=hash(JSON.stringify({
      supplier_id,
      model:model.id||model.label,
      capacity_gb:interpretedOffer.capacity_gb,
      condition:interpretedOffer.condition,
      color:interpretedOffer.color,
      variant:offer.variant||null
    }));
    const valueFp=hash(JSON.stringify({...interpretedOffer,variant:offer.variant||null}));
    const offerId=stableId('off',analysis_id,source_id,'advisor',index,identityFp);
    return {
      contract_version:CONTRACT_VERSION,
      analysis_id,
      source_id,
      offer_id:offerId,
      offer_revision:1,
      stage:'REVIEW',
      execution_status:'SUCCEEDED',
      domain_outcome:'REVIEW_REQUIRED',
      freshness_status:'CURRENT',
      interpretation_run_id:'advisor_'+interpretation.input_hash.slice(0,24),
      interpretation_engine_version:ENGINE_VERSION,
      interpretation_confidence:{
        overall:offer.confidence,
        by_field:{
          model:offer.confidence,
          price:offer.confidence,
          ...(Number.isInteger(offer.capacity_gb)?{capacity_gb:offer.confidence}:{}),
          ...(offer.color?{color:offer.confidence}:{}),
          ...(offer.condition?{condition:offer.confidence}:{}),
          ...(offer.variant?{variant:offer.confidence}:{})
        },
        record_state:'AI_STRUCTURED'
      },
      offer_identity_fingerprint:identityFp,
      offer_value_fingerprint:valueFp,
      interpreted_offer:interpretedOffer,
      reviewed_offer:null,
      review:null,
      review_evidence:{
        record_id:'advisor-offer-'+(index+1),
        source_lines:lines.map(n=>({line_number:n,raw:sourceLines[n-1]||''})),
        field_sources:Object.fromEntries(makeTrace(offer,lines).map(t=>[t.field,lines]))
      },
      provenance_refs:[
        'list_advisor:'+ENGINE_VERSION,
        'supplier_context:'+supplier_id,
        'source_excerpt_hash:'+hash(offer.source_excerpt).slice(0,24),
        ...(offer.variant?['supplier_variant:'+offer.variant]:[])
      ],
      trace:makeTrace(offer,lines),
      advisor_variant:offer.variant||null
    };
  });
  const ambiguities=interpretation.ambiguities.map((item,index)=>({
    ambiguity_id:stableId('amb',analysis_id,source_id,index,item.field,item.source_excerpt),
    field:item.field,
    cause:'list_advisor_reported',
    raw:item.source_excerpt,
    reason:item.reason,
    sources:lineNumbersForExcerpt(content,item.source_excerpt)
  }));
  const queue={
    contract_version:CONTRACT_VERSION+'/queue',
    analysis_id,
    source_id,
    interpretation_run_id:'advisor_'+interpretation.input_hash.slice(0,24),
    execution_status:'SUCCEEDED',
    stage:'REVIEW',
    candidates,
    unresolved_ambiguities:ambiguities,
    invalid_items:[],
    warnings:[],
    metrics:{
      interpreter_records:candidates.length,
      review_candidates:candidates.length,
      unresolved_ambiguities:ambiguities.length,
      invalid_items:0
    }
  };
  return {queue,partition:partitionCandidates(queue)};
}

function createPostgresAdvisorC01Sink(options={}) {
  const supabaseUrl=String(options.supabaseUrl||'').replace(/\/+$/,'');
  const anonKey=String(options.anonKey||'');
  const accessToken=String(options.accessToken||'');
  const fetchImpl=options.fetchImpl||globalThis.fetch;
  if(!supabaseUrl||!anonKey||!accessToken||typeof fetchImpl!=='function') throw new Error('C01 sink config invalida');

  async function rpc(name,payload){
    const response=await fetchImpl(supabaseUrl+'/rest/v1/rpc/'+name,{
      method:'POST',
      headers:{apikey:anonKey,authorization:'Bearer '+accessToken,'content-type':'application/json'},
      body:JSON.stringify(payload)
    });
    const data=await response.json().catch(()=>null);
    if(!response.ok) throw new Error(data?.message||name+' failed');
    return data;
  }

  return {
    async persist({interpretation,content,analysis_id,source_id,supplier_id}) {
      const bridged=bridgeListAdvisorToC01({interpretation,content,analysis_id,source_id,supplier_id});
      let persisted=0,auto_promoted=0,review_required=0,idempotent=0;
      for(const item of bridged.partition.auto){
        const a=await rpc('extcalc_persist_review_candidate_v0',{p_candidate:item.candidate});
        persisted+=1;if(a?.idempotent===true)idempotent+=1;
        const b=await rpc('extcalc_persist_auto_promoted_c01_v0',{p_promoted:item.promoted});
        auto_promoted+=1;if(b?.idempotent===true)idempotent+=1;
      }
      for(const item of bridged.partition.review){
        const a=await rpc('extcalc_persist_review_candidate_v0',{p_candidate:item.candidate});
        persisted+=1;review_required+=1;if(a?.idempotent===true)idempotent+=1;
      }
      return {
        analysis_id,source_id,candidates:bridged.queue.candidates.length,
        auto_promoted,review_required,persisted,idempotent,
        unresolved_ambiguities:bridged.queue.unresolved_ambiguities.length
      };
    }
  };
}

module.exports={
  ENGINE_VERSION,
  lineNumbersForExcerpt,
  bridgeListAdvisorToC01,
  createPostgresAdvisorC01Sink
};
