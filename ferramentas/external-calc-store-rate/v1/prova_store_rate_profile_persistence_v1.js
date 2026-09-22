'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const migration = fs.readFileSync(
  path.join(
    __dirname,
    '../../../supabase/migrations/20260922233000_external_calc_store_rate_profile_correction_v1.sql'
  ),
  'utf8'
).toLowerCase();

for (const required of [
  'extcalc_store_rate_profiles',
  'extcalc_store_rate_profile_entries',
  'unique (tenant_id, version)',
  "where status = 'active'",
  'created_by            uuid not null references public.app_usuario(id)',
  "v_role is distinct from 'dono'",
  'where p.tenant_id = v_tenant',
  'extcalc_replace_store_rate_profile_v1',
  'from public.tenant t',
  'for update',
  'extcalc_store_rate_profile_conflict',
  'tenant_id = privado.fn_tenant_atual()',
  'privado.fn_extcalc_beta_operador_v0()',
  'extcalc_store_rate_profile_immutable',
  'extcalc_store_rate_profile_entry_immutable',
  'drop function if exists public.extcalc_replace_my_rate_profile_v1',
  'drop table if exists public.extcalc_user_rate_profile_entries',
  'drop table if exists public.extcalc_user_rate_profiles',
  'extcalc_user_rate_profile_correction_requires_data_migration'
]) {
  assert.ok(migration.includes(required), `migration sem: ${required}`);
}

for (const forbidden of [
  'p_user_id',
  'p_tenant_id',
  'service_role',
  'extcalc_learning_candidate',
  'calculatec02(',
  'total_amount_minor',
  'installment_amount_minor'
]) {
  assert.strictEqual(
    migration.includes(forbidden),
    false,
    `G2 corrigido nao pode introduzir authority/calculo/learning: ${forbidden}`
  );
}

assert.strictEqual(
  /unique\s*\(user_id,\s*version\)/.test(migration),
  false,
  'versionamento nao pode continuar por usuario'
);

assert.strictEqual(
  /where\s+p\.user_id\s*=/.test(migration),
  false,
  'resolver/persistencia nao pode selecionar perfil por usuario'
);

assert.ok(
  migration.includes("'perfil versionado de taxas da loja"),
  'ownership precisa estar documentado como loja'
);

assert.ok(
  migration.includes('v_actor') && migration.includes('created_by'),
  'dono que alterou deve permanecer auditavel sem virar owner do perfil'
);

console.log('EXTERNAL_CALC_STORE_RATE_PROFILE_PERSISTENCE_G2=PASS');
