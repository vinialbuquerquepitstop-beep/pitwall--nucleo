-- PITSQUAD AcquisitionRun Auto Sync V0
-- Keeps the execution parent synchronized from deterministic state changes.

create or replace function public.pitsquad_refresh_acquisition_run_internal_v0(
  p_tenant uuid,
  p_input_id uuid
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
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
  select * into v_input
  from public.pitsquad_acquisition_input
  where id=p_input_id and tenant_id=p_tenant;

  if not found then
    return null;
  end if;

  select * into v_action
  from public.pitsquad_acquisition_action
  where tenant_id=p_tenant and acquisition_ref=v_input.acquisition_ref
  order by created_at desc
  limit 1;

  v_run_ref := 'AR-' || replace(v_input.id::text,'-','');

  if v_input.status='LINKED' and v_input.lead_id is not null then
    v_crm := 'LINKED';
    select count(*)::int into v_sales_count
    from public.venda
    where tenant_id=p_tenant
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
  where tenant_id=p_tenant and input_id=v_input.id
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
    p_tenant,v_run_ref,v_input.acquisition_ref,v_action.id,v_input.id,v_input.input_mode,v_input.lead_id,v_learning.id,
    v_stage,v_exec,v_input.status,v_crm,v_outcome,v_interp,v_learning_state,
    v_refs,v_unknowns,v_contradictions,null,now()
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

  return v_run.id;
end;
$function$;

revoke all on function public.pitsquad_refresh_acquisition_run_internal_v0(uuid,uuid) from public;

create or replace function public.pitsquad_acquisition_run_input_trigger_v0()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform public.pitsquad_refresh_acquisition_run_internal_v0(new.tenant_id,new.id);
  return new;
end;
$function$;

drop trigger if exists trg_pitsquad_acquisition_run_input on public.pitsquad_acquisition_input;
create trigger trg_pitsquad_acquisition_run_input
after insert or update of status,lead_id,resolution_reason,input_mode,campaign_ref,source
on public.pitsquad_acquisition_input
for each row execute function public.pitsquad_acquisition_run_input_trigger_v0();

create or replace function public.pitsquad_acquisition_run_learning_trigger_v0()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform public.pitsquad_refresh_acquisition_run_internal_v0(new.tenant_id,new.input_id);
  return new;
end;
$function$;

drop trigger if exists trg_pitsquad_acquisition_run_learning on public.pitsquad_learning_candidate;
create trigger trg_pitsquad_acquisition_run_learning
after insert or update of status,outcome_state
on public.pitsquad_learning_candidate
for each row execute function public.pitsquad_acquisition_run_learning_trigger_v0();

-- Backfill currently known inputs into their parent run.
select public.pitsquad_refresh_acquisition_run_internal_v0(i.tenant_id,i.id)
from public.pitsquad_acquisition_input i;
