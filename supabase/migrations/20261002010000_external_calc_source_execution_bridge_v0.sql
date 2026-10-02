-- External Calc source execution bridge V0.
-- Resolves the latest persisted execution for an exact authoritative offer lineage.
-- Tenant and actor membership are derived server-side.

create or replace function public.extcalc_product_source_execution_v0(
  p_analysis_id text,
  p_offer_id text,
  p_offer_revision integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_tenant uuid;
  v_result jsonb;
begin
  if nullif(pg_catalog.btrim(p_analysis_id), '') is null then
    raise exception using errcode='22023', message='analysis_id obrigatorio';
  end if;
  if nullif(pg_catalog.btrim(p_offer_id), '') is null then
    raise exception using errcode='22023', message='offer_id obrigatorio';
  end if;
  if p_offer_revision is null or p_offer_revision < 1 then
    raise exception using errcode='22023', message='offer_revision invalida';
  end if;

  select m.tenant_id
    into v_tenant
  from privado.extcalc_product_membership_v0() m;

  if v_tenant is null then
    raise exception using errcode='42501', message='EXTCALC_PRODUCT_FORBIDDEN';
  end if;

  select pg_catalog.jsonb_build_object(
    'source_execution_id', e.execution_id,
    'analysis_id', e.analysis_id,
    'offer_id', e.offer_id,
    'offer_revision', e.offer_revision,
    'execution_status', e.execution_status,
    'freshness_status', e.freshness_status,
    'created_at', e.criado_em
  )
  into v_result
  from public.extcalc_execution e
  where e.tenant_id = v_tenant
    and e.analysis_id = pg_catalog.btrim(p_analysis_id)
    and e.offer_id = pg_catalog.btrim(p_offer_id)
    and e.offer_revision = p_offer_revision
    and e.execution_status = 'SUCCEEDED'
    and e.freshness_status = 'CURRENT'
  order by e.criado_em desc, e.execution_id desc
  limit 1;

  return v_result;
end;
$$;

revoke all on function public.extcalc_product_source_execution_v0(text,text,integer)
  from public, anon, authenticated;
grant execute on function public.extcalc_product_source_execution_v0(text,text,integer)
  to authenticated;
