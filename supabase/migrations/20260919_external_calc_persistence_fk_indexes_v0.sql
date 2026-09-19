-- External Calc Persistence V0 - covering indexes for revision FKs.
-- Correcao de performance indicada pelo Supabase advisor apos a migration V0.

create index if not exists extcalc_run_revision_fk_ix
  on public.extcalc_run (tenant_id, analysis_id, offer_id, offer_revision);

create index if not exists extcalc_evidence_revision_fk_ix
  on public.extcalc_evidence (tenant_id, analysis_id, offer_id, offer_revision);
