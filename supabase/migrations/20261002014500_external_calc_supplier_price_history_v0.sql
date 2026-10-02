-- External Calc — Supplier Price History Projection V0
-- Read-only tenant-scoped projection over immutable C01 offer revisions.
-- No duplicated price history is created here.

create or replace function public.extcalc_supplier_price_history_v0(
  p_model_id text,
  p_days integer default 7,
  p_capacity_gb integer default null,
  p_color text default null,
  p_condition text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  m record;
  v_model_id text := nullif(pg_catalog.btrim(p_model_id), '');
  v_color text := nullif(pg_catalog.btrim(p_color), '');
  v_condition text := nullif(pg_catalog.btrim(p_condition), '');
  v_started_at timestamptz;
  v_result jsonb;
begin
  select * into m from privado.extcalc_product_membership_v0();
  if m.tenant_id is null then
    raise exception using errcode='42501', message='EXTCALC_PRODUCT_FORBIDDEN';
  end if;

  if v_model_id is null
     or p_days not in (7,15,30)
     or (p_capacity_gb is not null and p_capacity_gb <= 0)
  then
    raise exception using errcode='22023', message='SUPPLIER_PRICE_HISTORY_INVALID';
  end if;

  v_started_at := pg_catalog.now() - pg_catalog.make_interval(days => p_days);

  with raw as (
    select
      nullif(r.c01_snapshot #>> '{reviewed_offer,supplier_id}', '') as supplier_id,
      (r.c01_snapshot #>> '{reviewed_offer,price,amount_minor}')::bigint as amount_minor,
      r.criado_em as observed_at,
      r.analysis_id,
      r.offer_id,
      r.offer_revision,
      r.offer_value_fingerprint,
      r.freshness_status,
      nullif(r.c01_snapshot #>> '{reviewed_offer,color}', '') as color,
      nullif(r.c01_snapshot #>> '{reviewed_offer,condition}', '') as condition
    from public.extcalc_offer_revision r
    where r.tenant_id = m.tenant_id
      and r.domain_outcome = 'VALID'
      and r.c01_snapshot->>'execution_status' = 'SUCCEEDED'
      and r.c01_snapshot #>> '{reviewed_offer,model,id}' = v_model_id
      and (p_capacity_gb is null or r.c01_snapshot #>> '{reviewed_offer,capacity_gb}' = p_capacity_gb::text)
      and (v_color is null or pg_catalog.lower(r.c01_snapshot #>> '{reviewed_offer,color}') = pg_catalog.lower(v_color))
      and (v_condition is null or pg_catalog.lower(r.c01_snapshot #>> '{reviewed_offer,condition}') = pg_catalog.lower(v_condition))
      and r.c01_snapshot #>> '{reviewed_offer,price,currency}' = 'BRL'
      and (r.c01_snapshot #>> '{reviewed_offer,price,amount_minor}') ~ '^[0-9]+$'
      and (r.c01_snapshot #>> '{reviewed_offer,price,amount_minor}')::bigint > 0
      and nullif(r.c01_snapshot #>> '{reviewed_offer,supplier_id}', '') is not null
  ),
  current_candidates as (
    select *,
      pg_catalog.row_number() over (
        partition by supplier_id
        order by amount_minor asc, observed_at desc, offer_revision desc
      ) as supplier_choice
    from raw
    where freshness_status = 'CURRENT'
  ),
  current_rows as (
    select *
    from current_candidates
    where supplier_choice = 1
  ),
  ranked_current as (
    select *,
      pg_catalog.row_number() over (
        order by amount_minor asc, supplier_id asc
      )::integer as current_rank
    from current_rows
  ),
  supplier_projection as (
    select
      cur.supplier_id,
      cur.amount_minor as current_amount_minor,
      cur.current_rank,
      cur.observed_at as current_observed_at,
      cur.analysis_id as current_analysis_id,
      cur.offer_id as current_offer_id,
      cur.offer_revision as current_offer_revision,
      base.amount_minor as baseline_amount_minor,
      base.observed_at as baseline_observed_at,
      case
        when base.amount_minor is null then null
        else cur.amount_minor - base.amount_minor
      end as delta_amount_minor,
      case
        when base.amount_minor is null or base.amount_minor = 0 then null
        else pg_catalog.round(
          ((cur.amount_minor - base.amount_minor)::numeric / base.amount_minor::numeric) * 100,
          2
        )
      end as delta_percent,
      case
        when base.amount_minor is null then 'INSUFFICIENT_DATA'
        when cur.amount_minor < base.amount_minor then 'DOWN'
        when cur.amount_minor > base.amount_minor then 'UP'
        else 'UNCHANGED'
      end as direction,
      (
        select pg_catalog.coalesce(
          pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'amount_minor', p.amount_minor,
              'currency', 'BRL',
              'observed_at', p.observed_at,
              'analysis_id', p.analysis_id,
              'offer_id', p.offer_id,
              'offer_revision', p.offer_revision
            )
            order by p.observed_at asc, p.offer_revision asc
          ),
          '[]'::jsonb
        )
        from (
          select q.*
          from raw q
          where q.supplier_id = cur.supplier_id
            and q.observed_at >= v_started_at
          order by q.observed_at asc, q.offer_revision asc
        ) p
      ) as points
    from ranked_current cur
    left join lateral (
      select b.amount_minor, b.observed_at
      from raw b
      where b.supplier_id = cur.supplier_id
      order by
        case when b.observed_at <= v_started_at then 0 else 1 end,
        case when b.observed_at <= v_started_at then b.observed_at end desc,
        case when b.observed_at > v_started_at then b.observed_at end asc,
        b.offer_revision desc
      limit 1
    ) base on true
  ),
  supplier_json as (
    select
      p.*,
      pg_catalog.jsonb_build_object(
        'supplier_id', p.supplier_id,
        'current_rank', p.current_rank,
        'current_price', pg_catalog.jsonb_build_object(
          'amount_minor', p.current_amount_minor,
          'currency', 'BRL'
        ),
        'baseline_price', case
          when p.baseline_amount_minor is null then null
          else pg_catalog.jsonb_build_object(
            'amount_minor', p.baseline_amount_minor,
            'currency', 'BRL'
          )
        end,
        'delta_amount_minor', p.delta_amount_minor,
        'delta_percent', p.delta_percent,
        'direction', p.direction,
        'baseline_observed_at', p.baseline_observed_at,
        'current_observed_at', p.current_observed_at,
        'current_offer', pg_catalog.jsonb_build_object(
          'analysis_id', p.current_analysis_id,
          'offer_id', p.current_offer_id,
          'offer_revision', p.current_offer_revision
        ),
        'points', p.points
      ) as item
    from supplier_projection p
  ),
  summary as (
    select
      (select item from supplier_json order by current_rank asc limit 1) as current_cheapest,
      (select item from supplier_json where delta_amount_minor < 0 order by delta_amount_minor asc, current_rank asc limit 1) as biggest_drop,
      (select item from supplier_json where delta_amount_minor > 0 order by delta_amount_minor desc, current_rank asc limit 1) as biggest_increase,
      (select count(*)::integer from supplier_json) as supplier_count
  )
  select pg_catalog.jsonb_build_object(
    'history_version', 'external-calc-supplier-price-history/v0',
    'selection', pg_catalog.jsonb_build_object(
      'model_id', v_model_id,
      'capacity_gb', p_capacity_gb,
      'color', v_color,
      'condition', v_condition,
      'days', p_days
    ),
    'period', pg_catalog.jsonb_build_object(
      'started_at', v_started_at,
      'ended_at', pg_catalog.now()
    ),
    'summary', pg_catalog.jsonb_build_object(
      'supplier_count', s.supplier_count,
      'current_cheapest', s.current_cheapest,
      'biggest_drop', s.biggest_drop,
      'biggest_increase', s.biggest_increase
    ),
    'suppliers', (
      select pg_catalog.coalesce(
        pg_catalog.jsonb_agg(j.item order by j.current_rank asc),
        '[]'::jsonb
      )
      from supplier_json j
    )
  )
  into v_result
  from summary s;

  return v_result;
end;
$$;

revoke all on function public.extcalc_supplier_price_history_v0(text,integer,integer,text,text)
  from public, anon, authenticated;
grant execute on function public.extcalc_supplier_price_history_v0(text,integer,integer,text,text)
  to authenticated;
