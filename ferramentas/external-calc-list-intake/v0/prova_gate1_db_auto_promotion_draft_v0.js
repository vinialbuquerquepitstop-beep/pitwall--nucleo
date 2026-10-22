'use strict';
// GATE 1: structural smoke test ONLY, not a PostgreSQL parser or integration test.
// Never connects to Supabase, never authenticates, never mutates a database.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const candidate=path.join(__dirname,'GATE1_DB_AUTO_PROMOTION_GUARD_DRAFT.sql');

function count(source,expression){return [...source.matchAll(expression)].length;}
function audit(sql){
  assert.match(sql,/^-- DRAFT ONLY\. DO NOT DEPLOY TO PRODUCTION\./);
  assert.equal(count(sql,/\bCREATE OR REPLACE FUNCTION public\.extcalc_persist_auto_promoted_c01_v0\b/g),1);
  assert.equal(count(sql,/\$function\$/g),2,'exactly one complete function body');
  assert.match(sql,/\$function\$\s*$/,'no executable debris after end of function');
  assert.equal(count(sql,/\bbegin\b/gi),1,'exactly one top-level PL/pgSQL begin');
  assert.equal(count(sql,/\nend;\n\$function\$/g),1);
  for(const target of [
    /insert into public\.extcalc_analysis\(/g,
    /insert into public\.extcalc_offer\(/g,
    /insert into public\.extcalc_offer_revision\(/g
  ]) assert.equal(count(sql,target),1,'no duplicated persistence statements');
  const codes=[
    'SOURCE_UNBOUND','CANDIDATE_MISSING','SOURCE_CONFLICT',
    'CANDIDATE_MISMATCH','SUPPLIER_MISMATCH','SOURCE_EVIDENCE_MISSING',
    'SOURCE_EVIDENCE_MISMATCH'
  ];
  const firstWrite=sql.indexOf('  insert into public.extcalc_analysis(');
  assert(firstWrite>0,'write anchor must exist');
  for(const code of codes){
    const marker='EXTCALC_AUTO_PROMOTION_'+code;
    const pos=sql.indexOf(marker);
    assert(pos>0&&pos<firstWrite,marker+' must be checked before any writes');
  }
  assert.match(sql,/from public\.extcalc_source_supplier ss[\s\S]*?ss\.tenant_id=v_tenant and ss\.source_id=v_source_id/);
  assert.match(sql,/from public\.extcalc_review_candidate c[\s\S]*?c\.tenant_id=v_tenant[\s\S]*?c\.analysis_id=v_analysis_id/);
  assert.match(sql,/v_candidate->'interpreted_offer' is distinct from p_promoted->'reviewed_offer'/);
  assert.match(sql,/v_sources := v_candidate#>array\['review_evidence','field_sources',v_field_name\]/);
  assert.match(sql,/pg_catalog\.jsonb_array_elements_text\(v_sources\)/);
  assert.match(sql,/if auth\.uid\(\) is null then/);
  assert.match(sql,/v_papel is distinct from 'dono'/);
  // Catches a specific JS String.replace hazard: "$'" inside SQL regex
  // must remain literal and the subsequent body must remain intact.
  assert.match(sql,/\{12\}\$'/);
  assert.match(sql,/raise exception 'EXTCALC_AUTO_PROMOTION_SUPPLIER_MISMATCH';/);
  return true;
}
const sql=fs.readFileSync(candidate,'utf8');
assert.equal(audit(sql),true);
// Negative mutation probes ensure this test rejects the previously corrupted file.
assert.throws(()=>audit(sql+'\nend;\n$function$\n'));
assert.throws(()=>audit(sql.replace("raise exception 'EXTCALC_AUTO_PROMOTION_SOURCE_UNBOUND';",'-- removed guard')));
assert.throws(()=>audit(sql.replace("  insert into public.extcalc_offer_revision(",
 "  insert into public.extcalc_offer_revision(\n  insert into public.extcalc_offer_revision(")));
assert.throws(()=>audit(sql.slice(0,sql.indexOf("EXTCALC_AUTO_PROMOTION_SUPPLIER_MISMATCH"))));
console.log('EXTERNAL_CALC_GATE1_DB_GUARD_STRUCTURAL_V0=PASS');
