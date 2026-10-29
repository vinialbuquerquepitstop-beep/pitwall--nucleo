-- TREE WM-03 / Gate 1 — MANUAL ADMINISTRATOR RUNBOOK, STAGING ONLY
-- Project: pitstop-connect-hub-ingress-staging (purple-violet-98259937)
-- Execute ONLY in the authorized Neon SQL Editor against the isolated staging DB.
-- Never commit actual passwords or paste them into a chat.
-- Replace BOTH password placeholders with unique high-entropy passwords in the editor.
-- Do not use Neon "Add role", CLI or API for application roles: these may inherit BYPASSRLS.
-- Review this statement with the database administrator before execution.
BEGIN;
CREATE ROLE pch_app_a_login WITH LOGIN NOBYPASSRLS NOINHERIT PASSWORD '<REPLACE_WITH_A_UNIQUE_SECRET>';
CREATE ROLE pch_app_b_login WITH LOGIN NOBYPASSRLS NOINHERIT PASSWORD '<REPLACE_WITH_B_UNIQUE_SECRET>';

INSERT INTO ingress_tenant_role_bindings(db_role,tenant_binding_ref)
VALUES ('pch_app_a_login','pch_app_tenant_a'),('pch_app_b_login','pch_app_tenant_b');

GRANT CONNECT ON DATABASE neondb TO pch_app_a_login,pch_app_b_login;
GRANT USAGE ON SCHEMA public TO pch_app_a_login,pch_app_b_login;
GRANT SELECT ON ingress_tenant_role_bindings TO pch_app_a_login,pch_app_b_login;
GRANT SELECT,INSERT ON ingress_events,ingress_outbox TO pch_app_a_login,pch_app_b_login;

ALTER POLICY pch_tenant_binding_select ON ingress_tenant_role_bindings
TO pch_tenant_a_test,pch_tenant_b_test,pch_runtime_a_sql,pch_runtime_b_sql,pch_app_a_login,pch_app_b_login;
ALTER POLICY pch_ingress_tenant ON ingress_events
TO pch_tenant_a_test,pch_tenant_b_test,pch_runtime_a_sql,pch_runtime_b_sql,pch_app_a_login,pch_app_b_login;
ALTER POLICY pch_outbox_tenant ON ingress_outbox
TO pch_tenant_a_test,pch_tenant_b_test,pch_runtime_a_sql,pch_runtime_b_sql,pch_app_a_login,pch_app_b_login;
COMMIT;

-- Verification as DB administrator; these only prove role properties.
SELECT rolname,rolcanlogin,rolbypassrls,
       pg_has_role(oid,'pg_read_all_data','member') AS readall,
       pg_has_role(oid,'neon_superuser','member') AS neon_admin
FROM pg_roles WHERE rolname IN ('pch_app_a_login','pch_app_b_login');

-- IMPORTANT: The actual Gate 1 requires two separate authenticated SQL connections
-- using credentials A/B and proving positive same-tenant SELECT/INSERT,
-- negative cross-tenant SELECT/INSERT, and real concurrent Inbox+Outbox.
-- RLS enablement and role properties alone never prove isolation.
-- The original developer's Node integration runner still needs review for schema parity.
