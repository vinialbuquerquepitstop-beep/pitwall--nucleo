-- External Calc Home Product Projection V1.
-- Read-only, tenant-scoped facts. SQL does not classify opportunities or calculate domain values.
create or replace function public.extcalc_product_home_context_v1()
returns setof jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare v_tenant uuid;
begin
  select m.tenant_id into v_tenant from privado.extcalc_product_membership_v0() m;
  if v_tenant is null then raise exception using errcode='42501',message='EXTCALC_PRODUCT_FORBIDDEN'; end if;
  return query
  select pg_catalog.jsonb_build_object(
    'c01',r.c01_snapshot,
    'c04',c04.output_snapshot,
    'c05',c05.output_snapshot,
    'updated_at',greatest(r.criado_em,coalesce(c05.criado_em,r.criado_em))
  )
  from public.extcalc_offer_revision r
  left join lateral (
    select x.output_snapshot,x.criado_em
    from public.extcalc_run x
    where x.tenant_id=r.tenant_id and x.analysis_id=r.analysis_id and x.offer_id=r.offer_id
      and x.offer_revision=r.offer_revision and x.contract_id='C04'
      and x.execution_status='SUCCEEDED' and x.freshness_status='CURRENT'
    order by x.criado_em desc limit 1
  ) c04 on true
  left join lateral (
    select x.output_snapshot,x.criado_em
    from public.extcalc_run x
    where x.tenant_id=r.tenant_id and x.analysis_id=r.analysis_id and x.offer_id=r.offer_id
      and x.offer_revision=r.offer_revision and x.contract_id='C05'
      and x.execution_status='SUCCEEDED' and x.freshness_status='CURRENT'
    order by x.criado_em desc limit 1
  ) c05 on true
  where r.tenant_id=v_tenant and r.freshness_status='CURRENT';
end;
$$;
revoke all on function public.extcalc_product_home_context_v1() from public, anon, authenticated;
grant execute on function public.extcalc_product_home_context_v1() to authenticated;
