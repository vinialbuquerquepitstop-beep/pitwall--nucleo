'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const migration = fs.readFileSync(
  path.join(__dirname, '../../../supabase/migrations/20260922213000_external_calc_beta_store_team_access_v0.sql'),
  'utf8'
).toLowerCase();

for (const required of [
  "'validador'::text",
  "fn_extcalc_beta_operador_v0",
  "in ('dono', 'validador')",
  "extcalc_create_beta_validator_invite_v0",
  "extcalc_claim_beta_invite_v0",
  "extcalc_revoke_beta_invite_v0",
  "digest(v_token, 'sha256')",
  "gen_random_bytes(32)",
  "auth.jwt()->>'email'",
  "extcalc_beta_invite_email_mismatch",
  "extcalc_membership_conflict",
  "papel', 'validador'",
  "privado.fn_tenant_atual()"
]) {
  assert.ok(migration.includes(required), `migration sem: ${required}`);
}

assert.ok(
  migration.includes("check (papel = any (array['dono'::text, 'vendedor'::text, 'validador'::text]))"),
  'papel vendedor deve continuar representavel'
);

assert.strictEqual(
  /in \('dono', 'vendedor'\)/.test(migration),
  false,
  'vendedor de producao nao pode ganhar acesso beta privilegiado'
);

assert.ok(
  migration.includes("privado.fn_papel_atual() = 'dono'"),
  'criacao/revogacao de convite deve continuar owner-only'
);

assert.strictEqual(
  migration.includes('service_role'),
  false,
  'migration/browser flow nao pode depender de service_role'
);

assert.ok(
  migration.includes("lower(v_invite.email) is distinct from v_email"),
  'claim precisa vincular exatamente o email convidado'
);

assert.ok(
  migration.includes("claimed_by = auth.uid()"),
  'claim precisa ser auditavel por usuario'
);

console.log('EXTERNAL_CALC_BETA_STORE_TEAM_ACCESS_V0=PASS');
