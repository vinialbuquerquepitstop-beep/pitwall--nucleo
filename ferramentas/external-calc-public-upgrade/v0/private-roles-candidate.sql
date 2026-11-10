-- Pitstop Upgrade V1: scoped DB roles and RLS policies.
-- Authorized installation; do not grant these NOLOGIN roles to anon,
-- authenticated, service_role, postgres clients or any public app.
-- Tenant is sourced from the live External Calc publication/active policy preflight.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='upv1_catalog_reader') THEN CREATE ROLE upv1_catalog_reader NOLOGIN NOINHERIT NOBYPASSRLS; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='upv1_private_calc_reader') THEN CREATE ROLE upv1_private_calc_reader NOLOGIN NOINHERIT NOBYPASSRLS; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='upv1_capture_writer') THEN CREATE ROLE upv1_capture_writer NOLOGIN NOINHERIT NOBYPASSRLS; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='upv1_nonce_writer') THEN CREATE ROLE upv1_nonce_writer NOLOGIN NOINHERIT NOBYPASSRLS; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='upv1_crm_linker') THEN CREATE ROLE upv1_crm_linker NOLOGIN NOINHERIT NOBYPASSRLS; END IF;
END $$;
GRANT USAGE ON SCHEMA privado TO upv1_catalog_reader,upv1_private_calc_reader,upv1_capture_writer,upv1_nonce_writer,upv1_crm_linker;

GRANT SELECT ON privado.extcalc_upgrade_publications_v0 TO upv1_catalog_reader,upv1_private_calc_reader;
GRANT SELECT ON privado.extcalc_upgrade_public_catalog_v1 TO upv1_catalog_reader;
GRANT SELECT ON privado.extcalc_upgrade_context_v0 TO upv1_private_calc_reader;

GRANT INSERT(tenant_id,request_key,customer_name,whatsapp_digits,selection,consent_at,source)
 ON privado.upgrade_requests_v1 TO upv1_capture_writer;
GRANT SELECT(id,tenant_id,request_key,customer_name,whatsapp_digits,selection,source)
 ON privado.upgrade_requests_v1 TO upv1_capture_writer;
GRANT SELECT(id,tenant_id,customer_name,whatsapp_digits,selection,consent_at,source,status,lead_id)
 ON privado.upgrade_requests_v1 TO upv1_crm_linker;
GRANT UPDATE(status,lead_id,updated_at) ON privado.upgrade_requests_v1 TO upv1_crm_linker;

GRANT INSERT(nonce_digest,tenant_id,expires_at) ON privado.extcalc_upgrade_nonce_ledger_v0 TO upv1_nonce_writer;
GRANT SELECT(nonce_digest,tenant_id) ON privado.extcalc_upgrade_nonce_ledger_v0 TO upv1_nonce_writer;

CREATE POLICY upv1_publications_catalog_read ON privado.extcalc_upgrade_publications_v0
 FOR SELECT TO upv1_catalog_reader USING (
  tenant_id='00000000-0000-0000-0000-000000000001'::uuid AND status='published'
  AND approved_at IS NOT NULL AND approved_by IS NOT NULL
  AND revoked_at IS NULL AND expires_at_ms > (extract(epoch FROM clock_timestamp())*1000)::bigint
 );
CREATE POLICY upv1_publications_calc_read ON privado.extcalc_upgrade_publications_v0
 FOR SELECT TO upv1_private_calc_reader USING (
  tenant_id='00000000-0000-0000-0000-000000000001'::uuid AND status='published'
  AND approved_at IS NOT NULL AND approved_by IS NOT NULL
  AND revoked_at IS NULL AND expires_at_ms > (extract(epoch FROM clock_timestamp())*1000)::bigint
 );
CREATE POLICY upv1_catalog_read ON privado.extcalc_upgrade_public_catalog_v1
 FOR SELECT TO upv1_catalog_reader
 USING (tenant_id='00000000-0000-0000-0000-000000000001'::uuid);
CREATE POLICY upv1_calc_context_read ON privado.extcalc_upgrade_context_v0
 FOR SELECT TO upv1_private_calc_reader
 USING (tenant_id='00000000-0000-0000-0000-000000000001'::uuid);
CREATE POLICY upv1_capture_insert ON privado.upgrade_requests_v1
 FOR INSERT TO upv1_capture_writer
 WITH CHECK (tenant_id='00000000-0000-0000-0000-000000000001'::uuid
 AND status='RECEIVED' AND lead_id IS NULL);
CREATE POLICY upv1_capture_recheck ON privado.upgrade_requests_v1
 FOR SELECT TO upv1_capture_writer
 USING (tenant_id='00000000-0000-0000-0000-000000000001'::uuid);
CREATE POLICY upv1_crm_read ON privado.upgrade_requests_v1
 FOR SELECT TO upv1_crm_linker
 USING (tenant_id='00000000-0000-0000-0000-000000000001'::uuid);
CREATE POLICY upv1_crm_link ON privado.upgrade_requests_v1
 FOR UPDATE TO upv1_crm_linker
 USING (tenant_id='00000000-0000-0000-0000-000000000001'::uuid AND status='RECEIVED' AND lead_id IS NULL)
 WITH CHECK (tenant_id='00000000-0000-0000-0000-000000000001'::uuid AND status='LINKED' AND lead_id IS NOT NULL);
CREATE POLICY upv1_nonce_insert ON privado.extcalc_upgrade_nonce_ledger_v0
 FOR INSERT TO upv1_nonce_writer
 WITH CHECK (tenant_id='00000000-0000-0000-0000-000000000001'::uuid);
CREATE POLICY upv1_nonce_recheck ON privado.extcalc_upgrade_nonce_ledger_v0
 FOR SELECT TO upv1_nonce_writer
 USING (tenant_id='00000000-0000-0000-0000-000000000001'::uuid);

-- No LOGIN, membership, credentials, or public grants are created by this migration.
