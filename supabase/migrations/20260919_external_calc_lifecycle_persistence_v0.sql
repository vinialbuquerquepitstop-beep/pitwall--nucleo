-- External Calc Lifecycle / Persistence V0.
-- Banco registra fatos; nao calcula regra de dominio.
-- Escrita de cliente permanece fechada nesta fatia. API/adapter real entra depois do gate.
-- Todas as entidades sao tenant-scoped e append-only por contrato de aplicacao.

create table if not exists public.extcalc_analysis (
  tenant_id   uuid not null references public.tenant(id),
  analysis_id text not null,
  criado_em   timestamptz not null default now(),
  primary key (tenant_id, analysis_id)
);

comment on table public.extcalc_analysis is
  'Identidade persistente de uma Analysis do External Calc. Sem regra de dominio; fatos detalhados vivem nas revisoes e execucoes.';

create table if not exists public.extcalc_offer (
  tenant_id   uuid not null,
  analysis_id text not null,
  offer_id    text not null,
  source_id   text not null,
  criado_em   timestamptz not null default now(),
  primary key (tenant_id, analysis_id, offer_id),
  constraint extcalc_offer_analysis_fk
    foreign key (tenant_id, analysis_id)
    references public.extcalc_analysis (tenant_id, analysis_id)
);

comment on table public.extcalc_offer is
  'Identidade estavel da oferta dentro de uma Analysis. Revisoes materiais ficam em extcalc_offer_revision.';

create table if not exists public.extcalc_offer_revision (
  tenant_id                  uuid not null,
  analysis_id                text not null,
  offer_id                   text not null,
  offer_revision             integer not null check (offer_revision > 0),
  c01_contract_version       text not null,
  c01_snapshot               jsonb not null check (jsonb_typeof(c01_snapshot) = 'object'),
  offer_identity_fingerprint text not null,
  offer_value_fingerprint    text not null,
  domain_outcome             text not null,
  freshness_status           text not null,
  criado_em                  timestamptz not null default now(),
  primary key (tenant_id, analysis_id, offer_id, offer_revision),
  constraint extcalc_offer_revision_offer_fk
    foreign key (tenant_id, analysis_id, offer_id)
    references public.extcalc_offer (tenant_id, analysis_id, offer_id)
);

comment on table public.extcalc_offer_revision is
  'Snapshot imutavel de C01 Reviewed Offer por offer_revision. O banco preserva a semantica produzida pelo contrato; nao a recalcula.';

create table if not exists public.extcalc_human_review (
  review_id       uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null,
  analysis_id     text not null,
  offer_id        text not null,
  offer_revision  integer not null,
  decision        text not null,
  reviewer_ref    text not null,
  reviewed_at     timestamptz not null,
  review_snapshot jsonb not null check (jsonb_typeof(review_snapshot) = 'object'),
  criado_em       timestamptz not null default now(),
  constraint extcalc_human_review_revision_fk
    foreign key (tenant_id, analysis_id, offer_id, offer_revision)
    references public.extcalc_offer_revision (tenant_id, analysis_id, offer_id, offer_revision),
  constraint extcalc_human_review_once_uk
    unique (tenant_id, analysis_id, offer_id, offer_revision, reviewer_ref, reviewed_at)
);

comment on table public.extcalc_human_review is
  'Registro append-only da revisao humana materializada em C01. Nao decide resultado; apenas preserva o fato e sua proveniencia.';

create table if not exists public.extcalc_execution (
  execution_id             uuid primary key,
  tenant_id                uuid not null,
  analysis_id              text not null,
  offer_id                 text not null,
  offer_revision           integer not null,
  service_version          text not null,
  service_engine_version   text not null,
  core_contract_version    text not null,
  core_engine_version      text not null,
  core_input_fingerprint   text not null,
  core_output_fingerprint  text not null,
  execution_status         text not null,
  freshness_status         text not null,
  request_snapshot         jsonb not null check (jsonb_typeof(request_snapshot) = 'object'),
  response_snapshot        jsonb not null check (jsonb_typeof(response_snapshot) = 'object'),
  criado_em                timestamptz not null default now(),
  constraint extcalc_execution_tenant_id_uk unique (tenant_id, execution_id),
  constraint extcalc_execution_revision_fk
    foreign key (tenant_id, analysis_id, offer_id, offer_revision)
    references public.extcalc_offer_revision (tenant_id, analysis_id, offer_id, offer_revision)
);

comment on table public.extcalc_execution is
  'Envelope persistido de uma execucao do External Calc Service V0. request_snapshot + response_snapshot permitem replay/auditoria exata sem mover regra para SQL.';

create table if not exists public.extcalc_run (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null,
  execution_id       uuid not null,
  analysis_id        text not null,
  offer_id           text not null,
  offer_revision     integer not null,
  contract_id        text not null check (contract_id in ('C02','C03','C04','C05')),
  run_id             text not null,
  contract_version   text not null,
  engine_version     text not null,
  stage              text not null,
  execution_status   text not null,
  domain_outcome     text,
  freshness_status   text not null,
  input_fingerprint  text not null,
  output_fingerprint text not null,
  provenance_refs    jsonb not null default '[]'::jsonb check (jsonb_typeof(provenance_refs) = 'array'),
  output_snapshot    jsonb not null check (jsonb_typeof(output_snapshot) = 'object'),
  criado_em          timestamptz not null default now(),
  constraint extcalc_run_execution_fk
    foreign key (tenant_id, execution_id)
    references public.extcalc_execution (tenant_id, execution_id),
  constraint extcalc_run_revision_fk
    foreign key (tenant_id, analysis_id, offer_id, offer_revision)
    references public.extcalc_offer_revision (tenant_id, analysis_id, offer_id, offer_revision),
  constraint extcalc_run_contract_run_uk unique (tenant_id, contract_id, run_id)
);

comment on table public.extcalc_run is
  'Run generico dos contratos C02-C05. contract_id mantem as entidades semanticamente separadas sem duplicar quatro schemas de persistencia quase identicos.';

create table if not exists public.extcalc_evidence (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null,
  execution_id      uuid not null,
  analysis_id       text not null,
  offer_id          text not null,
  offer_revision    integer not null,
  evidence_id       text not null,
  observed_at       timestamptz,
  evidence_snapshot jsonb not null check (jsonb_typeof(evidence_snapshot) = 'object'),
  criado_em         timestamptz not null default now(),
  constraint extcalc_evidence_execution_fk
    foreign key (tenant_id, execution_id)
    references public.extcalc_execution (tenant_id, execution_id),
  constraint extcalc_evidence_revision_fk
    foreign key (tenant_id, analysis_id, offer_id, offer_revision)
    references public.extcalc_offer_revision (tenant_id, analysis_id, offer_id, offer_revision),
  constraint extcalc_evidence_execution_evidence_uk unique (tenant_id, execution_id, evidence_id)
);

comment on table public.extcalc_evidence is
  'Snapshot da Evidence[] recebida pela execucao. Evidencia e dado de entrada; elegibilidade continua pertencendo a C03.';

create index if not exists extcalc_offer_revision_lookup_ix
  on public.extcalc_offer_revision (tenant_id, analysis_id, offer_id, offer_revision desc);

create index if not exists extcalc_execution_lookup_ix
  on public.extcalc_execution (tenant_id, analysis_id, offer_id, offer_revision, criado_em desc);

create index if not exists extcalc_run_execution_ix
  on public.extcalc_run (tenant_id, execution_id, contract_id);

create index if not exists extcalc_evidence_execution_ix
  on public.extcalc_evidence (tenant_id, execution_id);

alter table public.extcalc_analysis       enable row level security;
alter table public.extcalc_offer          enable row level security;
alter table public.extcalc_offer_revision enable row level security;
alter table public.extcalc_human_review   enable row level security;
alter table public.extcalc_execution      enable row level security;
alter table public.extcalc_run            enable row level security;
alter table public.extcalc_evidence       enable row level security;

drop policy if exists extcalc_analysis_sel on public.extcalc_analysis;
drop policy if exists extcalc_offer_sel on public.extcalc_offer;
drop policy if exists extcalc_offer_revision_sel on public.extcalc_offer_revision;
drop policy if exists extcalc_human_review_sel on public.extcalc_human_review;
drop policy if exists extcalc_execution_sel on public.extcalc_execution;
drop policy if exists extcalc_run_sel on public.extcalc_run;
drop policy if exists extcalc_evidence_sel on public.extcalc_evidence;

create policy extcalc_analysis_sel on public.extcalc_analysis
  for select to authenticated
  using (tenant_id = privado.fn_tenant_atual() and privado.fn_papel_atual() = 'dono');

create policy extcalc_offer_sel on public.extcalc_offer
  for select to authenticated
  using (tenant_id = privado.fn_tenant_atual() and privado.fn_papel_atual() = 'dono');

create policy extcalc_offer_revision_sel on public.extcalc_offer_revision
  for select to authenticated
  using (tenant_id = privado.fn_tenant_atual() and privado.fn_papel_atual() = 'dono');

create policy extcalc_human_review_sel on public.extcalc_human_review
  for select to authenticated
  using (tenant_id = privado.fn_tenant_atual() and privado.fn_papel_atual() = 'dono');

create policy extcalc_execution_sel on public.extcalc_execution
  for select to authenticated
  using (tenant_id = privado.fn_tenant_atual() and privado.fn_papel_atual() = 'dono');

create policy extcalc_run_sel on public.extcalc_run
  for select to authenticated
  using (tenant_id = privado.fn_tenant_atual() and privado.fn_papel_atual() = 'dono');

create policy extcalc_evidence_sel on public.extcalc_evidence
  for select to authenticated
  using (tenant_id = privado.fn_tenant_atual() and privado.fn_papel_atual() = 'dono');

revoke all on public.extcalc_analysis       from anon, authenticated;
revoke all on public.extcalc_offer          from anon, authenticated;
revoke all on public.extcalc_offer_revision from anon, authenticated;
revoke all on public.extcalc_human_review   from anon, authenticated;
revoke all on public.extcalc_execution      from anon, authenticated;
revoke all on public.extcalc_run            from anon, authenticated;
revoke all on public.extcalc_evidence       from anon, authenticated;

grant select on public.extcalc_analysis       to authenticated;
grant select on public.extcalc_offer          to authenticated;
grant select on public.extcalc_offer_revision to authenticated;
grant select on public.extcalc_human_review   to authenticated;
grant select on public.extcalc_execution      to authenticated;
grant select on public.extcalc_run            to authenticated;
grant select on public.extcalc_evidence       to authenticated;
