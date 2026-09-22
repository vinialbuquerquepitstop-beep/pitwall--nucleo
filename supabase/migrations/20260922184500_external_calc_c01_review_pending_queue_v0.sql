-- External Calc C01 Review Pending Queue V0.
-- Lista apenas candidates ainda sem HumanReview persistido.
-- Preserva extcalc_review_candidate como store imutavel.

create or replace function public.extcalc_list_pending_review_candidates_v0(
  p_limit integer default 50
)
returns table (
  candidate_snapshot jsonb,
  criado_em timestamptz
)
language plpgsql
security definer
set search_path = ''
as $extcalc_pending_review$
declare
  v_tenant uuid;
  v_papel text;
  v_limit integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'EXTCALC_UNAUTHENTICATED';
  end if;

  v_tenant := privado.fn_tenant_atual();
  v_papel := privado.fn_papel_atual();

  if v_tenant is null then
    raise exception using errcode = '42501', message = 'EXTCALC_TENANT_UNAVAILABLE';
  end if;

  if v_papel is distinct from 'dono' then
    raise exception using errcode = '42501', message = 'EXTCALC_FORBIDDEN';
  end if;

  v_limit := coalesce(p_limit, 50);
  if v_limit < 1 or v_limit > 100 then
    raise exception 'EXTCALC_REVIEW_QUEUE_LIMIT_INVALID';
  end if;

  return query
  select
    c.candidate_snapshot,
    c.criado_em
  from public.extcalc_review_candidate c
  where c.tenant_id = v_tenant
    and not exists (
      select 1
      from public.extcalc_human_review h
      where h.tenant_id = c.tenant_id
        and h.analysis_id = c.analysis_id
        and h.offer_id = c.offer_id
        and coalesce(
          nullif(h.review_snapshot->>'original_offer_revision', '')::integer,
          h.offer_revision
        ) = c.offer_revision
    )
  order by c.criado_em asc
  limit v_limit;
end;
$extcalc_pending_review$;

comment on function public.extcalc_list_pending_review_candidates_v0(integer) is
  'Lista C01 review candidates sem HumanReview correspondente, preservando o candidate store imutavel.';

revoke all on function public.extcalc_list_pending_review_candidates_v0(integer)
  from public, anon, authenticated;
grant execute on function public.extcalc_list_pending_review_candidates_v0(integer)
  to authenticated;
