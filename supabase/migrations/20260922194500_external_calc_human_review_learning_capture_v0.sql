-- External Calc Human Review Learning Capture V0.
-- Captura diferencas humanas como learning candidates auditaveis.
-- Nao altera Interpreter, schema, knowledge ou regras C01-C05.

create table if not exists public.extcalc_learning_candidate (
  learning_id               uuid primary key default gen_random_uuid(),
  tenant_id                 uuid not null,
  review_id                 uuid not null,
  analysis_id               text not null,
  offer_id                  text not null,
  original_offer_revision   integer not null check (original_offer_revision > 0),
  final_offer_revision      integer not null check (final_offer_revision > 0),
  field                     text not null
    check (field in ('model','capacity_gb','condition','color','price')),
  before_value              jsonb,
  after_value               jsonb,
  evidence_snapshot         jsonb not null default '{}'::jsonb
    check (jsonb_typeof(evidence_snapshot) = 'object'),
  source_id                 text,
  reviewer_ref              text not null,
  proposal_status           text not null default 'PROPOSED'
    check (proposal_status in ('PROPOSED','APPROVED','REJECTED','PROMOTED')),
  criado_em                 timestamptz not null default now(),

  constraint extcalc_learning_candidate_review_fk
    foreign key (review_id)
    references public.extcalc_human_review (review_id),

  constraint extcalc_learning_candidate_once_uk
    unique (tenant_id, review_id, field)
);

comment on table public.extcalc_learning_candidate is
  'Correcoes humanas candidatas a aprendizado. PROPOSED nao altera Interpreter; promocao exige gate separado.';

create index if not exists extcalc_learning_candidate_status_ix
  on public.extcalc_learning_candidate (tenant_id, proposal_status, criado_em desc);

alter table public.extcalc_learning_candidate enable row level security;

drop policy if exists extcalc_learning_candidate_sel on public.extcalc_learning_candidate;
create policy extcalc_learning_candidate_sel
  on public.extcalc_learning_candidate
  for select
  to authenticated
  using (
    tenant_id = privado.fn_tenant_atual()
    and privado.fn_papel_atual() = 'dono'
  );

revoke all on public.extcalc_learning_candidate from anon, authenticated;
grant select on public.extcalc_learning_candidate to authenticated;

create or replace function privado.extcalc_capture_learning_candidate_v0()
returns trigger
language plpgsql
security definer
set search_path = ''
as $extcalc_learning_capture$
declare
  v_original_revision integer;
  v_candidate jsonb;
  v_reviewed jsonb;
  v_field text;
  v_before jsonb;
  v_after jsonb;
  v_evidence jsonb;
begin
  -- V0 aprende apenas com correcao explicita. ACCEPT confirma operacao,
  -- mas nao cria regra nova.
  if new.decision is distinct from 'EDIT' then
    return new;
  end if;

  v_original_revision := coalesce(
    nullif(new.review_snapshot->>'original_offer_revision', '')::integer,
    new.offer_revision
  );

  select c.candidate_snapshot
    into v_candidate
    from public.extcalc_review_candidate c
   where c.tenant_id = new.tenant_id
     and c.analysis_id = new.analysis_id
     and c.offer_id = new.offer_id
     and c.offer_revision = v_original_revision;

  select r.c01_snapshot
    into v_reviewed
    from public.extcalc_offer_revision r
   where r.tenant_id = new.tenant_id
     and r.analysis_id = new.analysis_id
     and r.offer_id = new.offer_id
     and r.offer_revision = new.offer_revision;

  if v_candidate is null or v_reviewed is null then
    -- A revisao operacional nunca deve falhar por causa de capture ausente.
    return new;
  end if;

  v_evidence := pg_catalog.jsonb_build_object(
    'review_evidence', coalesce(v_candidate->'review_evidence', '{}'::jsonb),
    'trace', coalesce(v_candidate->'trace', '[]'::jsonb),
    'provenance_refs', coalesce(v_candidate->'provenance_refs', '[]'::jsonb)
  );

  foreach v_field in array array['model','capacity_gb','condition','color','price']
  loop
    v_before := v_candidate->'interpreted_offer'->v_field;
    v_after := v_reviewed->'reviewed_offer'->v_field;

    if v_before is distinct from v_after then
      insert into public.extcalc_learning_candidate (
        tenant_id,
        review_id,
        analysis_id,
        offer_id,
        original_offer_revision,
        final_offer_revision,
        field,
        before_value,
        after_value,
        evidence_snapshot,
        source_id,
        reviewer_ref,
        proposal_status
      ) values (
        new.tenant_id,
        new.review_id,
        new.analysis_id,
        new.offer_id,
        v_original_revision,
        new.offer_revision,
        v_field,
        v_before,
        v_after,
        v_evidence,
        nullif(v_candidate->>'source_id', ''),
        new.reviewer_ref,
        'PROPOSED'
      )
      on conflict (tenant_id, review_id, field) do nothing;
    end if;
  end loop;

  return new;
end;
$extcalc_learning_capture$;

comment on function privado.extcalc_capture_learning_candidate_v0() is
  'Captura EDIT humano como proposal de aprendizado; nunca promove schema/knowledge automaticamente.';

drop trigger if exists extcalc_human_review_learning_capture_v0
  on public.extcalc_human_review;

create trigger extcalc_human_review_learning_capture_v0
after insert on public.extcalc_human_review
for each row
execute function privado.extcalc_capture_learning_candidate_v0();
