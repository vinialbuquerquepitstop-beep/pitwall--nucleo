-- PostgreSQL 17 EPHEMERAL ONLY. Run after prova_gate1_db_guard_pg_setup_v0.sql
ALTER TABLE public.extcalc_offer_revision ADD COLUMN criado_em timestamptz NOT NULL DEFAULT now();
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
-- Production return signature is deliberately NOT emulated in full.
CREATE OR REPLACE FUNCTION privado.extcalc_product_membership_v0()
RETURNS TABLE(tenant_id uuid)
LANGUAGE sql STABLE AS $body$
  SELECT nullif(current_setting('test.tenant_id',true),'')::uuid
$body$;
CREATE TABLE public.extcalc_run (
  tenant_id uuid NOT NULL,
  analysis_id text NOT NULL,
  offer_id text NOT NULL,
  offer_revision integer NOT NULL,
  contract_id text NOT NULL,
  execution_status text NOT NULL,
  freshness_status text NOT NULL,
  output_snapshot jsonb NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
-- Source-execution reads only when not quarantined; simplified representation.
CREATE TABLE public.extcalc_execution (
  tenant_id uuid NOT NULL,
  analysis_id text NOT NULL,
  offer_id text NOT NULL,
  offer_revision integer NOT NULL,
  execution_id uuid NOT NULL DEFAULT gen_random_uuid(),
  execution_status text NOT NULL,
  freshness_status text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
