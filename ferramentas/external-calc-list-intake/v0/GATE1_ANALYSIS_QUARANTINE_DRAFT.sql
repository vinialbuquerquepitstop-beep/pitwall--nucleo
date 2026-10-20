-- PROPOSAL ONLY; NOT A PRODUCTION MIGRATION. USER APPROVED CODE AND ISOLATED TESTS ONLY.
-- Derived from read-only Supabase function definitions on 2026-10-20.
-- Requires authenticated staging, full consumer audit and separate human approval before deploy.

CREATE TABLE privado.extcalc_analysis_quarantine_v0 (
  tenant_id uuid NOT NULL,
  analysis_id text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 8 AND 1000),
  activated_by uuid NOT NULL,
  activated_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  revoked_by uuid,
  revoked_at timestamptz,
  PRIMARY KEY (tenant_id,analysis_id),
  CONSTRAINT quarantine_revocation_consistency CHECK (
    (active AND revoked_at IS NULL AND revoked_by IS NULL)
    OR (NOT active AND revoked_at IS NOT NULL AND revoked_by IS NOT NULL)
  )
);
CREATE TABLE privado.extcalc_analysis_quarantine_event_v0 (
  event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL,
  analysis_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('ACTIVATE','REVOKE')),
  actor uuid NOT NULL,
  reason text NOT NULL,
  candidate_count bigint NOT NULL,
  current_revision_count bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id,analysis_id)
    REFERENCES privado.extcalc_analysis_quarantine_v0(tenant_id,analysis_id)
);
CREATE INDEX quarantine_event_analysis_idx
 ON privado.extcalc_analysis_quarantine_event_v0(tenant_id,analysis_id,created_at);
ALTER TABLE privado.extcalc_analysis_quarantine_v0 ENABLE ROW LEVEL SECURITY;
ALTER TABLE privado.extcalc_analysis_quarantine_event_v0 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE privado.extcalc_analysis_quarantine_v0 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON TABLE privado.extcalc_analysis_quarantine_event_v0 FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.extcalc_set_analysis_quarantine_v0(
  p_analysis_id text,
  p_active boolean,
  p_reason text,
  p_expected_candidates bigint,
  p_expected_current_revisions bigint
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $quarantine$
DECLARE
  v_tenant uuid;
  v_actor uuid;
  v_status text;
  v_current boolean;
  v_candidates bigint;
  v_revisions bigint;
  v_lock text;
BEGIN
  v_actor:=auth.uid();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='EXTCALC_UNAUTHENTICATED';
  END IF;
  v_tenant:=privado.fn_tenant_atual();
  v_status:=privado.fn_papel_atual();
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='EXTCALC_TENANT_UNAVAILABLE';
  END IF;
  IF v_status IS DISTINCT FROM 'dono' THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='EXTCALC_FORBIDDEN';
  END IF;
  IF nullif(pg_catalog.btrim(p_analysis_id),'') IS NULL
     OR p_active IS NULL
     OR length(pg_catalog.btrim(coalesce(p_reason,''))) NOT BETWEEN 8 AND 1000
     OR p_expected_candidates IS NULL OR p_expected_candidates<1
     OR p_expected_current_revisions IS NULL OR p_expected_current_revisions<0
  THEN
    RAISE EXCEPTION 'EXTCALC_QUARANTINE_INVALID_COMMAND';
  END IF;

  -- Lock the parent analysis: concurrent activation/revocation of this key serializes.
  SELECT a.analysis_id INTO v_lock
  FROM public.extcalc_analysis a
  WHERE a.tenant_id=v_tenant AND a.analysis_id=p_analysis_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EXTCALC_QUARANTINE_ANALYSIS_NOT_FOUND';
  END IF;

  SELECT count(*) INTO v_candidates FROM public.extcalc_review_candidate c
   WHERE c.tenant_id=v_tenant AND c.analysis_id=p_analysis_id;
  SELECT count(*) INTO v_revisions FROM public.extcalc_offer_revision r
   WHERE r.tenant_id=v_tenant AND r.analysis_id=p_analysis_id
     AND r.domain_outcome='VALID' AND r.freshness_status='CURRENT';
  IF v_candidates IS DISTINCT FROM p_expected_candidates
    OR v_revisions IS DISTINCT FROM p_expected_current_revisions THEN
    RAISE EXCEPTION 'EXTCALC_QUARANTINE_PRECONDITION_MISMATCH';
  END IF;

  SELECT q.active INTO v_current FROM privado.extcalc_analysis_quarantine_v0 q
    WHERE q.tenant_id=v_tenant AND q.analysis_id=p_analysis_id;
  IF FOUND AND v_current IS NOT DISTINCT FROM p_active THEN
    RETURN jsonb_build_object('ok',true,'idempotent',true,
      'analysis_id',p_analysis_id,'active',p_active,
      'candidate_count',v_candidates,'current_revision_count',v_revisions);
  END IF;
  IF p_active THEN
    INSERT INTO privado.extcalc_analysis_quarantine_v0(
      tenant_id,analysis_id,active,reason,activated_by,changed_by)
    VALUES(v_tenant,p_analysis_id,true,p_reason,v_actor,v_actor)
    ON CONFLICT(tenant_id,analysis_id) DO UPDATE
      SET active=true,reason=EXCLUDED.reason,
          activated_by=EXCLUDED.activated_by,activated_at=now(),
          changed_by=EXCLUDED.changed_by,changed_at=now(),
          revoked_by=null,revoked_at=null;
  ELSE
    IF NOT FOUND THEN
      RAISE EXCEPTION 'EXTCALC_QUARANTINE_NOT_ACTIVE';
    END IF;
    UPDATE privado.extcalc_analysis_quarantine_v0
       SET active=false,reason=p_reason,changed_by=v_actor,changed_at=now(),
           revoked_by=v_actor,revoked_at=now()
     WHERE tenant_id=v_tenant AND analysis_id=p_analysis_id AND active;
  END IF;
  INSERT INTO privado.extcalc_analysis_quarantine_event_v0(
    tenant_id,analysis_id,action,actor,reason,candidate_count,current_revision_count)
    VALUES(v_tenant,p_analysis_id,CASE WHEN p_active THEN 'ACTIVATE' ELSE 'REVOKE' END,
      v_actor,p_reason,v_candidates,v_revisions);
  RETURN jsonb_build_object('ok',true,'idempotent',false,
    'analysis_id',p_analysis_id,'active',p_active,
    'candidate_count',v_candidates,'current_revision_count',v_revisions);
END
$quarantine$;
REVOKE ALL ON FUNCTION public.extcalc_set_analysis_quarantine_v0(text,boolean,text,bigint,bigint)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.extcalc_set_analysis_quarantine_v0(text,boolean,text,bigint,bigint)
 TO authenticated;

-- Actual live function extcalc_product_current_offers_v0, amended by one quarantine guard.
CREATE OR REPLACE FUNCTION public.extcalc_product_current_offers_v0()
 RETURNS SETOF jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_tenant uuid;
begin
  select m.tenant_id into v_tenant from privado.extcalc_product_membership_v0() m;
  if v_tenant is null then raise exception using errcode='42501',message='EXTCALC_PRODUCT_FORBIDDEN'; end if;
  return query
  select r.c01_snapshot
  from public.extcalc_offer_revision r
  where r.tenant_id=v_tenant
    and r.domain_outcome='VALID'
    and r.freshness_status='CURRENT'
    and r.c01_snapshot->>'execution_status'='SUCCEEDED'
    and r.c01_snapshot->'reviewed_offer' is not null
    AND NOT EXISTS (SELECT 1 FROM privado.extcalc_analysis_quarantine_v0 quarantine
      WHERE quarantine.tenant_id=r.tenant_id AND quarantine.analysis_id=r.analysis_id
        AND quarantine.active);
end;
$function$;

-- Actual live function extcalc_product_home_context_v1, amended by one quarantine guard.
CREATE OR REPLACE FUNCTION public.extcalc_product_home_context_v1()
 RETURNS SETOF jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  where r.tenant_id=v_tenant and r.freshness_status='CURRENT'
    AND NOT EXISTS (SELECT 1 FROM privado.extcalc_analysis_quarantine_v0 quarantine
      WHERE quarantine.tenant_id=r.tenant_id AND quarantine.analysis_id=r.analysis_id
        AND quarantine.active);
end;
$function$;

-- Actual live function extcalc_movement_feed_v0, amended by one quarantine guard.
CREATE OR REPLACE FUNCTION public.extcalc_movement_feed_v0(p_days integer DEFAULT 7)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      coalesce(
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
    AND NOT EXISTS (SELECT 1 FROM privado.extcalc_analysis_quarantine_v0 quarantine
      WHERE quarantine.tenant_id=r.tenant_id AND quarantine.analysis_id=r.analysis_id
        AND quarantine.active)
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
          pg_catalog.lower(coalesce(q.color,'')),
          pg_catalog.lower(coalesce(q.condition,'')),
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
        and pg_catalog.lower(coalesce(q.color,'')) = pg_catalog.lower(coalesce(cur.color,''))
        and pg_catalog.lower(coalesce(q.condition,'')) = pg_catalog.lower(coalesce(cur.condition,''))
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
    'items',coalesce(
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
            'name',coalesce(e.supplier_name,e.supplier_id)
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
$function$;

-- Actual live function extcalc_supplier_price_history_v0, amended by one quarantine guard.
CREATE OR REPLACE FUNCTION public.extcalc_supplier_price_history_v0(p_model_id text, p_days integer DEFAULT 7, p_capacity_gb integer DEFAULT NULL::integer, p_color text DEFAULT NULL::text, p_condition text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    AND NOT EXISTS (SELECT 1 FROM privado.extcalc_analysis_quarantine_v0 quarantine
      WHERE quarantine.tenant_id=r.tenant_id AND quarantine.analysis_id=r.analysis_id
        AND quarantine.active)
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
$function$;

-- Actual live function extcalc_product_source_execution_v0, amended by one quarantine guard.
CREATE OR REPLACE FUNCTION public.extcalc_product_source_execution_v0(p_analysis_id text, p_offer_id text, p_offer_revision integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  IF EXISTS (SELECT 1 FROM privado.extcalc_analysis_quarantine_v0 q
    WHERE q.tenant_id=v_tenant AND q.analysis_id=p_analysis_id AND q.active) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='EXTCALC_ANALYSIS_QUARANTINED';
  END IF;

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
$function$;
