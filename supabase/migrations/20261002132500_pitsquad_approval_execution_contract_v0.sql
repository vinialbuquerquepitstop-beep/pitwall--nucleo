-- PITSQUAD Approval + Execution Contract V0
-- Authority chain for human-gated actions.
-- No external adapters are connected in this slice.

create table if not exists public.pitsquad_approval_contract (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id),
  decision_contract_id uuid not null references public.pitsquad_decision_contract(id),
  run_id uuid not null references public.pitsquad_acquisition_run(id),
  requested_action text not null,
  authority_required text not null default 'HUMAN'
    check (authority_required='HUMAN'),
  approval_state text not null default 'PENDING'
    check (approval_state in ('PENDING','APPROVED','REJECTED','CANCELLED')),
  rationale text not null,
  evidence_refs jsonb not null default '[]'::jsonb,
  requested_by uuid,
  decided_by uuid,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (tenant_id,decision_contract_id)
);

create table if not exists public.pitsquad_execution_contract (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id),
  approval_contract_id uuid not null references public.pitsquad_approval_contract(id),
  decision_contract_id uuid not null references public.pitsquad_decision_contract(id),
  run_id uuid not null references public.pitsquad_acquisition_run(id),
  action text not null,
  adapter text not null default 'NONE',
  execution_state text not null default 'BLOCKED'
    check (execution_state in ('BLOCKED','READY','EXECUTING','EXECUTED','FAILED','CANCELLED')),
  block_reason text,
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id,approval_contract_id)
);

alter table public.pitsquad_approval_contract enable row level security;
alter table public.pitsquad_execution_contract enable row level security;

drop policy if exists pitsquad_approval_contract_select on public.pitsquad_approval_contract;
create policy pitsquad_approval_contract_select
on public.pitsquad_approval_contract
for select to authenticated
using (tenant_id=privado.fn_tenant_atual());

drop policy if exists pitsquad_approval_contract_update on public.pitsquad_approval_contract;
create policy pitsquad_approval_contract_update
on public.pitsquad_approval_contract
for update to authenticated
using (tenant_id=privado.fn_tenant_atual())
with check (tenant_id=privado.fn_tenant_atual());

drop policy if exists pitsquad_execution_contract_select on public.pitsquad_execution_contract;
create policy pitsquad_execution_contract_select
on public.pitsquad_execution_contract
for select to authenticated
using (tenant_id=privado.fn_tenant_atual());

grant select,update on table public.pitsquad_approval_contract to authenticated;
grant select on table public.pitsquad_execution_contract to authenticated;

create or replace function public.pitsquad_materialize_approval_internal_v0(
  p_tenant uuid,
  p_decision_contract_id uuid
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_decision public.pitsquad_decision_contract%rowtype;
  v_approval public.pitsquad_approval_contract%rowtype;
  v_execution public.pitsquad_execution_contract%rowtype;
begin
  select * into v_decision
  from public.pitsquad_decision_contract
  where id=p_decision_contract_id
    and tenant_id=p_tenant;

  if not found then
    return null;
  end if;

  if v_decision.authority_required <> 'HUMAN'
     or v_decision.approval_state <> 'PENDING'
     or v_decision.status <> 'OPEN' then
    return null;
  end if;

  insert into public.pitsquad_approval_contract(
    tenant_id,decision_contract_id,run_id,requested_action,
    authority_required,approval_state,rationale,evidence_refs,requested_by
  )
  values(
    p_tenant,v_decision.id,v_decision.run_id,v_decision.recommended_action,
    'HUMAN','PENDING',v_decision.rationale,v_decision.evidence_refs,null
  )
  on conflict (tenant_id,decision_contract_id)
  do nothing
  returning * into v_approval;

  if v_approval.id is null then
    select * into v_approval
    from public.pitsquad_approval_contract
    where tenant_id=p_tenant
      and decision_contract_id=v_decision.id
    limit 1;
  end if;

  insert into public.pitsquad_execution_contract(
    tenant_id,approval_contract_id,decision_contract_id,run_id,
    action,adapter,execution_state,block_reason,payload
  )
  values(
    p_tenant,v_approval.id,v_decision.id,v_decision.run_id,
    v_decision.recommended_action,'NONE','BLOCKED',
    'WAITING_HUMAN_APPROVAL',
    jsonb_build_object(
      'run_ref',v_decision.run_ref,
      'decision_class',v_decision.decision_class,
      'next_expected_state',v_decision.next_expected_state
    )
  )
  on conflict (tenant_id,approval_contract_id)
  do nothing
  returning * into v_execution;

  return v_approval.id;
end;
$function$;

revoke all on function public.pitsquad_materialize_approval_internal_v0(uuid,uuid) from public;

create or replace function public.pitsquad_decision_approval_trigger_v0()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.status='OPEN'
     and new.authority_required='HUMAN'
     and new.approval_state='PENDING' then
    perform public.pitsquad_materialize_approval_internal_v0(new.tenant_id,new.id);
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_pitsquad_decision_approval on public.pitsquad_decision_contract;
create trigger trg_pitsquad_decision_approval
after insert or update of authority_required,approval_state,status
on public.pitsquad_decision_contract
for each row execute function public.pitsquad_decision_approval_trigger_v0();

create or replace function public.pitsquad_decide_approval_v0(
  p_approval_contract_id uuid,
  p_decision text
)
returns jsonb
language plpgsql
set search_path to 'public','privado'
as $function$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_choice text := upper(trim(coalesce(p_decision,'')));
  v_approval public.pitsquad_approval_contract%rowtype;
  v_execution public.pitsquad_execution_contract%rowtype;
begin
  if v_tenant is null then
    return jsonb_build_object('ok',false,'state','INVALID','reason','NO_TENANT');
  end if;

  if v_choice not in ('APPROVED','REJECTED','CANCELLED') then
    return jsonb_build_object('ok',false,'state','INVALID','reason','INVALID_APPROVAL_DECISION');
  end if;

  select * into v_approval
  from public.pitsquad_approval_contract
  where id=p_approval_contract_id
    and tenant_id=v_tenant;

  if not found then
    return jsonb_build_object('ok',false,'state','INVALID','reason','APPROVAL_NOT_FOUND');
  end if;

  if v_approval.approval_state <> 'PENDING' then
    return jsonb_build_object(
      'ok',false,'state','BLOCKED','reason','APPROVAL_ALREADY_DECIDED',
      'approval_state',v_approval.approval_state
    );
  end if;

  update public.pitsquad_approval_contract
  set approval_state=v_choice,
      decided_by=auth.uid(),
      decided_at=now()
  where id=v_approval.id
    and tenant_id=v_tenant
  returning * into v_approval;

  update public.pitsquad_decision_contract
  set approval_state=v_choice
  where id=v_approval.decision_contract_id
    and tenant_id=v_tenant;

  if v_choice='APPROVED' then
    update public.pitsquad_execution_contract
    set execution_state='READY',
        block_reason=null,
        updated_at=now()
    where approval_contract_id=v_approval.id
      and tenant_id=v_tenant
    returning * into v_execution;
  else
    update public.pitsquad_execution_contract
    set execution_state='CANCELLED',
        block_reason='HUMAN_'||v_choice,
        updated_at=now()
    where approval_contract_id=v_approval.id
      and tenant_id=v_tenant
    returning * into v_execution;

    update public.pitsquad_decision_contract
    set status='COMPLETE'
    where id=v_approval.decision_contract_id
      and tenant_id=v_tenant;
  end if;

  return jsonb_build_object(
    'ok',true,
    'approval_id',v_approval.id,
    'approval_state',v_approval.approval_state,
    'execution_contract_id',v_execution.id,
    'execution_state',v_execution.execution_state,
    'action',v_execution.action,
    'adapter',v_execution.adapter
  );
end;
$function$;

revoke all on function public.pitsquad_decide_approval_v0(uuid,text) from public;
grant execute on function public.pitsquad_decide_approval_v0(uuid,text) to authenticated;

-- Backfill human-gated open decisions, if any.
select public.pitsquad_materialize_approval_internal_v0(d.tenant_id,d.id)
from public.pitsquad_decision_contract d
where d.status='OPEN'
  and d.authority_required='HUMAN'
  and d.approval_state='PENDING';


create or replace function public.pitsquad_list_pending_approvals_v0()
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
    'approval_id',a.id,
    'decision_contract_id',a.decision_contract_id,
    'run_id',a.run_id,
    'run_ref',d.run_ref,
    'requested_action',a.requested_action,
    'rationale',a.rationale,
    'approval_state',a.approval_state,
    'requested_at',a.requested_at,
    'execution_contract_id',e.id,
    'execution_state',e.execution_state,
    'block_reason',e.block_reason,
    'adapter',e.adapter
  ) order by a.requested_at desc),'[]'::jsonb)
  into v_items
  from public.pitsquad_approval_contract a
  join public.pitsquad_decision_contract d
    on d.id=a.decision_contract_id
   and d.tenant_id=a.tenant_id
  left join public.pitsquad_execution_contract e
    on e.approval_contract_id=a.id
   and e.tenant_id=a.tenant_id
  where a.tenant_id=v_tenant
    and a.approval_state='PENDING';

  return jsonb_build_object('ok',true,'items',v_items);
end;
$function$;

revoke all on function public.pitsquad_list_pending_approvals_v0() from public;
grant execute on function public.pitsquad_list_pending_approvals_v0() to authenticated;
