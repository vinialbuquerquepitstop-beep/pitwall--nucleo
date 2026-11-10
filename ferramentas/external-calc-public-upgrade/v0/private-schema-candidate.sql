-- Pitstop Upgrade V1 | CANDIDATE SCHEMA ONLY. DO NOT APPLY WITHOUT OWNER APPROVAL.
-- No data migrations, no public endpoints, no credentials, no runtime toggles.
-- All private tables fail closed: no grants to anon/authenticated/service_role.
BEGIN;
-- Existing privado schema is preserved; do not mutate its ACL.
CREATE SCHEMA IF NOT EXISTS privado;

CREATE TABLE IF NOT EXISTS privado.extcalc_upgrade_publications_v0 (
 tenant_id uuid NOT NULL,
 public_id text NOT NULL CHECK(public_id ~ '^[A-Za-z0-9_-]{1,100}$'),
 price_revision text NOT NULL CHECK(price_revision ~ '^[A-Za-z0-9_-]{1,100}$'),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','revoked')),
 sale_price_minor bigint NOT NULL CHECK(sale_price_minor BETWEEN 0 AND 100000000),
 expires_at_ms bigint NOT NULL CHECK(expires_at_ms > 0),
 offer_revision integer NOT NULL CHECK(offer_revision > 0),
 analysis_id text NOT NULL CHECK(analysis_id ~ '^[A-Za-z0-9_-]{1,100}$'),
 offer_id text NOT NULL CHECK(offer_id ~ '^[A-Za-z0-9_-]{1,100}$'),
 offer_value_fingerprint text NOT NULL CHECK(length(offer_value_fingerprint) BETWEEN 4 AND 256),
 approved_at timestamptz,
 approved_by uuid,
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (tenant_id, public_id, price_revision),
 CHECK (status <> 'published' OR (approved_at IS NOT NULL AND approved_by IS NOT NULL AND revoked_at IS NULL))
);
ALTER TABLE privado.extcalc_upgrade_publications_v0 ENABLE ROW LEVEL SECURITY;
ALTER TABLE privado.extcalc_upgrade_publications_v0 FORCE ROW LEVEL SECURITY;
REVOKE ALL ON privado.extcalc_upgrade_publications_v0 FROM PUBLIC;

CREATE TABLE IF NOT EXISTS privado.extcalc_upgrade_context_v0 (
 tenant_id uuid NOT NULL,
 public_id text NOT NULL,
 offer_revision integer NOT NULL CHECK(offer_revision > 0),
 offers jsonb NOT NULL CHECK(jsonb_typeof(offers)='array'),
 trade_in_candidates jsonb NOT NULL CHECK(jsonb_typeof(trade_in_candidates)='array'),
 trade_in_policy jsonb NOT NULL CHECK(jsonb_typeof(trade_in_policy)='object'),
 rate_profile jsonb NOT NULL CHECK(jsonb_typeof(rate_profile)='object'),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (tenant_id, public_id, offer_revision)
);
ALTER TABLE privado.extcalc_upgrade_context_v0 ENABLE ROW LEVEL SECURITY;
ALTER TABLE privado.extcalc_upgrade_context_v0 FORCE ROW LEVEL SECURITY;
REVOKE ALL ON privado.extcalc_upgrade_context_v0 FROM PUBLIC;

-- Explicit reviewed-publication index. NEVER infer publication from raw supplier offers.
CREATE TABLE IF NOT EXISTS privado.extcalc_upgrade_public_catalog_v1 (
 tenant_id uuid NOT NULL,
 public_id text NOT NULL,
 price_revision text NOT NULL,
 desired_model text NOT NULL CHECK(length(btrim(desired_model)) BETWEEN 1 AND 100),
 desired_capacity text NOT NULL CHECK(desired_capacity IN ('64 GB','128 GB','256 GB','512 GB','1 TB','2 TB')),
 desired_condition text NOT NULL CHECK(desired_condition IN ('lacrado','seminovo')),
 trade_in_models jsonb NOT NULL CHECK(jsonb_typeof(trade_in_models)='array' AND jsonb_array_length(trade_in_models)<=200),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (tenant_id,public_id,price_revision),
 FOREIGN KEY (tenant_id,public_id,price_revision)
  REFERENCES privado.extcalc_upgrade_publications_v0(tenant_id,public_id,price_revision)
);
ALTER TABLE privado.extcalc_upgrade_public_catalog_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE privado.extcalc_upgrade_public_catalog_v1 FORCE ROW LEVEL SECURITY;
REVOKE ALL ON privado.extcalc_upgrade_public_catalog_v1 FROM PUBLIC;

CREATE TABLE IF NOT EXISTS privado.extcalc_upgrade_nonce_ledger_v0 (
 nonce_digest text PRIMARY KEY CHECK(nonce_digest ~ '^[a-f0-9]{64}$'),
 tenant_id uuid NOT NULL,
 expires_at timestamptz NOT NULL,
 inserted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(expires_at > inserted_at)
);
ALTER TABLE privado.extcalc_upgrade_nonce_ledger_v0 ENABLE ROW LEVEL SECURITY;
ALTER TABLE privado.extcalc_upgrade_nonce_ledger_v0 FORCE ROW LEVEL SECURITY;
REVOKE ALL ON privado.extcalc_upgrade_nonce_ledger_v0 FROM PUBLIC;

CREATE TABLE IF NOT EXISTS privado.upgrade_requests_v1 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL,
 request_key uuid NOT NULL,
 customer_name text NOT NULL CHECK(length(btrim(customer_name)) BETWEEN 2 AND 80),
 whatsapp_digits text NOT NULL CHECK(whatsapp_digits ~ '^55[0-9]{10,11}$'),
 selection jsonb NOT NULL CHECK(jsonb_typeof(selection)='object'),
 consent_at timestamptz NOT NULL,
 source text NOT NULL DEFAULT 'instagram_upgrade' CHECK(source='instagram_upgrade'),
 status text NOT NULL DEFAULT 'RECEIVED' CHECK(status IN ('RECEIVED','LINKED','REVIEWED','CANCELLED')),
 lead_id uuid,
 quote_snapshot jsonb CHECK(quote_snapshot IS NULL OR jsonb_typeof(quote_snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (tenant_id,request_key)
);
CREATE INDEX IF NOT EXISTS upgrade_requests_tenant_created_idx ON privado.upgrade_requests_v1(tenant_id,created_at DESC);
ALTER TABLE privado.upgrade_requests_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE privado.upgrade_requests_v1 FORCE ROW LEVEL SECURITY;
REVOKE ALL ON privado.upgrade_requests_v1 FROM PUBLIC;

-- Deliberately no policies, grants or credentials: requires an expressly
-- approved, tenant-restricted role/access policy for every server action.
COMMIT;
