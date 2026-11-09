-- WM-01/G8 POLICY CANDIDATE — NEVER APPLY AS-IS TO PROD.
-- Assumes the NOT-APPLY shadow schema has been reviewed, created on a
-- disposable PostgreSQL cluster, and no real WhatsApp data is used.
-- extcalc_pch_ingress is a NOLOGIN permission role; an independently vetted,
-- dedicated service login must receive membership only via a separate gate.
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='extcalc_pch_ingress') THEN
   CREATE ROLE extcalc_pch_ingress NOLOGIN NOBYPASSRLS;
 END IF;
END $$;

GRANT USAGE ON SCHEMA extcalc_pch_shadow TO extcalc_pch_ingress;
GRANT SELECT, INSERT ON TABLE extcalc_pch_shadow.inbox TO extcalc_pch_ingress;
REVOKE ALL ON TABLE extcalc_pch_shadow.inbox FROM PUBLIC;
ALTER TABLE extcalc_pch_shadow.inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE extcalc_pch_shadow.inbox FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pch_inbox_tenant_select ON extcalc_pch_shadow.inbox;
CREATE POLICY pch_inbox_tenant_select ON extcalc_pch_shadow.inbox
 FOR SELECT TO extcalc_pch_ingress
 USING (tenant_id = nullif(current_setting('app.pch_tenant_id',true),'')::uuid);

DROP POLICY IF EXISTS pch_inbox_tenant_insert ON extcalc_pch_shadow.inbox;
CREATE POLICY pch_inbox_tenant_insert ON extcalc_pch_shadow.inbox
 FOR INSERT TO extcalc_pch_ingress
 WITH CHECK (tenant_id = nullif(current_setting('app.pch_tenant_id',true),'')::uuid);

-- No UPDATE or DELETE grants, no direct user/browser access, and no membership
-- granted here. The application must set transaction-local tenant context only
-- AFTER independent authentication/binding and through a dedicated SQL pool.
-- PostgreSQL custom GUCs are NOT an authentication mechanism: a privileged
-- client with arbitrary SQL access could impersonate another tenant.
-- Verify current_user, rolbypassrls=false, force_rls, role membership,
-- denied cross-tenant access, and rollback isolation on disposable Postgres.
