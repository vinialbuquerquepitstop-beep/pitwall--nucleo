-- External Calc Simular Venda T04 — narrow product read RPCs.
-- Seller gains no raw table privilege. These RPCs expose only tenant-scoped trusted product context.

create or replace function privado.extcalc_product_membership_v0()
returns table(actor_id uuid, tenant_id uuid, papel text)
language sql
security definer
set search_path = ''
stable
as $$
  select u.id, u.tenant_id, u.papel
  from public.app_usuario u
  where u.id = auth.uid()
    and u.ativo
    and u.papel in ('dono','validador','vendedor')
  limit 1
$$;

revoke all on function privado.extcalc_product_membership_v0() from public, anon, authenticated;

create or replace function public.extcalc_product_current_offers_v0()
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
  select r.c01_snapshot
  from public.extcalc_offer_revision r
  where r.tenant_id=v_tenant
    and r.domain_outcome='VALID'
    and r.freshness_status='CURRENT'
    and r.c01_snapshot->>'execution_status'='SUCCEEDED'
    and r.c01_snapshot->'reviewed_offer' is not null;
end;
$$;

create or replace function public.extcalc_product_trade_in_policy_v0()
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare v_tenant uuid; v_result jsonb;
begin
  select m.tenant_id into v_tenant from privado.extcalc_product_membership_v0() m;
  if v_tenant is null then raise exception using errcode='42501',message='EXTCALC_PRODUCT_FORBIDDEN'; end if;
  select pg_catalog.jsonb_build_object('policy_id',p.policy_id,'tenant_id',p.tenant_id,'version',p.version,'status',p.status,'currency',p.currency,'deduction_amount_minor',p.deduction_amount_minor,'fingerprint',p.fingerprint)
    into v_result from public.extcalc_store_trade_in_policies p where p.tenant_id=v_tenant and p.status='ACTIVE';
  return v_result;
end;
$$;

create or replace function public.extcalc_product_store_rate_profile_v0()
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare v_tenant uuid; v_result jsonb;
begin
  select m.tenant_id into v_tenant from privado.extcalc_product_membership_v0() m;
  if v_tenant is null then raise exception using errcode='42501',message='EXTCALC_PRODUCT_FORBIDDEN'; end if;
  select pg_catalog.jsonb_build_object(
    'profile_id',p.profile_id,'tenant_id',p.tenant_id,'version',p.version,'status',p.status,'currency',p.currency,'rate_scale',p.rate_scale,'fingerprint',p.fingerprint,
    'entries',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('installment_count',e.installment_count,'rate_units',e.rate_units) order by e.installment_count) from public.extcalc_store_rate_profile_entries e where e.profile_id=p.profile_id),'[]'::jsonb)
  ) into v_result
  from public.extcalc_store_rate_profiles p where p.tenant_id=v_tenant and p.status='ACTIVE';
  return v_result;
end;
$$;

revoke all on function public.extcalc_product_current_offers_v0() from public, anon, authenticated;
revoke all on function public.extcalc_product_trade_in_policy_v0() from public, anon, authenticated;
revoke all on function public.extcalc_product_store_rate_profile_v0() from public, anon, authenticated;
grant execute on function public.extcalc_product_current_offers_v0() to authenticated;
grant execute on function public.extcalc_product_trade_in_policy_v0() to authenticated;
grant execute on function public.extcalc_product_store_rate_profile_v0() to authenticated;

-- T04 boundary:
-- no raw seller table grants; identity/tenant derive from auth.uid membership.
-- product arithmetic remains in trusted JS service; SQL only exposes tenant-scoped context.
