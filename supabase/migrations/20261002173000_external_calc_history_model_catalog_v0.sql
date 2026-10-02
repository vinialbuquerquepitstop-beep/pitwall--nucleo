-- External Calc — History Model Catalog V0
-- Tenant-scoped read projection for searchable model/configuration history.

create or replace function public.extcalc_history_model_catalog_v0(
  p_query text default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  m record;
  v_query text := nullif(pg_catalog.btrim(p_query), '');
  v_limit integer := pg_catalog.least(pg_catalog.greatest(p_limit, 1), 100);
  v_result jsonb;
begin
  select * into m from privado.extcalc_product_membership_v0();
  if m.tenant_id is null then
    raise exception using errcode='42501', message='EXTCALC_PRODUCT_FORBIDDEN';
  end if;

  with valid as (
    select
      r.c01_snapshot #>> '{reviewed_offer,model,id}' as model_id,
      r.c01_snapshot #>> '{reviewed_offer,model,label}' as model_label,
      case
        when (r.c01_snapshot #>> '{reviewed_offer,capacity_gb}') ~ '^[0-9]+$'
          then (r.c01_snapshot #>> '{reviewed_offer,capacity_gb}')::integer
        else null
      end as capacity_gb,
      nullif(r.c01_snapshot #>> '{reviewed_offer,color}', '') as color,
      nullif(r.c01_snapshot #>> '{reviewed_offer,condition}', '') as condition,
      nullif(r.c01_snapshot #>> '{reviewed_offer,supplier_id}', '') as supplier_id,
      (r.c01_snapshot #>> '{reviewed_offer,price,amount_minor}')::bigint as amount_minor,
      r.criado_em as observed_at,
      r.freshness_status
    from public.extcalc_offer_revision r
    where r.tenant_id = m.tenant_id
      and r.domain_outcome = 'VALID'
      and r.c01_snapshot->>'execution_status' = 'SUCCEEDED'
      and nullif(r.c01_snapshot #>> '{reviewed_offer,model,id}', '') is not null
      and nullif(r.c01_snapshot #>> '{reviewed_offer,model,label}', '') is not null
      and nullif(r.c01_snapshot #>> '{reviewed_offer,supplier_id}', '') is not null
      and r.c01_snapshot #>> '{reviewed_offer,price,currency}' = 'BRL'
      and (r.c01_snapshot #>> '{reviewed_offer,price,amount_minor}') ~ '^[0-9]+$'
      and (r.c01_snapshot #>> '{reviewed_offer,price,amount_minor}')::bigint > 0
  ),
  matched as (
    select *
    from valid
    where v_query is null
      or pg_catalog.lower(model_label) like '%' || pg_catalog.lower(v_query) || '%'
      or pg_catalog.lower(model_id) like '%' || pg_catalog.lower(v_query) || '%'
  ),
  grouped as (
    select
      model_id,
      model_label,
      capacity_gb,
      color,
      condition,
      pg_catalog.count(distinct supplier_id)::integer as supplier_count,
      pg_catalog.count(*)::integer as observation_count,
      pg_catalog.min(observed_at) as first_observed_at,
      pg_catalog.max(observed_at) as last_observed_at,
      pg_catalog.min(amount_minor) filter (where freshness_status = 'CURRENT') as current_lowest_amount_minor
    from matched
    group by model_id, model_label, capacity_gb, color, condition
  ),
  limited as (
    select *
    from grouped
    order by last_observed_at desc, model_label asc, capacity_gb nulls last, color nulls last
    limit v_limit
  )
  select pg_catalog.jsonb_build_object(
    'catalog_version', 'external-calc-history-model-catalog/v0',
    'query', v_query,
    'items', pg_catalog.coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'model_id', l.model_id,
          'model_label', l.model_label,
          'capacity_gb', l.capacity_gb,
          'color', l.color,
          'condition', l.condition,
          'supplier_count', l.supplier_count,
          'observation_count', l.observation_count,
          'first_observed_at', l.first_observed_at,
          'last_observed_at', l.last_observed_at,
          'current_lowest_price', case
            when l.current_lowest_amount_minor is null then null
            else pg_catalog.jsonb_build_object(
              'amount_minor', l.current_lowest_amount_minor,
              'currency', 'BRL'
            )
          end
        )
        order by l.last_observed_at desc, l.model_label asc
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from limited l;

  return v_result;
end;
$$;

revoke all on function public.extcalc_history_model_catalog_v0(text,integer)
  from public, anon, authenticated;
grant execute on function public.extcalc_history_model_catalog_v0(text,integer)
  to authenticated;
