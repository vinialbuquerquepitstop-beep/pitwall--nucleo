-- WM-01/G11 candidate only, NEVER migrate production via this file.
-- Run after G8 shadow schema and RLS policy in an isolated test database.
CREATE TABLE IF NOT EXISTS extcalc_pch_shadow.nonce_ledger (
  tenant_id uuid NOT NULL,
  key_id text NOT NULL CHECK (length(key_id) BETWEEN 3 AND 64),
  nonce text NOT NULL CHECK (nonce ~ '^[0-9a-f]{32}$'),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (key_id, nonce),
  CHECK (expires_at > accepted_at - interval '1 minute')
);
ALTER TABLE extcalc_pch_shadow.nonce_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE extcalc_pch_shadow.nonce_ledger FORCE ROW LEVEL SECURITY;
REVOKE ALL ON extcalc_pch_shadow.nonce_ledger FROM PUBLIC;
GRANT SELECT, INSERT ON extcalc_pch_shadow.nonce_ledger TO extcalc_pch_ingress;
DROP POLICY IF EXISTS nonce_tenant_read ON extcalc_pch_shadow.nonce_ledger;
CREATE POLICY nonce_tenant_read ON extcalc_pch_shadow.nonce_ledger
  FOR SELECT TO extcalc_pch_ingress
  USING (tenant_id = nullif(current_setting('app.pch_tenant_id',true),'')::uuid);
DROP POLICY IF EXISTS nonce_tenant_insert ON extcalc_pch_shadow.nonce_ledger;
CREATE POLICY nonce_tenant_insert ON extcalc_pch_shadow.nonce_ledger
  FOR INSERT TO extcalc_pch_ingress
  WITH CHECK (tenant_id = nullif(current_setting('app.pch_tenant_id',true),'')::uuid);
-- No UPDATE or DELETE for ingest role. Expiration is retention metadata,
-- NOT an implicit permission to reuse an old nonce; cleanup separate.
-- A trusted keyring must globally bind each key ID to exactly one tenant.
