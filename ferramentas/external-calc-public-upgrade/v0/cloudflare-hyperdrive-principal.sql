-- Pitstop Upgrade V1: private Cloudflare Hyperdrive identity, initially disabled.
-- This role MUST NOT receive a password in code or chat.
-- Only enable login after storing a unique password directly in Supabase SQL Editor
-- and registering the connection privately in Cloudflare Hyperdrive.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='upv1_cf_public') THEN
  CREATE ROLE upv1_cf_public NOLOGIN NOINHERIT NOBYPASSRLS;
 END IF;
END $$;
GRANT USAGE ON SCHEMA privado TO upv1_cf_public;
GRANT SELECT(tenant_id,public_id,price_revision,status,expires_at_ms,approved_at,approved_by,revoked_at)
 ON privado.extcalc_upgrade_publications_v0 TO upv1_cf_public;
GRANT SELECT(tenant_id,public_id,price_revision,desired_model,desired_capacity,desired_condition,trade_in_models)
 ON privado.extcalc_upgrade_public_catalog_v1 TO upv1_cf_public;
GRANT INSERT(tenant_id,request_key,customer_name,whatsapp_digits,selection,consent_at,source)
 ON privado.upgrade_requests_v1 TO upv1_cf_public;
GRANT SELECT(id,tenant_id,request_key,customer_name,whatsapp_digits,selection,source)
 ON privado.upgrade_requests_v1 TO upv1_cf_public;

CREATE POLICY upv1_cf_publication_read ON privado.extcalc_upgrade_publications_v0
 FOR SELECT TO upv1_cf_public USING (
  tenant_id='00000000-0000-0000-0000-000000000001'::uuid
  AND status='published' AND approved_at IS NOT NULL AND approved_by IS NOT NULL
  AND revoked_at IS NULL AND expires_at_ms>(extract(epoch FROM clock_timestamp())*1000)::bigint
 );
CREATE POLICY upv1_cf_catalog_read ON privado.extcalc_upgrade_public_catalog_v1
 FOR SELECT TO upv1_cf_public USING (tenant_id='00000000-0000-0000-0000-000000000001'::uuid);
CREATE POLICY upv1_cf_capture_insert ON privado.upgrade_requests_v1
 FOR INSERT TO upv1_cf_public WITH CHECK (
  tenant_id='00000000-0000-0000-0000-000000000001'::uuid
  AND status='RECEIVED' AND lead_id IS NULL
 );
CREATE POLICY upv1_cf_capture_recheck ON privado.upgrade_requests_v1
 FOR SELECT TO upv1_cf_public USING (tenant_id='00000000-0000-0000-0000-000000000001'::uuid);

-- No LOGIN; no password; no grants to anon, authenticated or service_role.
