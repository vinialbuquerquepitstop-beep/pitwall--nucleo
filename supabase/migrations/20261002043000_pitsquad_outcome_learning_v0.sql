-- PITSQUAD Outcome Interpretation + Learning Candidate V0
-- Deterministic D09/D10 bridge. No causal inference, no automatic promotion.

create table if not exists public.pitsquad_learning_candidate (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id),
  input_id uuid not null references public.pitsquad_acquisition_input(id),
  input_mode text not null check (input_mode in ('REAL','TEST')),
  scope text not null default 'RUN' check (scope in ('RUN','CLIENT')),
  epistemic_class text not null default 'OBSERVED'
    check (epistemic_class in ('OBSERVED','UNKNOWN','CONTRADICTION')),
  outcome_state text not null,
  decision_class text not null
    check (decision_class in ('OBSERVE','INVESTIGATE')),
  claim text not null,
  limitations jsonb not null default '[]'::jsonb,
  evidence_refs jsonb not null default '[]'::jsonb,
  promotion_eligible boolean not null default false,
  status text not null default 'CANDIDATE'
    check (status in ('CANDIDATE','RETAINED','REJECTED')),
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (tenant_id,input_id,outcome_state)
);

alter table public.pitsquad_learning_candidate enable row level security;

drop policy if exists pitsquad_learning_candidate_select on public.pitsquad_learning_candidate;
create policy pitsquad_learning_candidate_select
on public.pitsquad_learning_candidate
for select to authenticated
using (tenant_id=privado.fn_tenant_atual());

drop policy if exists pitsquad_learning_candidate_insert on public.pitsquad_learning_candidate;
create policy pitsquad_learning_candidate_insert
on public.pitsquad_learning_candidate
for insert to authenticated
with check (tenant_id=privado.fn_tenant_atual());

grant select, insert on table public.pitsquad_learning_candidate to authenticated;

create or replace function public.pitsquad_interpret_acquisition_input_v0(
  p_input_id uuid
)
returns jsonb
language plpgsql
set search_path to 'public','privado'
as $function$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_input public.pitsquad_acquisition_input%rowtype;
  v_sales_count integer := 0;
  v_revenue numeric := 0;
  v_gross numeric := 0;
  v_outcome text;
  v_decision text;
  v_claim text;
  v_limits jsonb := '[]'::jsonb;
  v_refs jsonb := '[]'::jsonb;
  v_promotion boolean := false;
  v_candidate public.pitsquad_learning_candidate%rowtype;
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

  if v_input.status <> 'LINKED' or v_input.lead_id is null then
    return jsonb_build_object(
      'ok',true,
      'state','NO_LINKED_LEAD',
      'decision_class','INVESTIGATE',
      'promotion_eligible',false
    );
  end if;

  select
    count(*)::int,
    coalesce(sum(valor_venda),0),
    coalesce(sum(
      valor_venda
      - coalesce(custo_aparelho,0)
      - coalesce(despesa_frete,0)
      - coalesce(despesa_taxas,0)
    ),0)
  into v_sales_count,v_revenue,v_gross
  from public.venda
  where tenant_id=v_tenant
    and lead_id=v_input.lead_id
    and arquivado_em is null
    and coalesce(status,'') <> 'cancelada';

  v_outcome := case when v_sales_count>0 then 'SALE_OBSERVED' else 'NO_SALE_OBSERVED' end;
  v_decision := 'OBSERVE';

  v_refs := jsonb_build_array(
    'AcquisitionInput:'||v_input.id::text,
    'Lead:'||v_input.lead_id::text
  );

  if v_input.input_mode='TEST' then
    v_claim := 'Fluxo técnico de aquisição executado com sucesso; o resultado não representa desempenho real de aquisição.';
    v_limits := jsonb_build_array(
      'TEST_INPUT',
      'NOT_REAL_CUSTOMER_ACQUISITION',
      'NOT_ELIGIBLE_FOR_PERFORMANCE_LEARNING'
    );
    v_promotion := false;
  elsif v_sales_count>0 then
    v_claim := 'Venda observada em lead atribuído a esta entrada; causalidade da aquisição não é inferida.';
    v_limits := jsonb_build_array(
      'SINGLE_INPUT',
      'CORRELATION_NOT_CAUSATION',
      'NO_AUTOMATIC_PROMOTION'
    );
    v_promotion := false;
  else
    v_claim := 'Nenhuma venda foi observada para este lead neste momento; isso não prova falha da aquisição.';
    v_limits := jsonb_build_array(
      'SINGLE_INPUT',
      'NO_SALE_OBSERVED_IS_NOT_ACQUISITION_FAILURE',
      'CORRELATION_NOT_CAUSATION',
      'NO_AUTOMATIC_PROMOTION'
    );
    v_promotion := false;
  end if;

  insert into public.pitsquad_learning_candidate(
    tenant_id,input_id,input_mode,scope,epistemic_class,outcome_state,
    decision_class,claim,limitations,evidence_refs,promotion_eligible,status,created_by
  )
  values(
    v_tenant,v_input.id,v_input.input_mode,'RUN','OBSERVED',v_outcome,
    v_decision,v_claim,v_limits,v_refs,v_promotion,'CANDIDATE',auth.uid()
  )
  on conflict (tenant_id,input_id,outcome_state)
  do nothing
  returning * into v_candidate;

  if v_candidate.id is null then
    select * into v_candidate
    from public.pitsquad_learning_candidate
    where tenant_id=v_tenant
      and input_id=v_input.id
      and outcome_state=v_outcome
    limit 1;
  end if;

  return jsonb_build_object(
    'ok',true,
    'state','READY',
    'input_mode',v_input.input_mode,
    'outcome_state',v_outcome,
    'sales_count',v_sales_count,
    'revenue_observed',v_revenue,
    'gross_result_observed',v_gross,
    'decision_class',v_decision,
    'epistemic_class','OBSERVED',
    'claim',v_claim,
    'limitations',v_limits,
    'learning_candidate_id',v_candidate.id,
    'promotion_eligible',v_candidate.promotion_eligible,
    'learning_status',v_candidate.status
  );
end;
$function$;

revoke all on function public.pitsquad_interpret_acquisition_input_v0(uuid) from public;
grant execute on function public.pitsquad_interpret_acquisition_input_v0(uuid) to authenticated;
