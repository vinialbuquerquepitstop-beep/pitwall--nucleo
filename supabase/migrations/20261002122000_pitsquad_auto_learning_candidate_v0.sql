-- PITSQUAD Auto Learning Candidate V0
-- Deterministically materializes RUN/OBSERVED candidates from observed outcomes.
-- Never promotes knowledge and never infers causality.

create or replace function public.pitsquad_materialize_learning_candidate_internal_v0(
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
  v_sales_count integer := 0;
  v_outcome text;
  v_claim text;
  v_limits jsonb;
  v_refs jsonb;
  v_candidate public.pitsquad_learning_candidate%rowtype;
begin
  select * into v_input
  from public.pitsquad_acquisition_input
  where id=p_input_id and tenant_id=p_tenant;

  if not found or v_input.status <> 'LINKED' or v_input.lead_id is null then
    return null;
  end if;

  select count(*)::int into v_sales_count
  from public.venda
  where tenant_id=p_tenant
    and lead_id=v_input.lead_id
    and arquivado_em is null
    and coalesce(status,'') <> 'cancelada';

  v_outcome := case when v_sales_count>0 then 'SALE_OBSERVED' else 'NO_SALE_OBSERVED' end;

  if v_input.input_mode='TEST' then
    v_claim := 'Fluxo técnico de aquisição executado com sucesso; o resultado não representa desempenho real de aquisição.';
    v_limits := jsonb_build_array(
      'TEST_INPUT',
      'NOT_REAL_CUSTOMER_ACQUISITION',
      'NOT_ELIGIBLE_FOR_PERFORMANCE_LEARNING'
    );
  elsif v_sales_count>0 then
    v_claim := 'Venda observada em lead atribuído a esta entrada; causalidade da aquisição não é inferida.';
    v_limits := jsonb_build_array(
      'SINGLE_INPUT',
      'CORRELATION_NOT_CAUSATION',
      'NO_AUTOMATIC_PROMOTION'
    );
  else
    v_claim := 'Nenhuma venda foi observada para este lead neste momento; isso não prova falha da aquisição.';
    v_limits := jsonb_build_array(
      'SINGLE_INPUT',
      'NO_SALE_OBSERVED_IS_NOT_ACQUISITION_FAILURE',
      'CORRELATION_NOT_CAUSATION',
      'NO_AUTOMATIC_PROMOTION'
    );
  end if;

  v_refs := jsonb_build_array(
    'AcquisitionInput:'||v_input.id::text,
    'Lead:'||v_input.lead_id::text
  );

  insert into public.pitsquad_learning_candidate(
    tenant_id,input_id,input_mode,scope,epistemic_class,outcome_state,
    decision_class,claim,limitations,evidence_refs,promotion_eligible,status,created_by
  )
  values(
    p_tenant,v_input.id,v_input.input_mode,'RUN','OBSERVED',v_outcome,
    'OBSERVE',v_claim,v_limits,v_refs,false,'CANDIDATE',null
  )
  on conflict (tenant_id,input_id,outcome_state)
  do nothing
  returning * into v_candidate;

  if v_candidate.id is null then
    select * into v_candidate
    from public.pitsquad_learning_candidate
    where tenant_id=p_tenant
      and input_id=v_input.id
      and outcome_state=v_outcome
    limit 1;
  end if;

  return v_candidate.id;
end;
$function$;

revoke all on function public.pitsquad_materialize_learning_candidate_internal_v0(uuid,uuid) from public;

create or replace function public.pitsquad_acquisition_run_input_trigger_v0()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform public.pitsquad_refresh_acquisition_run_internal_v0(new.tenant_id,new.id);

  if new.status='LINKED' and new.lead_id is not null then
    perform public.pitsquad_materialize_learning_candidate_internal_v0(new.tenant_id,new.id);
  end if;

  return new;
end;
$function$;

-- Backfill eligible linked inputs.
select public.pitsquad_materialize_learning_candidate_internal_v0(i.tenant_id,i.id)
from public.pitsquad_acquisition_input i
where i.status='LINKED'
  and i.lead_id is not null;

-- Refresh runs after candidate backfill.
select public.pitsquad_refresh_acquisition_run_internal_v0(i.tenant_id,i.id)
from public.pitsquad_acquisition_input i
where i.status='LINKED'
  and i.lead_id is not null;
