-- External Calc — Movement Feed Projection V0
-- Tenant-scoped read projection for the approved Movimentacao screen.
-- It derives movement from immutable C01 revisions and only surfaces existing C02/C04/C05 facts.

create or replace function public.extcalc_movement_feed_v0(
  p_days integer default 7
)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  m record;
  v_started_at timestamptz;
  v_result jsonb;
begin
  select * into m from privado.extcalc_product_membership_v0();
  if m.tenant_id is null then
    raise exception using errcode='42501', message='EXTCALC_PRODUCT_FORBIDDEN';
  end if;

  if p_days not in (7,15,30) then
    raise exception using errcode='22023', message='MOVEMENT_FEED_INVALID';
  end if;

  v_started_at := pg_catalog.now() - pg_catalog.make_interval(days => p_days);

  with raw as (
    select
      r.analysis_id,
      r.offer_id,
      r.offer_revision,
      r.offer_identity_fingerprint,
      r.offer_value_fingerprint,
      r.criado_em as observed_at,
      r.freshness_status,
      r.c01_snapshot,
      r.c01_snapshot #>> '{reviewed_offer,model,id}' as model_id,
      pg_catalog.coalesce(
        nullif(r.c01_snapshot #>> '{reviewed_offer,model,label}', ''),
        nullif(r.c01_snapshot #>> '{reviewed_offer,model,attributes,display_label}', ''),
        nullif(r.c01_snapshot #>> '{reviewed_offer,model,id}', '')
      ) as model_label,
      case
        when (r.c01_snapshot #>> '{reviewed_offer,capacity_gb}') ~ '^[0-9]+$'
        then (r.c01_snapshot #>> '{reviewed_offer,capacity_gb}')::integer
        else null
      end as capacity_gb,
      nullif(r.c01_snapshot #>> '{reviewed_offer,color}', '') as color,
      nullif(r.c01_snapshot #>> '{reviewed_offer,condition}', '') as condition,
      nullif(r.c01_snapshot #>> '{reviewed_offer,supplier_id}', '') as supplier_id,
      (r.c01_snapshot #>> '{reviewed_offer,price,amount_minor}')::bigint as amount_minor
    from public.extcalc_offer_revision r
    where r.tenant_id = m.tenant_id
      and r.domain_outcome = 'VALID'
      and r.c01_snapshot->>'execution_status' = 'SUCCEEDED'
      and r.c01_snapshot #>> '{reviewed_offer,price,currency}' = 'BRL'
      and (r.c01_snapshot #>> '{reviewed_offer,price,amount_minor}') ~ '^[0-9]+$'
      and (r.c01_snapshot #>> '{reviewed_offer,price,amount_minor}')::bigint > 0
      and nullif(r.c01_snapshot #>> '{reviewed_offer,model,id}', '') is not null
      and nullif(r.c01_snapshot #>> '{reviewed_offer,supplier_id}', '') is not null
  ),
  current_candidates as (
    select
      q.*,
      pg_catalog.row_number() over (
        partition by
          q.model_id,
          q.capacity_gb,
          pg_catalog.lower(pg_catalog.coalesce(q.color,'')),
          pg_catalog.lower(pg_catalog.coalesce(q.condition,'')),
          q.supplier_id
        order by q.observed_at desc, q.offer_revision desc
      ) as rn
    from raw q
    where q.freshness_status = 'CURRENT'
  ),
  current_rows as (
    select * from current_candidates where rn = 1
  ),
  movement_rows as (
    select
      cur.*,
      prev.amount_minor as previous_amount_minor,
      prev.observed_at as previous_observed_at,
      case
        when prev.amount_minor is null then null
        else cur.amount_minor - prev.amount_minor
      end as delta_amount_minor,
      case
        when prev.amount_minor is null or prev.amount_minor = 0 then null
        else pg_catalog.round(((cur.amount_minor-prev.amount_minor)::numeric/prev.amount_minor::numeric)*100,2)
      end as delta_percent,
      case
        when prev.amount_minor is null then 'INSUFFICIENT_DATA'
        when cur.amount_minor < prev.amount_minor then 'DOWN'
        when cur.amount_minor > prev.amount_minor then 'UP'
        else 'UNCHANGED'
      end as direction
    from current_rows cur
    left join lateral (
      select q.amount_minor,q.observed_at
      from raw q
      where q.model_id = cur.model_id
        and q.supplier_id = cur.supplier_id
        and q.capacity_gb is not distinct from cur.capacity_gb
        and pg_catalog.lower(pg_catalog.coalesce(q.color,'')) = pg_catalog.lower(pg_catalog.coalesce(cur.color,''))
        and pg_catalog.lower(pg_catalog.coalesce(q.condition,'')) = pg_catalog.lower(pg_catalog.coalesce(cur.condition,''))
        and (q.analysis_id,q.offer_id,q.offer_revision) <> (cur.analysis_id,cur.offer_id,cur.offer_revision)
        and q.observed_at >= v_started_at
        and q.observed_at <= cur.observed_at
      order by q.observed_at desc,q.offer_revision desc
      limit 1
    ) prev on true
  ),
  enriched as (
    select
      mv.*,
      s.name as supplier_name,
      c02.output_snapshot as c02,
      c04.output_snapshot as c04,
      c05.output_snapshot as c05
    from movement_rows mv
    left join public.extcalc_supplier s
      on s.tenant_id = m.tenant_id
     and s.supplier_id::text = mv.supplier_id
    left join lateral (
      select x.output_snapshot
      from public.extcalc_run x
      where x.tenant_id = m.tenant_id
        and x.analysis_id = mv.analysis_id
        and x.offer_id = mv.offer_id
        and x.offer_revision = mv.offer_revision
        and x.contract_id = 'C02'
        and x.execution_status = 'SUCCEEDED'
        and x.freshness_status = 'CURRENT'
      order by x.criado_em desc
      limit 1
    ) c02 on true
    left join lateral (
      select x.output_snapshot
      from public.extcalc_run x
      where x.tenant_id = m.tenant_id
        and x.analysis_id = mv.analysis_id
        and x.offer_id = mv.offer_id
        and x.offer_revision = mv.offer_revision
        and x.contract_id = 'C04'
        and x.execution_status = 'SUCCEEDED'
        and x.freshness_status = 'CURRENT'
      order by x.criado_em desc
      limit 1
    ) c04 on true
    left join lateral (
      select x.output_snapshot
      from public.extcalc_run x
      where x.tenant_id = m.tenant_id
        and x.analysis_id = mv.analysis_id
        and x.offer_id = mv.offer_id
        and x.offer_revision = mv.offer_revision
        and x.contract_id = 'C05'
        and x.execution_status = 'SUCCEEDED'
        and x.freshness_status = 'CURRENT'
      order by x.criado_em desc
      limit 1
    ) c05 on true
  )
  select pg_catalog.jsonb_build_object(
    'movement_version','external-calc-movement-feed/v0',
    'period',pg_catalog.jsonb_build_object(
      'days',p_days,
      'started_at',v_started_at,
      'ended_at',pg_catalog.now()
    ),
    'items',pg_catalog.coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'analysis_id',e.analysis_id,
          'offer_id',e.offer_id,
          'offer_revision',e.offer_revision,
          'model',pg_catalog.jsonb_build_object(
            'id',e.model_id,
            'label',e.model_label,
            'capacity_gb',e.capacity_gb,
            'color',e.color,
            'condition',e.condition
          ),
          'supplier',pg_catalog.jsonb_build_object(
            'supplier_id',e.supplier_id,
            'name',pg_catalog.coalesce(e.supplier_name,e.supplier_id)
          ),
          'current_price',pg_catalog.jsonb_build_object(
            'amount_minor',e.amount_minor,
            'currency','BRL'
          ),
          'previous_price',case when e.previous_amount_minor is null then null else pg_catalog.jsonb_build_object(
            'amount_minor',e.previous_amount_minor,
            'currency','BRL'
          ) end,
          'delta_amount_minor',e.delta_amount_minor,
          'delta_percent',e.delta_percent,
          'direction',e.direction,
          'previous_observed_at',e.previous_observed_at,
          'current_observed_at',e.observed_at,
          'sale_price',case
            when e.c02 #>> '{normal_sale_price,currency}' = 'BRL'
             and (e.c02 #>> '{normal_sale_price,amount_minor}') ~ '^[0-9]+$'
            then pg_catalog.jsonb_build_object(
              'amount_minor',(e.c02 #>> '{normal_sale_price,amount_minor}')::bigint,
              'currency','BRL'
            )
            else null
          end,
          'promo_price',case
            when e.c02 #>> '{promo_price,currency}' = 'BRL'
             and (e.c02 #>> '{promo_price,amount_minor}') ~ '^[0-9]+$'
            then pg_catalog.jsonb_build_object(
              'amount_minor',(e.c02 #>> '{promo_price,amount_minor}')::bigint,
              'currency','BRL'
            )
            else null
          end,
          'price_signal',nullif(e.c04->>'price_signal',''),
          'analysis_outcome',nullif(e.c05->>'domain_outcome',''),
          'freshness_status',e.freshness_status
        )
        order by e.observed_at desc,e.model_label asc,e.supplier_id asc
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from enriched e;

  return v_result;
end;
$$;

revoke all on function public.extcalc_movement_feed_v0(integer)
  from public, anon, authenticated;
grant execute on function public.extcalc_movement_feed_v0(integer)
  to authenticated;
