'use strict';
// Integration proof: actual TXT/Advisor C01 mapping -> isolated PostgreSQL RPC.
// Generates synthetic SQL fixtures ONLY; no production or private supplier data.
const assert=require('node:assert/strict');
const {buildQueue}=require('./list-intake-api');
const {partitionCandidates}=require('./auto-promotion-authority');
const {bridgeListAdvisorToC01}=require('../../external-calc-list-advisor/v0/list-advisor-c01-bridge');

const tenant='22222222-2222-4222-8222-222222222222';
const supplier='33333333-3333-4333-8333-333333333333';
const cases=[];
const txt=['FORNECEDOR TESTE — ATACADO','iPhone 15 128GB','🎨 Preto','💵 R$ 4.500,00'].join('\n');
const built=buildQueue({filename:'fixture-e2e.txt',mime_type:'text/plain',content:txt,supplier_id:supplier});
const normal=partitionCandidates(built.queue,{supplierVerified:true});
assert.equal(normal.auto.length,1,'TXT baseline must be auto-eligible');
assert.equal(normal.review.length,0,'TXT baseline should need no review');
cases.push({kind:'TXT_ZIP_SHARED',source_id:built.source_id,
  candidate:normal.auto[0].candidate,promoted:normal.auto[0].promoted});

const advisorSource='17 pro 256gb\nBlue Anatel $ 6.900';
const advisorInterpretation={
  contract_version:'external-calc-list-advisor/v0',
  supplier_id:supplier,supplier_name:'Fornecedor Teste',
  input_hash:'a'.repeat(64),context_fingerprint:'b'.repeat(64),
  offers:[{
    model:'iPhone 17 Pro',capacity_gb:256,color:'Blue',
    condition:'LACRADO',variant:'Anatel',
    price_amount_minor:690000,currency:'BRL',
    confidence:0.99,source_excerpt:'Blue Anatel $ 6.900'
  }],
  ambiguities:[]
};
const advisor=bridgeListAdvisorToC01({
  interpretation:advisorInterpretation,content:advisorSource,
  analysis_id:'analysis_bridge_advisor',source_id:'source_bridge_advisor',supplier_id:supplier
});
assert.equal(advisor.partition.auto.length,1,'Advisor baseline must be auto-eligible');
assert.equal(advisor.partition.review.length,0,'Advisor baseline should need no review');
cases.push({kind:'ADVISOR',source_id:'source_bridge_advisor',
  candidate:advisor.partition.auto[0].candidate,promoted:advisor.partition.auto[0].promoted});
function q(s){return "'"+String(s).replace(/'/g,"''")+"'";}
for(const item of cases){
  const c=item.candidate,p=item.promoted;
  assert.equal(c.contract_version,'external-calc-c01-readonly/v1');
  assert.equal(c.domain_outcome,'REVIEW_REQUIRED');
  assert.equal(p.domain_outcome,'VALID');
  assert.deepEqual(p.reviewed_offer,c.interpreted_offer);
  assert.equal(c.source_id,item.source_id);
  for(const key of ['model','price']){
    assert(c.review_evidence.field_sources[key]?.length>0,item.kind+': '+key+' trace missing');
  }
  const analysis=q(c.analysis_id),source=q(c.source_id),offer=q(c.offer_id);
  const rawCandidate=q(JSON.stringify(c)),rawPromoted=q(JSON.stringify(p));
  const lines=[
    '-- '+item.kind+' — generated from production C01 bridge',
    'INSERT INTO public.extcalc_source_supplier(tenant_id,source_id,supplier_id) VALUES ('+
      q(tenant)+'::uuid,'+source+','+q(supplier)+'::uuid);',
    'INSERT INTO public.extcalc_offer(tenant_id,analysis_id,offer_id,source_id) VALUES ('+
      q(tenant)+'::uuid,'+analysis+','+offer+','+source+');',
    'INSERT INTO public.extcalc_review_candidate(tenant_id,analysis_id,offer_id,offer_revision,candidate_snapshot) VALUES ('+
      q(tenant)+'::uuid,'+analysis+','+offer+','+c.offer_revision+','+rawCandidate+'::jsonb);',
    'DO $gate1_real_bridge$',
    'DECLARE receipt jsonb; promoted jsonb:='+rawPromoted+'::jsonb;',
    'BEGIN',
    ' receipt:=public.extcalc_persist_auto_promoted_c01_v0(promoted);',
    " IF receipt->>'ok' IS DISTINCT FROM 'true' OR receipt->>'idempotent' IS DISTINCT FROM 'false' THEN",
    "  RAISE EXCEPTION '"+item.kind+" first persist failed: %',receipt;",
    ' END IF;',
    ' receipt:=public.extcalc_persist_auto_promoted_c01_v0(promoted);',
    " IF receipt->>'ok' IS DISTINCT FROM 'true' OR receipt->>'idempotent' IS DISTINCT FROM 'true' THEN",
    "  RAISE EXCEPTION '"+item.kind+" idempotent retry failed: %',receipt;",
    ' END IF;',
    ' IF NOT EXISTS (SELECT 1 FROM public.extcalc_offer_revision WHERE tenant_id='+
      q(tenant)+'::uuid AND analysis_id='+analysis+' AND offer_id='+offer+
      ' AND offer_revision='+c.offer_revision+') THEN',
    "  RAISE EXCEPTION '"+item.kind+" C01 revision not persisted';",
    ' END IF;',
    " RAISE NOTICE 'GATE1_REAL_BRIDGE_"+item.kind+"=PASS';",
    'END;',
    '$gate1_real_bridge$;',
    ''
  ];
  process.stdout.write(lines.join('\n')+'\n');
}
process.stdout.write("SELECT 'EXTERNAL_CALC_GATE1_REAL_BRIDGE_DB_V0=PASS' AS result;\n");
