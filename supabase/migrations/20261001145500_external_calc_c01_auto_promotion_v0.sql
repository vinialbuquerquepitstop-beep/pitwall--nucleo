-- External Calc C01 Auto Promotion V0.
-- Persiste C01 VALID produzido por autoridade automatica separada da HumanReview.
-- Nao cria registro em extcalc_human_review.

create or replace function public.extcalc_persist_auto_promoted_c01_v0(p_promoted jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $auto_promote$
declare
  v_tenant uuid;
  v_papel text;
  v_analysis_id text;
  v_source_id text;
  v_offer_id text;
  v_offer_revision integer;
  v_contract_version text;
  v_identity_fp text;
  v_value_fp text;
  v_existing_source text;
  v_existing jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='EXTCALC_UNAUTHENTICATED';
  end if;

  v_tenant := privado.fn_tenant_atual();
  v_papel := privado.fn_papel_atual();
  if v_tenant is null then raise exception using errcode='42501', message='EXTCALC_TENANT_UNAVAILABLE'; end if;
  if v_papel is distinct from 'dono' then raise exception using errcode='42501', message='EXTCALC_FORBIDDEN'; end if;

  if p_promoted is null or jsonb_typeof(p_promoted) <> 'object' then
    raise exception 'EXTCALC_AUTO_PROMOTION_INVALID';
  end if;

  v_analysis_id := nullif(pg_catalog.btrim(p_promoted->>'analysis_id'),'');
  v_source_id := nullif(pg_catalog.btrim(p_promoted->>'source_id'),'');
  v_offer_id := nullif(pg_catalog.btrim(p_promoted->>'offer_id'),'');
  v_offer_revision := nullif(p_promoted->>'offer_revision','')::integer;
  v_contract_version := nullif(pg_catalog.btrim(p_promoted->>'contract_version'),'');
  v_identity_fp := nullif(pg_catalog.btrim(p_promoted->>'offer_identity_fingerprint'),'');
  v_value_fp := nullif(pg_catalog.btrim(p_promoted->>'offer_value_fingerprint'),'');

  if v_analysis_id is null or v_source_id is null or v_offer_id is null or v_offer_revision is null
     or v_contract_version is null or v_identity_fp is null or v_value_fp is null then
    raise exception 'EXTCALC_AUTO_PROMOTION_INCOMPLETE';
  end if;

  if v_contract_version is distinct from 'external-calc-c01-readonly/v1'
     or p_promoted->>'execution_status' is distinct from 'SUCCEEDED'
     or p_promoted->>'freshness_status' is distinct from 'CURRENT'
     or p_promoted->>'domain_outcome' is distinct from 'VALID'
     or p_promoted->'review' is distinct from 'null'::jsonb
     or p_promoted->'reviewed_offer' is null
     or p_promoted->'reviewed_offer' = 'null'::jsonb
     or p_promoted->'auto_promotion'->>'decision' is distinct from 'AUTO_PROMOTE'
     or p_promoted->'auto_promotion'->>'authority_version' is distinct from 'external-calc-c01-auto-promotion/v0' then
    raise exception 'EXTCALC_AUTO_PROMOTION_STATE_INVALID';
  end if;

  insert into public.extcalc_analysis(tenant_id,analysis_id)
  values(v_tenant,v_analysis_id)
  on conflict (tenant_id,analysis_id) do nothing;

  insert into public.extcalc_offer(tenant_id,analysis_id,offer_id,source_id)
  values(v_tenant,v_analysis_id,v_offer_id,v_source_id)
  on conflict (tenant_id,analysis_id,offer_id) do nothing;

  select source_id into v_existing_source
  from public.extcalc_offer
  where tenant_id=v_tenant and analysis_id=v_analysis_id and offer_id=v_offer_id;

  if v_existing_source is distinct from v_source_id then raise exception 'EXTCALC_OFFER_ID_CONFLICT'; end if;

  select c01_snapshot into v_existing
  from public.extcalc_offer_revision
  where tenant_id=v_tenant and analysis_id=v_analysis_id
    and offer_id=v_offer_id and offer_revision=v_offer_revision;

  if found then
    if v_existing is distinct from p_promoted then raise exception 'EXTCALC_AUTO_PROMOTION_CONFLICT'; end if;
    return pg_catalog.jsonb_build_object(
      'ok',true,'analysis_id',v_analysis_id,'offer_id',v_offer_id,
      'offer_revision',v_offer_revision,'idempotent',true
    );
  end if;

  insert into public.extcalc_offer_revision(
    tenant_id,analysis_id,offer_id,offer_revision,
    c01_contract_version,c01_snapshot,
    offer_identity_fingerprint,offer_value_fingerprint,
    domain_outcome,freshness_status
  ) values (
    v_tenant,v_analysis_id,v_offer_id,v_offer_revision,
    v_contract_version,p_promoted,
    v_identity_fp,v_value_fp,
    'VALID','CURRENT'
  );

  return pg_catalog.jsonb_build_object(
    'ok',true,'analysis_id',v_analysis_id,'offer_id',v_offer_id,
    'offer_revision',v_offer_revision,'idempotent',false
  );
end;
$auto_promote$;

revoke all on function public.extcalc_persist_auto_promoted_c01_v0(jsonb)
from public, anon, authenticated;
grant execute on function public.extcalc_persist_auto_promoted_c01_v0(jsonb)
to authenticated;

create or replace function public.extcalc_list_pending_review_candidates_v0(
  p_limit integer default 50
)
returns table(candidate_snapshot jsonb, criado_em timestamptz)
language plpgsql
security definer
set search_path = ''
as $pending$
declare
  v_tenant uuid;
  v_papel text;
  v_limit integer;
begin
  if auth.uid() is null then raise exception using errcode='42501', message='EXTCALC_UNAUTHENTICATED'; end if;
  v_tenant := privado.fn_tenant_atual();
  v_papel := privado.fn_papel_atual();
  if v_tenant is null then raise exception using errcode='42501', message='EXTCALC_TENANT_UNAVAILABLE'; end if;
  if v_papel is distinct from 'dono' then raise exception using errcode='42501', message='EXTCALC_FORBIDDEN'; end if;

  v_limit := coalesce(p_limit,50);
  if v_limit < 1 or v_limit > 100 then raise exception 'EXTCALC_REVIEW_QUEUE_LIMIT_INVALID'; end if;

  return query
  select c.candidate_snapshot,c.criado_em
  from public.extcalc_review_candidate c
  where c.tenant_id=v_tenant
    and not exists (
      select 1 from public.extcalc_human_review h
      where h.tenant_id=c.tenant_id
        and h.analysis_id=c.analysis_id
        and h.offer_id=c.offer_id
        and coalesce(nullif(h.review_snapshot->>'original_offer_revision','')::integer,h.offer_revision)=c.offer_revision
    )
    and not exists (
      select 1 from public.extcalc_offer_revision r
      where r.tenant_id=c.tenant_id
        and r.analysis_id=c.analysis_id
        and r.offer_id=c.offer_id
        and r.offer_revision=c.offer_revision
        and r.domain_outcome='VALID'
        and r.c01_snapshot->'auto_promotion'->>'decision'='AUTO_PROMOTE'
    )
  order by c.criado_em asc
  limit v_limit;
end;
$pending$;

revoke all on function public.extcalc_list_pending_review_candidates_v0(integer)
from public, anon, authenticated;
grant execute on function public.extcalc_list_pending_review_candidates_v0(integer)
to authenticated;
