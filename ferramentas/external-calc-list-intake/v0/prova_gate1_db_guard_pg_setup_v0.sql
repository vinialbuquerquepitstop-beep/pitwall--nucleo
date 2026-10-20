-- Synthetic, ephemeral PostgreSQL ONLY. Never run on a real Supabase project.
CREATE SCHEMA auth;
CREATE SCHEMA privado;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $body$
 SELECT nullif(current_setting('test.user_id', true),'')::uuid
$body$;
CREATE FUNCTION privado.fn_tenant_atual() RETURNS uuid LANGUAGE sql STABLE AS $body$
 SELECT nullif(current_setting('test.tenant_id', true),'')::uuid
$body$;
CREATE FUNCTION privado.fn_papel_atual() RETURNS text LANGUAGE sql STABLE AS $body$
 SELECT nullif(current_setting('test.papel', true),'')
$body$;

CREATE TABLE public.extcalc_source_supplier (
  tenant_id uuid NOT NULL,
  source_id text NOT NULL,
  supplier_id uuid NOT NULL,
  PRIMARY KEY(tenant_id,source_id)
);
CREATE TABLE public.extcalc_review_candidate (
  tenant_id uuid NOT NULL,
  analysis_id text NOT NULL,
  offer_id text NOT NULL,
  offer_revision integer NOT NULL,
  candidate_snapshot jsonb NOT NULL,
  PRIMARY KEY(tenant_id,analysis_id,offer_id,offer_revision)
);
CREATE TABLE public.extcalc_analysis(
  tenant_id uuid NOT NULL,
  analysis_id text NOT NULL,
  PRIMARY KEY(tenant_id,analysis_id)
);
CREATE TABLE public.extcalc_offer(
  tenant_id uuid NOT NULL,
  analysis_id text NOT NULL,
  offer_id text NOT NULL,
  source_id text NOT NULL,
  PRIMARY KEY(tenant_id,analysis_id,offer_id)
);
CREATE TABLE public.extcalc_offer_revision(
  tenant_id uuid NOT NULL,
  analysis_id text NOT NULL,
  offer_id text NOT NULL,
  offer_revision integer NOT NULL,
  c01_contract_version text NOT NULL,
  c01_snapshot jsonb NOT NULL,
  offer_identity_fingerprint text NOT NULL,
  offer_value_fingerprint text NOT NULL,
  domain_outcome text NOT NULL,
  freshness_status text NOT NULL,
  PRIMARY KEY(tenant_id,analysis_id,offer_id,offer_revision)
);
