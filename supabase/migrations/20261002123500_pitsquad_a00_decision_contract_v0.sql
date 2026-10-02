-- PITSQUAD A00 Decision Contract V0
-- Deterministic orchestration recommendation from AcquisitionRun.
-- No external mutation. No autonomous approval.

create table if not exists public.pitsquad_decision_contract (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id),
  run_id uuid not null references public.pitsquad_acquisition_run(id),
  run_ref text not null,
  trigger text not null,
  goal text not null,
  current_stage text not null,
  current_execution_status text not null,
  decision_class text not null
    check (decision_class in ('OBSERVE','INVESTIGATE','REQUEST_APPROVAL','COMPLETE')),
  recommended_action text not null,
  rationale text not null,
  authority_required text not null
    check (authority_required in ('NONE','HUMAN')),
  approval_state text not null default 'NOT_REQUIRED'
    check (approval_state in ('NOT_REQUIRED','PENDING','APPROVED','REJECTED','CANCELLED')),
  evidence_refs jsonb not null default '[]'::jsonb,
  unknowns jsonb not null default '[]'::jsonb,
  contradictions jsonb not null default '[]'::jsonb,
  next_expected_state text,
  status text not null default 'OPEN'
    check (status in ('OPEN','SUPERSEDED','COMPLETE')),
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (tenant_id,run_id,current_stage,current_execution_status,decision_class,recommended_action)
);

alter table public.pitsquad_decision_contract enable row level security;

drop policy if exists pitsquad_decision_contract_select on public.pitsquad_decision_contract;
create policy pitsquad_decision_contract_select
on public.pitsquad_decision_contract
for select to authenticated
using (tenant_id=privado.fn_tenant_atual());

drop policy if exists pitsquad_decision_contract_insert on public.pitsquad_decision_contract;
create policy pitsquad_decision_contract_insert
on public.pitsquad_decision_contract
for insert to authenticated
with check (tenant_id=privado.fn_tenant_atual());

grant select,insert on table public.pitsquad_decision_contract to authenticated;

create or replace function public.pitsquad_a00_decide_v0(
  p_run_id uuid
)
returns jsonb
language plpgsql
set search_path to 'public','privado'
as $function$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_run public.pitsquad_acquisition_run%rowtype;
  v_decision text;
  v_action text;
  v_rationale text;
  v_authority text := 'NONE';
  v_approval text := 'NOT_REQUIRED';
  v_next text := null;
  v_contract public.pitsquad_decision_contract%rowtype;
begin
  if v_tenant is null then
    return jsonb_build_object('ok',false,'state','INVALID','reason','NO_TENANT');
  end if;

  select * into v_run
  from public.pitsquad_acquisition_run
  where id=p_run_id and tenant_id=v_tenant;

  if not found then
    return jsonb_build_object('ok',false,'state','INVALID','reason','RUN_NOT_FOUND');
  end if;

  if v_run.execution_status='INVALID' then
    v_decision := 'COMPLETE';
    v_action := 'ENCERRAR_RUN_INVALIDO';
    v_rationale := 'O run está marcado como INVALID; nenhuma continuação operacional é permitida.';
    v_next := 'COMPLETE';

  elsif v_run.execution_status='BLOCKED' or jsonb_array_length(v_run.contradictions)>0 then
    v_decision := 'INVESTIGATE';
    v_action := 'RESOLVER_CONTRADICAO_OU_BLOQUEIO';
    v_rationale := 'Há bloqueio ou contradição explícita no run; continuar poderia propagar estado incorreto.';
    v_next := 'RUN_UNBLOCKED';

  elsif v_run.stage='CRM' and v_run.crm_state='PENDING' then
    v_decision := 'INVESTIGATE';
    v_action := 'VINCULAR_OU_CADASTRAR_LEAD';
    v_rationale := 'Existe AcquisitionInput sem vínculo CRM; o próximo passo é resolver identidade antes de interpretar resultado.';
    v_next := 'CRM_LINKED';

  elsif v_run.stage='CRM' and v_run.crm_state='CONFLICT' then
    v_decision := 'INVESTIGATE';
    v_action := 'REVISAR_CONFLITO_DE_ATRIBUICAO';
    v_rationale := 'O vínculo de aquisição está em CONFLICT e exige revisão antes de avançar.';
    v_next := 'CRM_LINKED_OR_INPUT_DISCARDED';

  elsif v_run.stage='OUTCOME' and v_run.interpretation_state is null then
    v_decision := 'OBSERVE';
    v_action := 'MATERIALIZAR_INTERPRETACAO_BOUNDED';
    v_rationale := 'O resultado já foi observado; falta apenas formalizar interpretação sem inferir causalidade.';
    v_next := 'INTERPRETATION_READY';

  elsif v_run.stage='LEARNING' and v_run.learning_state='CANDIDATE' then
    v_decision := 'OBSERVE';
    if v_run.input_mode='TEST' then
      v_action := 'RETER_COMO_PROVA_TECNICA';
      v_rationale := 'O run é TEST; o learning candidate pode provar mecanismo, mas não deve ser promovido para desempenho real.';
      v_next := 'TEST_EVIDENCE_RETAINED';
    else
      v_action := 'REVISAR_LEARNING_CANDIDATE';
      v_rationale := 'Há um learning candidate RUN/OBSERVED; qualquer retenção ou promoção exige revisão de evidência e escopo.';
      v_authority := 'HUMAN';
      v_approval := 'PENDING';
      v_decision := 'REQUEST_APPROVAL';
      v_next := 'LEARNING_REVIEWED';
    end if;

  elsif v_run.stage='COMPLETE' or v_run.execution_status='COMPLETE' then
    v_decision := 'COMPLETE';
    v_action := 'NENHUMA_ACAO';
    v_rationale := 'O run está completo.';
    v_next := 'COMPLETE';

  else
    v_decision := 'OBSERVE';
    v_action := 'OBSERVAR_ESTADO';
    v_rationale := 'Nenhuma mutação é justificada pelo estado atual; manter observação é válido.';
    v_next := v_run.stage;
  end if;

  insert into public.pitsquad_decision_contract(
    tenant_id,run_id,run_ref,trigger,goal,current_stage,current_execution_status,
    decision_class,recommended_action,rationale,authority_required,approval_state,
    evidence_refs,unknowns,contradictions,next_expected_state,status,created_by
  )
  values(
    v_tenant,v_run.id,v_run.run_ref,'RUN_STATE_CHANGED','CONTINUAR_AQUISICAO_COM_EVIDENCIA',
    v_run.stage,v_run.execution_status,v_decision,v_action,v_rationale,v_authority,v_approval,
    v_run.evidence_refs,v_run.unknowns,v_run.contradictions,v_next,'OPEN',auth.uid()
  )
  on conflict (tenant_id,run_id,current_stage,current_execution_status,decision_class,recommended_action)
  do nothing
  returning * into v_contract;

  if v_contract.id is null then
    select * into v_contract
    from public.pitsquad_decision_contract
    where tenant_id=v_tenant
      and run_id=v_run.id
      and current_stage=v_run.stage
      and current_execution_status=v_run.execution_status
      and decision_class=v_decision
      and recommended_action=v_action
    order by created_at desc
    limit 1;
  end if;

  return jsonb_build_object(
    'ok',true,
    'contract_id',v_contract.id,
    'run_id',v_run.id,
    'run_ref',v_run.run_ref,
    'decision_class',v_contract.decision_class,
    'recommended_action',v_contract.recommended_action,
    'rationale',v_contract.rationale,
    'authority_required',v_contract.authority_required,
    'approval_state',v_contract.approval_state,
    'next_expected_state',v_contract.next_expected_state,
    'evidence_refs',v_contract.evidence_refs,
    'unknowns',v_contract.unknowns,
    'contradictions',v_contract.contradictions
  );
end;
$function$;

revoke all on function public.pitsquad_a00_decide_v0(uuid) from public;
grant execute on function public.pitsquad_a00_decide_v0(uuid) to authenticated;
