#!/usr/bin/env node
// STATIC verification only. Does not prove DB behavior, Auth or HTTP.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('.',import.meta.url);
const ddl = readFileSync(new URL('VS53L_C01_STAGING_FOUNDATION_CANDIDATE.sql',root),'utf8');
const proof = readFileSync(new URL('VS53L_C01_STAGING_PROOF_ROLLBACK.sql',root),'utf8');
const atomic = readFileSync(new URL('assemble-vs53l-phase2-atomic.mjs',root),'utf8');
assert.ok(atomic.includes('bddff79482488ef548ccb2c5c7b43491c57ec805'),'phase2 must pin exact PR179 guard');
assert.ok(atomic.includes('REVOKE ALL ON FUNCTION')&&atomic.includes('GRANT EXECUTE ON FUNCTION'),'phase2 must atomically tighten grants');
assert.ok(atomic.includes("'BEGIN;'")&&atomic.includes("'COMMIT;'"),'phase2 must be transactional');
const all=['extcalc_supplier','extcalc_source_supplier','extcalc_analysis','extcalc_offer','extcalc_review_candidate','extcalc_offer_revision'];
function validate(s,p){
 for(const n of all){
  assert.match(s,new RegExp(`create table public\\.${n}\\s*\\(`,'i'));
  assert.match(s,new RegExp(`alter table public\\.${n} force row level security`,'i'));
 }
 for(const fn of ['fn_tenant_atual','fn_papel_atual'])assert.match(s,new RegExp(`create function privado\\.${fn}\\(`,'i'));
 assert.match(s,/m\.user_id\s*=\s*auth\.uid\(\)/i);
 assert.match(s,/m\.tenant_id\s*=\s*public\.%I\.tenant_id/i);
 assert.match(s,/content_bytes/);
 assert.match(s,/C01_STAGING_LINE_NOT_IN_ORIGINAL/);
 assert.match(s,/C01_STAGING_PRICE_UNVERIFIED/);
 assert.match(s,/C01_STAGING_MODEL_IDENTITY_UNVERIFIED/);
 assert.match(s,/C01_STAGING_COLOR_UNVERIFIED/);
 assert.match(s,/C01_STAGING_COLOR_PROVENANCE_UNVERIFIED/);
 assert.match(s,/C01_STAGING_COLOR_SCOPE_AMBIGUOUS/);
 assert.ok(s.includes("coalesce((p_candidate#>>'{interpreted_offer,capacity_gb}') ~"),'capacity must explicitly reject SQL NULL');
 assert.ok(s.includes("~ '^[1-9][0-9]{0,3}$',false) is false"),'capacity regex delimiter/terminator must be intact');
 assert.equal((s.match(/^\s*create function\b/gim)||[]).length,6,'unexpected duplicate/missing SQL functions');
 assert.equal((s.match(/^\s*create trigger\b/gim)||[]).length,2,'unexpected duplicate/missing SQL triggers');
 assert.equal((s.match(/^\s*commit;\s*$/gim)||[]).length,1,'SQL transaction must commit exactly once');
 assert.ok(p.includes("'color',pg_catalog.jsonb_build_array(2)"),'positive fixture must carry color provenance');
 for(const check of ['NEGATIVE_WRONG_COLOR_NOT_BLOCKED','NEGATIVE_COLOR_LINE_MISSING_NOT_BLOCKED'])
   assert.ok(p.includes(check),`missing ${check}`);
 assert.match(s,/\[\^\[:alnum:\]\]\+/);
 assert.match(s,/interpreted_offer,capacity_gb/);
 for(const check of ['NEGATIVE_MODEL_ID_SPOOF_NOT_BLOCKED','NEGATIVE_MISSING_CAPACITY_NOT_BLOCKED'])
   assert.ok(p.includes(check),`missing ${check}`);
 assert.match(s,/C01_STAGING_SUPPLIER_MISMATCH/);
 assert.match(s,/C01_STAGING_SOURCE_UNAVAILABLE/);
 assert.match(s,/jsonb_array_length\(refs\)<>1/);
 assert.match(s,/capacity_gb/);
 assert.match(s,/revoke all on table public\.%I from public, anon, authenticated/);
 assert.match(s,/grant select\(tenant_id,analysis_id,offer_id,offer_revision\) on public\.extcalc_offer_revision/i);
 assert.doesNotMatch(s,/grant\s+(?:all|insert|update|delete)\s+on\s+(?:table\s+)?public\.(?:extcalc_\w+)\s+to\s+authenticated/i);
 assert.doesNotMatch(s,/pg_catalog\.coalesce|pg_catalog\.position\s*\(/i);
 assert.doesNotMatch(s,/insert\s+into\s+auth\.users|grant\s+all\s+to\s+authenticated|service_role|bypassrls/i);
 assert.match(p,/^BEGIN;/m);
 assert.match(p,/ROLLBACK;\s*$/m);
 for(const neg of ['NEGATIVE_SUPPLIER_NOT_BLOCKED','NEGATIVE_QUARANTINE_NOT_BLOCKED','NEGATIVE_CANDIDATE_ABSENT_NOT_BLOCKED','NEGATIVE_FORGED_LINE_NOT_BLOCKED','NEGATIVE_FORGED_PRICE_NOT_BLOCKED','NEGATIVE_MODEL_PREFIX_NOT_BLOCKED','NEGATIVE_CROSS_TENANT_PROMOTION_NOT_BLOCKED'])assert.ok(p.includes(neg),`missing ${neg}`);
 return true;
}
validate(ddl,proof);
const broken=ddl.replace('and m.tenant_id = public.%I.tenant_id','and m.tenant_id = m.tenant_id');
assert.throws(()=>validate(broken,proof));
const noHash=ddl.replace('C01_STAGING_LINE_NOT_IN_ORIGINAL','C01_STAGING_NO_LINE_CHECK');
assert.throws(()=>validate(noHash,proof));
const noModel=ddl.replace('C01_STAGING_MODEL_IDENTITY_UNVERIFIED','C01_STAGING_MODEL_ID_SPOOF_ALLOWED');
assert.throws(()=>validate(noModel,proof));
const noColor=ddl.replace('C01_STAGING_COLOR_UNVERIFIED','C01_STAGING_COLOR_ACCEPT_ANY');
assert.throws(()=>validate(noColor,proof));
const noCapacityNullGuard=ddl.replace("coalesce((p_candidate#>>'{interpreted_offer,capacity_gb}') ~","((p_candidate#>>'{interpreted_offer,capacity_gb}') ~");
assert.throws(()=>validate(noCapacityNullGuard,proof));
const truncatedRegex=ddl.replace("~ '^[1-9][0-9]{0,3}$',false) is false","~ '^[1-9][0-9]{0,3}");
assert.throws(()=>validate(truncatedRegex,proof));
const noRollback=proof.replace(/ROLLBACK;\s*$/,'COMMIT;');
assert.throws(()=>validate(ddl,noRollback));
console.log('VS53L_STATIC=PASS six tables/RLS, source provenance, privileges, rollback, seven negative mutations, SQL truncation/duplication protection, atomic guard grant');
console.log('VS53L_REAL_POSTGRES=NOT_RUN VS53L_REAL_SIGNED_JWT=NOT_RUN');
