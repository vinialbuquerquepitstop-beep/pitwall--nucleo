-- External Calc Store Trade-in Deduction Policy V0.
-- The trade-in deduction belongs to the tenant/store, not to an individual user.
-- Owner (dono) creates/version-controls the active fixed deduction.
-- Sellers never submit deduction authority; future trusted resolvers inherit the store ACTIVE policy.
-- No trade-in estimate arithmetic is implemented here.

create table public.extcalc_store_trade_in_policies (
  policy_id               uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references public.tenant(id),
  version                 integer not null check (version > 0),
  status                  text not null check (status in ('ACTIVE', 'ARCHIVED')),
  currency                text not null check (currency = 'BRL'),
  deduction_amount_minor  bigint not null check (deduction_amount_minor >= 0),
  fingerprint             text not null,
  supersedes_policy_id    uuid references public.extcalc_store_trade_in_policies(policy_id),
  created_by              uuid not null references public.app_usuario(id),
  created_at              timestamptz not null default now(),
  activated_at            timestamptz not null default now(),

  constraint extcalc_store_trade_in_policies_tenant_version_uk
    unique (tenant_id, version),
  constraint extcalc_store_trade_in_policies_not_self_ck
    check (supersedes_policy_id is null or supersedes_policy_id <> policy_id)
);

comment on table public.extcalc_store_trade_in_policies is
  'Politica versionada de deducao fixa para estimativa de entrada. Pertence ao tenant/loja; somente dono cria nova versao. Vendedores herdam a politica ativa por resolver confiavel, sem override local.';

create unique index extcalc_store_trade_in_policies_one_active_ix
  on public.extcalc_store_trade_in_policies (tenant_id)
  where status = 'ACTIVE';

create index extcalc_store_trade_in_policies_history_ix
  on public.extcalc_store_trade_in_policies (tenant_id, version desc);

create or replace function privado.extcalc_enforce_trade_in_policy_creator_v0()
returns trigger
language plpgsql
security definer
set search_path = ''
as $extcalc_trade_in_policy_creator$
declare
  v_creator_tenant uuid;
  v_creator_role text;
begin
  select u.tenant_id, u.papel
    into v_creator_tenant, v_creator_role
    from public.app_usuario u
   where u.id = new.created_by
     and u.ativo;

  if not found
     or v_creator_tenant is distinct from new.tenant_id
     or v_creator_role is distinct from 'dono' then
    raise exception using errcode = '23514', message = 'EXTCALC_TRADE_IN_POLICY_CREATOR_INVALID';
  end if;

  return new;
end;
$extcalc_trade_in_policy_creator$;

create trigger extcalc_store_trade_in_policy_creator_v0
before insert on public.extcalc_store_trade_in_policies
for each row
execute function privado.extcalc_enforce_trade_in_policy_creator_v0();

create or replace function privado.extcalc_guard_trade_in_policy_version_v0()
returns trigger
language plpgsql
security definer
set search_path = ''
as $extcalc_trade_in_policy_guard$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'EXTCALC_TRADE_IN_POLICY_IMMUTABLE';
  end if;

  if old.policy_id is distinct from new.policy_id
     or old.tenant_id is distinct from new.tenant_id
     or old.version is distinct from new.version
     or old.currency is distinct from new.currency
     or old.deduction_amount_minor is distinct from new.deduction_amount_minor
     or old.fingerprint is distinct from new.fingerprint
     or old.supersedes_policy_id is distinct from new.supersedes_policy_id
     or old.created_by is distinct from new.created_by
     or old.created_at is distinct from new.created_at
     or old.activated_at is distinct from new.activated_at
     or old.status is distinct from 'ACTIVE'
     or new.status is distinct from 'ARCHIVED' then
    raise exception using errcode = '55000', message = 'EXTCALC_TRADE_IN_POLICY_IMMUTABLE';
  end if;

  return new;
end;
$extcalc_trade_in_policy_guard$;

create trigger extcalc_store_trade_in_policy_guard_v0
before update or delete on public.extcalc_store_trade_in_policies
for each row
execute function privado.extcalc_guard_trade_in_policy_version_v0();

alter table public.extcalc_store_trade_in_policies enable row level security;

create policy extcalc_store_trade_in_policies_tenant_sel
  on public.extcalc_store_trade_in_policies
  for select
  to authenticated
  using (
    tenant_id = privado.fn_tenant_atual()
    and privado.fn_extcalc_beta_operador_v0()
  );

revoke all on public.extcalc_store_trade_in_policies
  from anon, authenticated;

grant select on public.extcalc_store_trade_in_policies
  to authenticated;

create or replace function public.extcalc_replace_store_trade_in_policy_v0(
  p_deduction_amount_minor bigint,
  p_currency text default 'BRL',
  p_expected_active_version integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $extcalc_replace_store_trade_in_policy$
declare
  v_actor uuid;
  v_tenant uuid;
  v_role text;
  v_currency text;
  v_fingerprint text;

  v_active_policy_id uuid;
  v_active_version integer;
  v_active_fingerprint text;

  v_policy_id uuid;
  v_new_version integer;
begin
  v_actor := auth.uid();

  if v_actor is null then
    raise exception using errcode = '42501', message = 'EXTCALC_UNAUTHENTICATED';
  end if;

  select u.tenant_id, u.papel
    into v_tenant, v_role
    from public.app_usuario u
   where u.id = v_actor
     and u.ativo;

  if not found then
    raise exception using errcode = '42501', message = 'EXTCALC_MEMBERSHIP_UNAVAILABLE';
  end if;

  if v_role is distinct from 'dono' then
    raise exception using errcode = '42501', message = 'EXTCALC_TRADE_IN_POLICY_FORBIDDEN';
  end if;

  if v_tenant is distinct from privado.fn_tenant_atual() then
    raise exception using errcode = '42501', message = 'EXTCALC_TENANT_UNAVAILABLE';
  end if;

  perform 1
    from public.tenant t
   where t.id = v_tenant
   for update;

  if not found then
    raise exception using errcode = '42501', message = 'EXTCALC_TENANT_UNAVAILABLE';
  end if;

  v_currency := pg_catalog.upper(nullif(pg_catalog.btrim(p_currency), ''));

  if v_currency is distinct from 'BRL'
     or p_deduction_amount_minor is null
     or p_deduction_amount_minor < 0 then
    raise exception 'EXTCALC_TRADE_IN_POLICY_INVALID';
  end if;

  v_fingerprint := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        pg_catalog.jsonb_build_object(
          'currency', v_currency,
          'deduction_amount_minor', p_deduction_amount_minor
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  select p.policy_id, p.version, p.fingerprint
    into v_active_policy_id, v_active_version, v_active_fingerprint
    from public.extcalc_store_trade_in_policies p
   where p.tenant_id = v_tenant
     and p.status = 'ACTIVE'
   for update;

  if found then
    if p_expected_active_version is null
       or p_expected_active_version is distinct from v_active_version then
      raise exception 'EXTCALC_TRADE_IN_POLICY_CONFLICT';
    end if;

    if v_active_fingerprint = v_fingerprint then
      return pg_catalog.jsonb_build_object(
        'ok', true,
        'policy_id', v_active_policy_id,
        'tenant_id', v_tenant,
        'version', v_active_version,
        'status', 'ACTIVE',
        'currency', v_currency,
        'deduction_amount_minor', p_deduction_amount_minor,
        'fingerprint', v_active_fingerprint,
        'idempotent', true
      );
    end if;
  elsif p_expected_active_version is not null then
    raise exception 'EXTCALC_TRADE_IN_POLICY_CONFLICT';
  end if;

  select coalesce(pg_catalog.max(p.version), 0) + 1
    into v_new_version
    from public.extcalc_store_trade_in_policies p
   where p.tenant_id = v_tenant;

  if v_active_policy_id is not null then
    update public.extcalc_store_trade_in_policies
       set status = 'ARCHIVED'
     where policy_id = v_active_policy_id;
  end if;

  insert into public.extcalc_store_trade_in_policies (
    tenant_id,
    version,
    status,
    currency,
    deduction_amount_minor,
    fingerprint,
    supersedes_policy_id,
    created_by
  ) values (
    v_tenant,
    v_new_version,
    'ACTIVE',
    v_currency,
    p_deduction_amount_minor,
    v_fingerprint,
    v_active_policy_id,
    v_actor
  )
  returning policy_id into v_policy_id;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'policy_id', v_policy_id,
    'tenant_id', v_tenant,
    'version', v_new_version,
    'status', 'ACTIVE',
    'currency', v_currency,
    'deduction_amount_minor', p_deduction_amount_minor,
    'fingerprint', v_fingerprint,
    'idempotent', false
  );
end;
$extcalc_replace_store_trade_in_policy$;

comment on function public.extcalc_replace_store_trade_in_policy_v0(bigint, text, integer) is
  'Dono cria/ativa nova versao da deducao fixa de entrada da propria loja. Tenant/actor sao derivados da sessao; vendedores nao enviam override e herdarao a versao ACTIVE pelo resolver confiavel.';

revoke all on function public.extcalc_replace_store_trade_in_policy_v0(bigint, text, integer)
  from public, anon, authenticated;

grant execute on function public.extcalc_replace_store_trade_in_policy_v0(bigint, text, integer)
  to authenticated;

-- T03 invariants:
-- 1. policy owner is tenant/store, never an individual seller/user;
-- 2. only dono may create/activate a new version;
-- 3. exactly one ACTIVE policy per tenant;
-- 4. activated history is immutable except ACTIVE -> ARCHIVED;
-- 5. browser/seller never chooses tenant, policy id/version or deduction authority;
-- 6. raw product SELECT remains on the current beta operator boundary;
-- 7. future trusted Trade-in Estimate resolver consumes the ACTIVE tenant policy;
-- 8. no Trade-in Estimate arithmetic, C02 change, C04 change or Interpreter learning occurs here.
