-- PITSQUAD A00 Auto Decision V0
-- Deterministically materializes Decision Contracts when AcquisitionRun state changes.
-- No execution side effects.

create or replace function public.pitsquad_materialize_decision_contract_internal_v0(
  p_tenant uuid,
  p_run_id uuid
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_run public.pitsquad_acquisition_run%rowtype;
  v_decision text;
  v_action text;
  v_rationale text;
  v_authority text := 'NONE';
  v_approval text := 'NOT_REQUIRED';
  v_next text := null;
  v_contract public.pitsquad_decision_contract%rowtype;
begin
  select * into v_run
  from public.pitsquad_acquisition_run
  where id=p_run_id and tenant_id=p_tenant;

  if not found then
    return null;
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
    if v_run.input_mode='TEST' then
      v_decision := 'OBSERVE';
      v_action := 'RETER_COMO_PROVA_TECNICA';
      v_rationale := 'O run é TEST; o learning candidate pode provar mecanismo, mas não deve ser promovido para desempenho real.';
      v_next := 'TEST_EVIDENCE_RETAINED';
    else
      v_decision := 'REQUEST_APPROVAL';
      v_action := 'REVISAR_LEARNING_CANDIDATE';
      v_rationale := 'Há um learning candidate RUN/OBSERVED; qualquer retenção ou promoção exige revisão de evidência e escopo.';
      v_authority := 'HUMAN';
      v_approval := 'PENDING';
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

  update public.pitsquad_decision_contract
  set status='SUPERSEDED'
  where tenant_id=p_tenant
    and run_id=v_run.id
    and status='OPEN'
    and not (
      current_stage=v_run.stage
      and current_execution_status=v_run.execution_status
      and decision_class=v_decision
      and recommended_action=v_action
    );

  insert into public.pitsquad_decision_contract(
    tenant_id,run_id,run_ref,trigger,goal,current_stage,current_execution_status,
    decision_class,recommended_action,rationale,authority_required,approval_state,
    evidence_refs,unknowns,contradictions,next_expected_state,status,created_by
  )
  values(
    p_tenant,v_run.id,v_run.run_ref,'RUN_STATE_CHANGED','CONTINUAR_AQUISICAO_COM_EVIDENCIA',
    v_run.stage,v_run.execution_status,v_decision,v_action,v_rationale,v_authority,v_approval,
    v_run.evidence_refs,v_run.unknowns,v_run.contradictions,v_next,'OPEN',null
  )
  on conflict (tenant_id,run_id,current_stage,current_execution_status,decision_class,recommended_action)
  do update set
    rationale=excluded.rationale,
    authority_required=excluded.authority_required,
    approval_state=case
      when public.pitsquad_decision_contract.approval_state in ('APPROVED','REJECTED','CANCELLED')
        then public.pitsquad_decision_contract.approval_state
      else excluded.approval_state
    end,
    evidence_refs=excluded.evidence_refs,
    unknowns=excluded.unknowns,
    contradictions=excluded.contradictions,
    next_expected_state=excluded.next_expected_state,
    status='OPEN'
  returning * into v_contract;

  return v_contract.id;
end;
$function$;

revoke all on function public.pitsquad_materialize_decision_contract_internal_v0(uuid,uuid) from public;

create or replace function public.pitsquad_a00_run_trigger_v0()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform public.pitsquad_materialize_decision_contract_internal_v0(new.tenant_id,new.id);
  return new;
end;
$function$;

drop trigger if exists trg_pitsquad_a00_run_decision on public.pitsquad_acquisition_run;
create trigger trg_pitsquad_a00_run_decision
after insert or update of stage,execution_status,acquisition_state,crm_state,outcome_state,interpretation_state,learning_state,unknowns,contradictions
on public.pitsquad_acquisition_run
for each row execute function public.pitsquad_a00_run_trigger_v0();

-- Backfill current runs.
select public.pitsquad_materialize_decision_contract_internal_v0(r.tenant_id,r.id)
from public.pitsquad_acquisition_run r;
