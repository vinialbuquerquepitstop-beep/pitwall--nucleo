#!/usr/bin/env node
// STATIC verification only. Does not prove DB behavior, Auth or HTTP.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('.',import.meta.url);
const ddl = readFileSync(new URL('VS53L_C01_STAGING_FOUNDATION_CANDIDATE.sql',root),'utf8');
const proof = readFileSync(new URL('VS53L_C01_STAGING_PROOF_ROLLBACK.sql',root),'utf8');
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
const noRollback=proof.replace(/ROLLBACK;\s*$/,'COMMIT;');
assert.throws(()=>validate(ddl,noRollback));
console.log('VS53L_STATIC=PASS six tables/RLS, source provenance, privileges, rollback, three negative mutations');
console.log('VS53L_REAL_POSTGRES=NOT_RUN VS53L_REAL_SIGNED_JWT=NOT_RUN');
