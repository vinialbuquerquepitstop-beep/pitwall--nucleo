-- PITSQUAD A00 Internal Transition V0
-- Applies only explicitly safe, internal, non-economic Decision Contracts.
-- External/economic actions remain outside this executor.

create table if not exists public.pitsquad_internal_transition_receipt (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id),
  contract_id uuid not null references public.pitsquad_decision_contract(id),
  run_id uuid not null references public.pitsquad_acquisition_run(id),
  action text not null,
  from_state jsonb not null default '{}'::jsonb,
  to_state jsonb not null default '{}'::jsonb,
  execution_status text not null
    check (execution_status in ('EXECUTED','BLOCKED','FAILED')),
  reason text,
  executed_by uuid,
  executed_at timestamptz not null default now(),
  unique (tenant_id,contract_id)
);

alter table public.pitsquad_internal_transition_receipt enable row level security;

drop policy if exists pitsquad_internal_transition_receipt_select on public.pitsquad_internal_transition_receipt;
create policy pitsquad_internal_transition_receipt_select
on public.pitsquad_internal_transition_receipt
for select to authenticated
using (tenant_id=privado.fn_tenant_atual());

grant select on table public.pitsquad_internal_transition_receipt to authenticated;

create or replace function public.pitsquad_apply_internal_decision_internal_v0(
  p_tenant uuid,
  p_contract_id uuid,
  p_actor uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_contract public.pitsquad_decision_contract%rowtype;
  v_run public.pitsquad_acquisition_run%rowtype;
  v_learning public.pitsquad_learning_candidate%rowtype;
  v_receipt public.pitsquad_internal_transition_receipt%rowtype;
  v_from jsonb;
  v_to jsonb;
begin
  select * into v_contract
  from public.pitsquad_decision_contract
  where id=p_contract_id and tenant_id=p_tenant;

  if not found then
    return jsonb_build_object('ok',false,'state','INVALID','reason','CONTRACT_NOT_FOUND');
  end if;

  if v_contract.status <> 'OPEN' then
    return jsonb_build_object('ok',false,'state','BLOCKED','reason','CONTRACT_NOT_OPEN');
  end if;

  if v_contract.authority_required <> 'NONE'
     or v_contract.approval_state <> 'NOT_REQUIRED' then
    return jsonb_build_object('ok',false,'state','BLOCKED','reason','AUTHORITY_REQUIRED');
  end if;

  select * into v_run
  from public.pitsquad_acquisition_run
  where id=v_contract.run_id and tenant_id=p_tenant;

  if not found then
    return jsonb_build_object('ok',false,'state','INVALID','reason','RUN_NOT_FOUND');
  end if;

  if v_contract.recommended_action='RETER_COMO_PROVA_TECNICA' then
    if v_run.input_mode <> 'TEST'
       or v_run.learning_candidate_id is null
       or v_run.stage <> 'LEARNING' then
      return jsonb_build_object('ok',false,'state','BLOCKED','reason','TEST_RETENTION_PRECONDITION_FAILED');
    end if;

    select * into v_learning
    from public.pitsquad_learning_candidate
    where id=v_run.learning_candidate_id and tenant_id=p_tenant;

    if not found then
      return jsonb_build_object('ok',false,'state','INVALID','reason','LEARNING_CANDIDATE_NOT_FOUND');
    end if;

    if v_learning.promotion_eligible then
      return jsonb_build_object('ok',false,'state','BLOCKED','reason','TEST_CANDIDATE_MUST_NOT_BE_PROMOTION_ELIGIBLE');
    end if;

    v_from := jsonb_build_object(
      'learning_status',v_learning.status,
      'run_stage',v_run.stage,
      'run_execution_status',v_run.execution_status
    );

    update public.pitsquad_learning_candidate
    set status='RETAINED'
    where id=v_learning.id
      and tenant_id=p_tenant
      and status='CANDIDATE';

    select * into v_run
    from public.pitsquad_acquisition_run
    where id=v_contract.run_id and tenant_id=p_tenant;

    v_to := jsonb_build_object(
      'learning_status','RETAINED',
      'run_stage',v_run.stage,
      'run_execution_status',v_run.execution_status
    );

    update public.pitsquad_decision_contract
    set status='COMPLETE'
    where id=v_contract.id and tenant_id=p_tenant;

    insert into public.pitsquad_internal_transition_receipt(
      tenant_id,contract_id,run_id,action,from_state,to_state,
      execution_status,reason,executed_by
    )
    values(
      p_tenant,v_contract.id,v_run.id,v_contract.recommended_action,
      v_from,v_to,'EXECUTED','SAFE_INTERNAL_STATE_TRANSITION',p_actor
    )
    on conflict (tenant_id,contract_id)
    do nothing
    returning * into v_receipt;

    if v_receipt.id is null then
      select * into v_receipt
      from public.pitsquad_internal_transition_receipt
      where tenant_id=p_tenant and contract_id=v_contract.id
      limit 1;
    end if;

    return jsonb_build_object(
      'ok',true,
      'state','EXECUTED',
      'receipt_id',v_receipt.id,
      'action',v_contract.recommended_action,
      'run_id',v_run.id,
      'run_stage',v_run.stage,
      'run_execution_status',v_run.execution_status,
      'learning_state','RETAINED'
    );
  end if;

  return jsonb_build_object(
    'ok',false,
    'state','BLOCKED',
    'reason','ACTION_NOT_ALLOWED_BY_INTERNAL_EXECUTOR',
    'recommended_action',v_contract.recommended_action
  );
end;
$function$;

revoke all on function public.pitsquad_apply_internal_decision_internal_v0(uuid,uuid,uuid) from public;

create or replace function public.pitsquad_apply_internal_decision_v0(
  p_contract_id uuid
)
returns jsonb
language plpgsql
set search_path to 'public','privado'
as $function$
declare
  v_tenant uuid := privado.fn_tenant_atual();
begin
  if v_tenant is null then
    return jsonb_build_object('ok',false,'state','INVALID','reason','NO_TENANT');
  end if;

  return public.pitsquad_apply_internal_decision_internal_v0(
    v_tenant,
    p_contract_id,
    auth.uid()
  );
end;
$function$;

revoke all on function public.pitsquad_apply_internal_decision_v0(uuid) from public;
grant execute on function public.pitsquad_apply_internal_decision_v0(uuid) to authenticated;

create or replace function public.pitsquad_a00_safe_internal_trigger_v0()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.status='OPEN'
     and new.authority_required='NONE'
     and new.approval_state='NOT_REQUIRED'
     and new.recommended_action='RETER_COMO_PROVA_TECNICA' then
    perform public.pitsquad_apply_internal_decision_internal_v0(new.tenant_id,new.id,null);
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_pitsquad_a00_safe_internal on public.pitsquad_decision_contract;
create trigger trg_pitsquad_a00_safe_internal
after insert or update of recommended_action,authority_required,approval_state
on public.pitsquad_decision_contract
for each row execute function public.pitsquad_a00_safe_internal_trigger_v0();

-- Backfill the currently-open safe contracts.
select public.pitsquad_apply_internal_decision_internal_v0(
  d.tenant_id,
  d.id,
  null
)
from public.pitsquad_decision_contract d
where d.status='OPEN'
  and d.authority_required='NONE'
  and d.approval_state='NOT_REQUIRED'
  and d.recommended_action='RETER_COMO_PROVA_TECNICA';
