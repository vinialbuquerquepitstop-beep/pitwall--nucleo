'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const migration = fs.readFileSync(
  path.join(
    __dirname,
    '../../../supabase/migrations/20260922194500_external_calc_human_review_learning_capture_v0.sql'
  ),
  'utf8'
).toLowerCase();

for (const required of [
  'create table if not exists public.extcalc_learning_candidate',
  "proposal_status in ('proposed','approved','rejected','promoted')",
  'create or replace function privado.extcalc_capture_learning_candidate_v0()',
  "if new.decision is distinct from 'edit'",
  "foreach v_field in array array['model','capacity_gb','condition','color','price']",
  "v_before is distinct from v_after",
  "'review_evidence'",
  "'trace'",
  "'provenance_refs'",
  "'proposed'",
  'after insert on public.extcalc_human_review',
  'execute function privado.extcalc_capture_learning_candidate_v0()',
  'grant select on public.extcalc_learning_candidate to authenticated'
]) {
  assert.ok(migration.includes(required), `migration sem: ${required}`);
}

for (const forbidden of [
  'update ferramentas/interpreter',
  'service_role',
  'applyhumanreview',
  'calculatec02(',
  'runc03research(',
  'runc04priceindicator(',
  'composedecisionoutput(',
  "proposal_status = 'promoted'",
  'update public.extcalc_review_candidate',
  'delete from public.extcalc_review_candidate'
]) {
  assert.strictEqual(
    migration.includes(forbidden),
    false,
    `capture nao pode executar/promover regra: ${forbidden}`
  );
}

assert.ok(
  migration.includes("v_candidate->'interpreted_offer'->v_field"),
  'before_value precisa vir do candidate original'
);
assert.ok(
  migration.includes("v_reviewed->'reviewed_offer'->v_field"),
  'after_value precisa vir do C01 final'
);
assert.ok(
  migration.includes('on conflict (tenant_id, review_id, field) do nothing'),
  'capture precisa ser idempotente'
);
assert.ok(
  migration.includes('return new;'),
  'trigger precisa preservar a revisao operacional'
);

console.log('HUMAN_REVIEW_LEARNING_CAPTURE_V0=PASS');
