-- PITSQUAD AcquisitionRun V0
-- Execution parent for action → input → CRM → outcome → interpretation → learning.
-- Deterministic orchestration state only. No autonomous action authority.

create table if not exists public.pitsquad_acquisition_run (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id),
  run_ref text not null,
  acquisition_ref text not null,
  action_id uuid references public.pitsquad_acquisition_action(id),
  input_id uuid references public.pitsquad_acquisition_input(id),
  input_mode text check (input_mode in ('REAL','TEST')),
  lead_id uuid references public.lead(id),
  learning_candidate_id uuid references public.pitsquad_learning_candidate(id),

  stage text not null default 'ACTION'
    check (stage in ('ACTION','INPUT','CRM','OUTCOME','INTERPRETATION','LEARNING','COMPLETE')),
  execution_status text not null default 'OPEN'
    check (execution_status in ('OPEN','BLOCKED','COMPLETE','INVALID')),

  acquisition_state text,
  crm_state text,
  outcome_state text,
  interpretation_state text,
  learning_state text,

  evidence_refs jsonb not null default '[]'::jsonb,
  unknowns jsonb not null default '[]'::jsonb,
  contradictions jsonb not null default '[]'::jsonb,

  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (tenant_id,run_ref),
  unique (tenant_id,input_id)
);

alter table public.pitsquad_acquisition_run enable row level security;

drop policy if exists pitsquad_acquisition_run_select on public.pitsquad_acquisition_run;
create policy pitsquad_acquisition_run_select
on public.pitsquad_acquisition_run
for select to authenticated
using (tenant_id=privado.fn_tenant_atual());

drop policy if exists pitsquad_acquisition_run_insert on public.pitsquad_acquisition_run;
create policy pitsquad_acquisition_run_insert
on public.pitsquad_acquisition_run
for insert to authenticated
with check (tenant_id=privado.fn_tenant_atual());

drop policy if exists pitsquad_acquisition_run_update on public.pitsquad_acquisition_run;
create policy pitsquad_acquisition_run_update
on public.pitsquad_acquisition_run
for update to authenticated
using (tenant_id=privado.fn_tenant_atual())
with check (tenant_id=privado.fn_tenant_atual());

grant select,insert,update on table public.pitsquad_acquisition_run to authenticated;

create or replace function public.pitsquad_sync_acquisition_run_v0(
  p_input_id uuid
)
returns jsonb
language plpgsql
set search_path to 'public','privado'
as $function$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_input public.pitsquad_acquisition_input%rowtype;
  v_action public.pitsquad_acquisition_action%rowtype;
  v_learning public.pitsquad_learning_candidate%rowtype;
  v_run public.pitsquad_acquisition_run%rowtype;
  v_run_ref text;
  v_sales_count integer := 0;
  v_outcome text := null;
  v_stage text := 'INPUT';
  v_exec text := 'OPEN';
  v_crm text := null;
  v_interp text := null;
  v_learning_state text := null;
  v_refs jsonb := '[]'::jsonb;
  v_unknowns jsonb := '[]'::jsonb;
  v_contradictions jsonb := '[]'::jsonb;
begin
  if v_tenant is null then
    return jsonb_build_object('ok',false,'state','INVALID','reason','NO_TENANT');
  end if;

  select * into v_input
  from public.pitsquad_acquisition_input
  where id=p_input_id and tenant_id=v_tenant;

  if not found then
    return jsonb_build_object('ok',false,'state','INVALID','reason','INPUT_NOT_FOUND');
  end if;

  select * into v_action
  from public.pitsquad_acquisition_action
  where tenant_id=v_tenant and acquisition_ref=v_input.acquisition_ref
  order by created_at desc
  limit 1;

  v_run_ref := 'AR-' || replace(v_input.id::text,'-','');

  if v_input.status='LINKED' and v_input.lead_id is not null then
    v_stage := 'CRM';
    v_crm := 'LINKED';

    select count(*)::int into v_sales_count
    from public.venda
    where tenant_id=v_tenant
      and lead_id=v_input.lead_id
      and arquivado_em is null
      and coalesce(status,'') <> 'cancelada';

    v_outcome := case when v_sales_count>0 then 'SALE_OBSERVED' else 'NO_SALE_OBSERVED' end;
    v_stage := 'OUTCOME';
  elsif v_input.status='CONFLICT' then
    v_crm := 'CONFLICT';
    v_exec := 'BLOCKED';
    v_stage := 'CRM';
    v_contradictions := jsonb_build_array(coalesce(v_input.resolution_reason,'CRM_CONFLICT'));
  elsif v_input.status='PENDING' then
    v_crm := 'PENDING';
    v_stage := 'CRM';
    v_unknowns := jsonb_build_array('LEAD_NOT_LINKED');
  elsif v_input.status='DISCARDED' then
    v_exec := 'INVALID';
    v_stage := 'INPUT';
  end if;

  select * into v_learning
  from public.pitsquad_learning_candidate
  where tenant_id=v_tenant and input_id=v_input.id
  order by created_at desc
  limit 1;

  if found then
    v_interp := 'READY';
    v_learning_state := v_learning.status;
    v_stage := 'LEARNING';
    if v_learning.status in ('RETAINED','REJECTED') then
      v_stage := 'COMPLETE';
      v_exec := 'COMPLETE';
    end if;
  end if;

  v_refs := jsonb_build_array('AcquisitionInput:'||v_input.id::text);
  if v_action.id is not null then
    v_refs := v_refs || jsonb_build_array('AcquisitionAction:'||v_action.id::text);
  end if;
  if v_input.lead_id is not null then
    v_refs := v_refs || jsonb_build_array('Lead:'||v_input.lead_id::text);
  end if;
  if v_learning.id is not null then
    v_refs := v_refs || jsonb_build_array('LearningCandidate:'||v_learning.id::text);
  end if;

  insert into public.pitsquad_acquisition_run(
    tenant_id,run_ref,acquisition_ref,action_id,input_id,input_mode,lead_id,learning_candidate_id,
    stage,execution_status,acquisition_state,crm_state,outcome_state,interpretation_state,learning_state,
    evidence_refs,unknowns,contradictions,created_by,updated_at
  )
  values(
    v_tenant,v_run_ref,v_input.acquisition_ref,v_action.id,v_input.id,v_input.input_mode,v_input.lead_id,v_learning.id,
    v_stage,v_exec,v_input.status,v_crm,v_outcome,v_interp,v_learning_state,
    v_refs,v_unknowns,v_contradictions,auth.uid(),now()
  )
  on conflict (tenant_id,input_id)
  do update set
    acquisition_ref=excluded.acquisition_ref,
    action_id=excluded.action_id,
    input_mode=excluded.input_mode,
    lead_id=excluded.lead_id,
    learning_candidate_id=excluded.learning_candidate_id,
    stage=excluded.stage,
    execution_status=excluded.execution_status,
    acquisition_state=excluded.acquisition_state,
    crm_state=excluded.crm_state,
    outcome_state=excluded.outcome_state,
    interpretation_state=excluded.interpretation_state,
    learning_state=excluded.learning_state,
    evidence_refs=excluded.evidence_refs,
    unknowns=excluded.unknowns,
    contradictions=excluded.contradictions,
    updated_at=now()
  returning * into v_run;

  return jsonb_build_object(
    'ok',true,
    'run_id',v_run.id,
    'run_ref',v_run.run_ref,
    'stage',v_run.stage,
    'execution_status',v_run.execution_status,
    'input_mode',v_run.input_mode,
    'acquisition_state',v_run.acquisition_state,
    'crm_state',v_run.crm_state,
    'outcome_state',v_run.outcome_state,
    'interpretation_state',v_run.interpretation_state,
    'learning_state',v_run.learning_state,
    'unknowns',v_run.unknowns,
    'contradictions',v_run.contradictions,
    'evidence_refs',v_run.evidence_refs
  );
end;
$function$;

revoke all on function public.pitsquad_sync_acquisition_run_v0(uuid) from public;
grant execute on function public.pitsquad_sync_acquisition_run_v0(uuid) to authenticated;

create or replace function public.pitsquad_list_acquisition_runs_v0()
returns jsonb
language plpgsql
stable
set search_path to 'public','privado'
as $function$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_items jsonb;
begin
  if v_tenant is null then
    return jsonb_build_object('ok',false,'reason','NO_TENANT');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,
    'run_ref',r.run_ref,
    'acquisition_ref',r.acquisition_ref,
    'input_mode',r.input_mode,
    'stage',r.stage,
    'execution_status',r.execution_status,
    'acquisition_state',r.acquisition_state,
    'crm_state',r.crm_state,
    'outcome_state',r.outcome_state,
    'interpretation_state',r.interpretation_state,
    'learning_state',r.learning_state,
    'lead_id',r.lead_id,
    'input_id',r.input_id,
    'learning_candidate_id',r.learning_candidate_id,
    'updated_at',r.updated_at,
    'unknowns',r.unknowns,
    'contradictions',r.contradictions
  ) order by r.updated_at desc),'[]'::jsonb)
  into v_items
  from public.pitsquad_acquisition_run r
  where r.tenant_id=v_tenant;

  return jsonb_build_object('ok',true,'items',v_items);
end;
$function$;

revoke all on function public.pitsquad_list_acquisition_runs_v0() from public;
grant execute on function public.pitsquad_list_acquisition_runs_v0() to authenticated;
