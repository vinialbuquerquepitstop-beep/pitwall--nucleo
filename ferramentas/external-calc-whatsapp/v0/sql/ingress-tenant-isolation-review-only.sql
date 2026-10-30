-- WM-03.4c SECURITY DESIGN ONLY. DO NOT AUTO-APPLY.
-- Database: isolated Pitstop Connect Hub staging. Review role topology before migration.
-- Database owner/migration role stays private; never serve webhook using owner credentials.
-- Access must be per-workload and per-tenant, NOT a caller-settable session GUC.
BEGIN;
CREATE TABLE IF NOT EXISTS ingress_tenant_role_bindings (
  db_role name NOT NULL PRIMARY KEY,
  tenant_binding_ref text NOT NULL UNIQUE,
  authorized_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON ingress_tenant_role_bindings FROM PUBLIC;

ALTER TABLE ingress_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingress_events FORCE ROW LEVEL SECURITY;
ALTER TABLE ingress_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingress_outbox FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pch_ingress_tenant_event ON ingress_events;
CREATE POLICY pch_ingress_tenant_event ON ingress_events
 FOR ALL TO PUBLIC
 USING (
   EXISTS (
     SELECT 1 FROM ingress_tenant_role_bindings b
     WHERE b.db_role = current_user AND b.tenant_binding_ref = ingress_events.tenant_binding_ref
   )
 )
 WITH CHECK (
   EXISTS (
     SELECT 1 FROM ingress_tenant_role_bindings b
     WHERE b.db_role = current_user AND b.tenant_binding_ref = ingress_events.tenant_binding_ref
   )
 );

DROP POLICY IF EXISTS pch_ingress_tenant_outbox ON ingress_outbox;
CREATE POLICY pch_ingress_tenant_outbox ON ingress_outbox
 FOR ALL TO PUBLIC
 USING (
   EXISTS (
     SELECT 1 FROM ingress_events e WHERE e.id = ingress_outbox.ingress_event_id
   )
 )
 WITH CHECK (
   EXISTS (
     SELECT 1 FROM ingress_events e WHERE e.id = ingress_outbox.ingress_event_id
   )
 );

-- IMPORTANT: above is a policy skeleton, not ready to apply:
-- tenant service roles need minimal GRANT on both tables; binding table needs
-- narrowly scoped SECURITY DEFINER lookup or privileged controlled role access,
-- otherwise policy subquery permission errors occur. Avoid using PUBLIC role
-- here in final reviewed migration: restrict explicitly to provisioned roles.
-- Need prove no BYPASSRLS, not a member of table owner, cannot SET ROLE to peer,
-- and current_user is based on authenticated DB role rather than untrusted input.
ROLLBACK; -- deliberate no-op if mistakenly executed, never changes schema
