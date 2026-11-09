-- WM-01/G6 SCHEMA CANDIDATE ONLY. DO NOT APPLY TO ANY DATABASE.
-- Requires independent review of tenant UUID mapping, dedicated least-privilege
-- service role, RLS policies and encrypted payload storage before release.
-- No GRANT, no service key, no SECURITY DEFINER and no consumer activation.
BEGIN;
CREATE SCHEMA IF NOT EXISTS extcalc_pch_shadow;
CREATE TABLE IF NOT EXISTS extcalc_pch_shadow.inbox (
  receipt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL CHECK(length(tenant_id) BETWEEN 1 AND 256),
  idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 1024),
  event_id text NOT NULL CHECK(length(event_id) BETWEEN 1 AND 256),
  content_sha256 text NOT NULL CHECK(content_sha256 ~ '^[0-9a-f]{64}$'),
  event_snapshot jsonb NOT NULL CHECK(jsonb_typeof(event_snapshot)='object'),
  state text NOT NULL DEFAULT 'ACCEPTED' CHECK(state='ACCEPTED'),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT extcalc_pch_inbox_idempotent UNIQUE(tenant_id,idempotency_key)
);
ALTER TABLE extcalc_pch_shadow.inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE extcalc_pch_shadow.inbox FORCE ROW LEVEL SECURITY;
-- Deliberately no policies or privileges; a dedicated scoped role and RLS
-- strategy must be approved and tested before any executor can use this schema.
COMMIT;
