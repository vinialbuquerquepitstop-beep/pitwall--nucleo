'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const migration = fs.readFileSync(
  path.join(
    __dirname,
    '../../../supabase/migrations/20260922230000_external_calc_user_rate_profile_persistence_v1.sql'
  ),
  'utf8'
).toLowerCase();

for (const required of [
  'create table if not exists public.extcalc_user_rate_profiles',
  'create table if not exists public.extcalc_user_rate_profile_entries',
  'user_id               uuid not null references public.app_usuario(id)',
  "status in ('active', 'archived')",
  'unique (user_id, version)',
  "where status = 'active'",
  'installment_count between 1 and 18',
  'rate_units         bigint not null check (rate_units >= 0)',
  'enable row level security',
  'extcalc_user_rate_profiles_own_sel',
  'extcalc_user_rate_profile_entries_own_sel',
  'user_id = auth.uid()',
  'tenant_id = privado.fn_tenant_atual()',
  'privado.fn_extcalc_beta_operador_v0()',
  'create or replace function public.extcalc_replace_my_rate_profile_v1',
  'v_user := auth.uid()',
  "not in ('dono', 'validador')",
  'for update',
  'p_expected_active_version',
  'extcalc_rate_profile_conflict',
  "set status = 'archived'",
  "'active'",
  "public.digest(",
  "'sha256'",
  'extcalc_rate_profile_immutable',
  'extcalc_rate_profile_entry_immutable',
  'revoke all on public.extcalc_user_rate_profiles',
  'revoke all on public.extcalc_user_rate_profile_entries',
  'grant select on public.extcalc_user_rate_profiles',
  'grant select on public.extcalc_user_rate_profile_entries'
]) {
  assert.ok(migration.includes(required), `migration sem: ${required}`);
}

for (const forbidden of [
  'p_user_id',
  'p_profile_id',
  'service_role',
  'calc_dados',
  'extcalc_learning_candidate',
  'update ferramentas/interpreter',
  'calculatec02(',
  'installment_amount_minor',
  'total_amount_minor'
]) {
  assert.strictEqual(
    migration.includes(forbidden),
    false,
    `G2 nao pode introduzir authority/calculo/learning: ${forbidden}`
  );
}

assert.ok(
  migration.includes("old.status is distinct from 'active'") &&
  migration.includes("new.status is distinct from 'archived'"),
  'profile ativado so pode transicionar ACTIVE -> ARCHIVED'
);

assert.ok(
  migration.includes('old.rate_scale is distinct from new.rate_scale') &&
  migration.includes('old.fingerprint is distinct from new.fingerprint'),
  'conteudo de versao ativada precisa permanecer imutavel'
);

assert.ok(
  migration.includes("if v_installment = any(v_seen)") &&
  migration.includes('extcalc_rate_profile_entry_duplicate'),
  'installment_count precisa ser unico dentro do profile'
);

assert.ok(
  migration.includes("p_expected_active_version is distinct from v_active_version"),
  'ativacao concorrente precisa exigir versao esperada'
);

assert.ok(
  migration.includes("if v_active_fingerprint = v_fingerprint"),
  'reescrita identica deve ser idempotente'
);

assert.ok(
  migration.includes('references public.app_usuario(id)'),
  'profile deve estar ligado a membership real'
);

console.log('EXTERNAL_CALC_USER_RATE_PROFILE_PERSISTENCE_G2=PASS');
