-- TREE WM-03.4b | isolated ingress proposal; NOT DEPLOYED
-- This DDL belongs to an independent WhatsApp Ingress DB, not F1 or Pitwall.
-- Security policies, encryption/key management, retention and M2M require separate review.
BEGIN;
CREATE TABLE IF NOT EXISTS ingress_events (
  id uuid PRIMARY KEY,
  provider text NOT NULL CHECK (provider = 'meta_cloud_api'),
  provider_scope_id text NOT NULL,
  phone_number_id text NOT NULL,
  provider_message_id text NOT NULL,
  tenant_binding_ref text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  occurred_at timestamptz,
  routing_policy_version text NOT NULL,
  route text NOT NULL CHECK (route IN ('SUPPLIER_EXTERNAL_CALC','CRM_CANDIDATE','HOLD_REVIEW','IGNORE')),
  original_sha256 char(64) NOT NULL,
  protected_content_ref text,
  state text NOT NULL DEFAULT 'RECEIVED' CHECK (state IN ('RECEIVED','HELD','ENQUEUED','DELIVERED','DEAD_LETTER')),
  CONSTRAINT ingress_provider_message_once UNIQUE (provider,provider_scope_id,phone_number_id,provider_message_id)
);
CREATE TABLE IF NOT EXISTS ingress_outbox (
  id uuid PRIMARY KEY,
  ingress_event_id uuid NOT NULL UNIQUE REFERENCES ingress_events(id) ON DELETE RESTRICT,
  destination text NOT NULL CHECK (destination IN ('external_calc','pitwall_crm','human_review')),
  state text NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','LEASED','DELIVERED','DEAD_LETTER')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ingress_outbox_pending_idx ON ingress_outbox (next_attempt_at) WHERE state = 'PENDING';
-- Implementing caller must insert ingress event plus outbox in ONE transaction.
-- Idempotency must compare canonical event content hash on conflicts; mismatches are security conflicts.
-- Security: revoke default PUBLIC privileges and configure tenant-scoped service roles BEFORE applying.
REVOKE ALL ON ingress_events,ingress_outbox FROM PUBLIC;
COMMIT;
