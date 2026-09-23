'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const migration = fs.readFileSync(
  path.join(
    __dirname,
    '../../../supabase/migrations/20260923052000_external_calc_store_trade_in_policy_v0.sql'
  ),
  'utf8'
).toLowerCase();

for (const required of [
  'extcalc_store_trade_in_policies',
  'unique (tenant_id, version)',
  "where status = 'active'",
  'deduction_amount_minor  bigint not null check (deduction_amount_minor >= 0)',
  "v_role is distinct from 'dono'",
  'where p.tenant_id = v_tenant',
  'for update',
  'extcalc_trade_in_policy_conflict',
  'tenant_id = privado.fn_tenant_atual()',
  'privado.fn_extcalc_beta_operador_v0()',
  'extcalc_trade_in_policy_immutable',
  'extcalc_replace_store_trade_in_policy_v0',
  'seller never chooses tenant',
  'future trusted trade-in estimate resolver'
]) {
  assert.ok(migration.includes(required), `migration sem: ${required}`);
}

for (const forbidden of [
  'p_user_id',
  'p_tenant_id',
  'p_policy_id',
  'p_policy_version',
  'p_seller_id',
  'service_role',
  'extcalc_learning_candidate',
  'calculatec02(',
  'estimated_credit',
  'lowest_eligible_offer'
]) {
  assert.strictEqual(
    migration.includes(forbidden),
    false,
    `T03 nao pode introduzir authority/calculo/learning: ${forbidden}`
  );
}

assert.strictEqual(
  /unique\s*\(user_id,\s*version\)/.test(migration),
  false,
  'versionamento nao pode ser por usuario'
);

assert.strictEqual(
  /where\s+p\.user_id\s*=/.test(migration),
  false,
  'politica ativa nao pode ser selecionada por usuario'
);

assert.ok(
  migration.includes('pertence ao tenant/loja'),
  'ownership precisa estar documentado como loja'
);

assert.ok(
  migration.includes('v_actor') && migration.includes('created_by'),
  'ator deve permanecer auditavel sem virar owner da politica'
);

console.log('EXTERNAL_CALC_STORE_TRADE_IN_POLICY_T03=PASS');
