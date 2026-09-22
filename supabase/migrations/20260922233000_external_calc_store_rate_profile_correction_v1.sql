-- External Calc Store Rate Profile Persistence V1.
-- CORRECTION after G2: rates belong to the store/tenant, not to each user.
-- Owner (dono) defines/version-controls the store profile.
-- Sellers inherit the store active profile through the trusted resolver; no per-seller copies.
-- Raw privileged product access for vendedor remains held until Seller Projection.
-- No C02 arithmetic is implemented here.

do $guard$
begin
  if to_regclass('public.extcalc_user_rate_profiles') is not null
     and exists (select 1 from public.extcalc_user_rate_profiles limit 1) then
    raise exception 'EXTCALC_USER_RATE_PROFILE_CORRECTION_REQUIRES_DATA_MIGRATION';
  end if;
end;
$guard$;

drop function if exists public.extcalc_replace_my_rate_profile_v1(integer, jsonb, text, integer);

-- Drop tables first so their triggers are removed before the trigger functions.
drop table if exists public.extcalc_user_rate_profile_entries;
drop table if exists public.extcalc_user_rate_profiles;

drop function if exists privado.extcalc_enforce_rate_profile_membership_v1();
drop function if exists privado.extcalc_guard_rate_profile_entry_v1();
drop function if exists privado.extcalc_guard_rate_profile_version_v1();

create table public.extcalc_store_rate_profiles (
  profile_id            uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenant(id),
  version               integer not null check (version > 0),
  status                text not null check (status in ('ACTIVE', 'ARCHIVED')),
  currency              text not null check (currency = 'BRL'),
  rate_scale            integer not null check (rate_scale > 0),
  fingerprint           text not null,
  supersedes_profile_id uuid references public.extcalc_store_rate_profiles(profile_id),
  created_by            uuid not null references public.app_usuario(id),
  created_at            timestamptz not null default now(),
  activated_at          timestamptz not null default now(),

  constraint extcalc_store_rate_profiles_tenant_version_uk
    unique (tenant_id, version),
  constraint extcalc_store_rate_profiles_not_self_ck
    check (supersedes_profile_id is null or supersedes_profile_id <> profile_id)
);

comment on table public.extcalc_store_rate_profiles is
  'Perfil versionado de taxas da loja. Pertence ao tenant; somente dono cria nova versao. Usuarios autorizados da mesma loja consomem a mesma versao ativa.';

create table public.extcalc_store_rate_profile_entries (
  profile_id         uuid not null references public.extcalc_store_rate_profiles(profile_id),
  installment_count smallint not null check (installment_count between 1 and 18),
  rate_units         bigint not null check (rate_units >= 0),

  primary key (profile_id, installment_count)
);

comment on table public.extcalc_store_rate_profile_entries is
  'Taxas imutaveis por quantidade de parcelas do perfil da loja. rate_percent = rate_units / rate_scale.';

create unique index extcalc_store_rate_profiles_one_active_ix
  on public.extcalc_store_rate_profiles (tenant_id)
  where status = 'ACTIVE';

create index extcalc_store_rate_profiles_history_ix
  on public.extcalc_store_rate_profiles (tenant_id, version desc);

create index extcalc_store_rate_profile_entries_profile_ix
  on public.extcalc_store_rate_profile_entries (profile_id, installment_count);

create or replace function privado.extcalc_enforce_store_rate_profile_creator_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $extcalc_store_rate_creator$
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
    raise exception using errcode = '23514', message = 'EXTCALC_STORE_RATE_PROFILE_CREATOR_INVALID';
  end if;

  return new;
end;
$extcalc_store_rate_creator$;

create trigger extcalc_store_rate_profile_creator_v1
before insert on public.extcalc_store_rate_profiles
for each row
execute function privado.extcalc_enforce_store_rate_profile_creator_v1();

create or replace function privado.extcalc_guard_store_rate_profile_version_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $extcalc_store_rate_profile_guard$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'EXTCALC_STORE_RATE_PROFILE_IMMUTABLE';
  end if;

  if old.profile_id is distinct from new.profile_id
     or old.tenant_id is distinct from new.tenant_id
     or old.version is distinct from new.version
     or old.currency is distinct from new.currency
     or old.rate_scale is distinct from new.rate_scale
     or old.fingerprint is distinct from new.fingerprint
     or old.supersedes_profile_id is distinct from new.supersedes_profile_id
     or old.created_by is distinct from new.created_by
     or old.created_at is distinct from new.created_at
     or old.activated_at is distinct from new.activated_at
     or old.status is distinct from 'ACTIVE'
     or new.status is distinct from 'ARCHIVED' then
    raise exception using errcode = '55000', message = 'EXTCALC_STORE_RATE_PROFILE_IMMUTABLE';
  end if;

  return new;
end;
$extcalc_store_rate_profile_guard$;

create trigger extcalc_store_rate_profile_guard_v1
before update or delete on public.extcalc_store_rate_profiles
for each row
execute function privado.extcalc_guard_store_rate_profile_version_v1();

create or replace function privado.extcalc_guard_store_rate_profile_entry_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $extcalc_store_rate_entry_guard$
begin
  raise exception using errcode = '55000', message = 'EXTCALC_STORE_RATE_PROFILE_ENTRY_IMMUTABLE';
end;
$extcalc_store_rate_entry_guard$;

create trigger extcalc_store_rate_profile_entry_guard_v1
before update or delete on public.extcalc_store_rate_profile_entries
for each row
execute function privado.extcalc_guard_store_rate_profile_entry_v1();

alter table public.extcalc_store_rate_profiles enable row level security;
alter table public.extcalc_store_rate_profile_entries enable row level security;

create policy extcalc_store_rate_profiles_tenant_sel
  on public.extcalc_store_rate_profiles
  for select
  to authenticated
  using (
    tenant_id = privado.fn_tenant_atual()
    and privado.fn_extcalc_beta_operador_v0()
  );

create policy extcalc_store_rate_profile_entries_tenant_sel
  on public.extcalc_store_rate_profile_entries
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.extcalc_store_rate_profiles p
      where p.profile_id = extcalc_store_rate_profile_entries.profile_id
        and p.tenant_id = privado.fn_tenant_atual()
        and privado.fn_extcalc_beta_operador_v0()
    )
  );

revoke all on public.extcalc_store_rate_profiles
  from anon, authenticated;
revoke all on public.extcalc_store_rate_profile_entries
  from anon, authenticated;

grant select on public.extcalc_store_rate_profiles
  to authenticated;
grant select on public.extcalc_store_rate_profile_entries
  to authenticated;

create or replace function public.extcalc_replace_store_rate_profile_v1(
  p_rate_scale integer,
  p_entries jsonb,
  p_currency text default 'BRL',
  p_expected_active_version integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $extcalc_replace_store_rate_profile$
declare
  v_actor uuid;
  v_tenant uuid;
  v_role text;
  v_currency text;
  v_entry jsonb;
  v_installment integer;
  v_units bigint;
  v_seen integer[] := array[]::integer[];
  v_normalized_entries jsonb;
  v_fingerprint text;

  v_active_profile_id uuid;
  v_active_version integer;
  v_active_fingerprint text;

  v_profile_id uuid;
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
    raise exception using errcode = '42501', message = 'EXTCALC_STORE_RATE_PROFILE_FORBIDDEN';
  end if;

  if v_tenant is distinct from privado.fn_tenant_atual() then
    raise exception using errcode = '42501', message = 'EXTCALC_TENANT_UNAVAILABLE';
  end if;

  -- Serialize all owners of the same store against the same tenant row.
  perform 1
    from public.tenant t
   where t.id = v_tenant
   for update;

  if not found then
    raise exception using errcode = '42501', message = 'EXTCALC_TENANT_UNAVAILABLE';
  end if;

  v_currency := pg_catalog.upper(nullif(pg_catalog.btrim(p_currency), ''));

  if v_currency is distinct from 'BRL'
     or p_rate_scale is null
     or p_rate_scale <= 0
     or p_entries is null
     or pg_catalog.jsonb_typeof(p_entries) <> 'array'
     or pg_catalog.jsonb_array_length(p_entries) = 0 then
    raise exception 'EXTCALC_STORE_RATE_PROFILE_INVALID';
  end if;

  for v_entry in
    select value from pg_catalog.jsonb_array_elements(p_entries)
  loop
    if pg_catalog.jsonb_typeof(v_entry) <> 'object'
       or not (v_entry ? 'installment_count')
       or not (v_entry ? 'rate_units') then
      raise exception 'EXTCALC_STORE_RATE_PROFILE_ENTRY_INVALID';
    end if;

    begin
      v_installment := (v_entry->>'installment_count')::integer;
      v_units := (v_entry->>'rate_units')::bigint;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'EXTCALC_STORE_RATE_PROFILE_ENTRY_INVALID';
    end;

    if v_installment not between 1 and 18 or v_units < 0 then
      raise exception 'EXTCALC_STORE_RATE_PROFILE_ENTRY_INVALID';
    end if;

    if v_installment = any(v_seen) then
      raise exception 'EXTCALC_STORE_RATE_PROFILE_ENTRY_DUPLICATE';
    end if;

    v_seen := pg_catalog.array_append(v_seen, v_installment);
  end loop;

  select pg_catalog.jsonb_agg(
           pg_catalog.jsonb_build_object(
             'installment_count', (e->>'installment_count')::integer,
             'rate_units', (e->>'rate_units')::bigint
           )
           order by (e->>'installment_count')::integer
         )
    into v_normalized_entries
    from pg_catalog.jsonb_array_elements(p_entries) e;

  v_fingerprint := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        pg_catalog.jsonb_build_object(
          'currency', v_currency,
          'rate_scale', p_rate_scale,
          'entries', v_normalized_entries
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  select p.profile_id, p.version, p.fingerprint
    into v_active_profile_id, v_active_version, v_active_fingerprint
    from public.extcalc_store_rate_profiles p
   where p.tenant_id = v_tenant
     and p.status = 'ACTIVE'
   for update;

  if found then
    if p_expected_active_version is null
       or p_expected_active_version is distinct from v_active_version then
      raise exception 'EXTCALC_STORE_RATE_PROFILE_CONFLICT';
    end if;

    if v_active_fingerprint = v_fingerprint then
      return pg_catalog.jsonb_build_object(
        'ok', true,
        'profile_id', v_active_profile_id,
        'tenant_id', v_tenant,
        'version', v_active_version,
        'status', 'ACTIVE',
        'fingerprint', v_active_fingerprint,
        'idempotent', true
      );
    end if;
  elsif p_expected_active_version is not null then
    raise exception 'EXTCALC_STORE_RATE_PROFILE_CONFLICT';
  end if;

  select coalesce(pg_catalog.max(p.version), 0) + 1
    into v_new_version
    from public.extcalc_store_rate_profiles p
   where p.tenant_id = v_tenant;

  if v_active_profile_id is not null then
    update public.extcalc_store_rate_profiles
       set status = 'ARCHIVED'
     where profile_id = v_active_profile_id;
  end if;

  insert into public.extcalc_store_rate_profiles (
    tenant_id,
    version,
    status,
    currency,
    rate_scale,
    fingerprint,
    supersedes_profile_id,
    created_by
  ) values (
    v_tenant,
    v_new_version,
    'ACTIVE',
    v_currency,
    p_rate_scale,
    v_fingerprint,
    v_active_profile_id,
    v_actor
  )
  returning profile_id into v_profile_id;

  insert into public.extcalc_store_rate_profile_entries (
    profile_id,
    installment_count,
    rate_units
  )
  select
    v_profile_id,
    (e->>'installment_count')::integer,
    (e->>'rate_units')::bigint
  from pg_catalog.jsonb_array_elements(v_normalized_entries) e;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'profile_id', v_profile_id,
    'tenant_id', v_tenant,
    'version', v_new_version,
    'status', 'ACTIVE',
    'fingerprint', v_fingerprint,
    'idempotent', false
  );
end;
$extcalc_replace_store_rate_profile$;

comment on function public.extcalc_replace_store_rate_profile_v1(integer, jsonb, text, integer) is
  'Dono cria/ativa uma nova versao da taxa da propria loja. Tenant/actor sao derivados da sessao; vendedores herdam a versao ativa via resolver confiavel.';

revoke all on function public.extcalc_replace_store_rate_profile_v1(integer, jsonb, text, integer)
  from public, anon, authenticated;

grant execute on function public.extcalc_replace_store_rate_profile_v1(integer, jsonb, text, integer)
  to authenticated;

-- Corrected G2 invariants:
-- 1. profile owner is tenant/store, not individual user;
-- 2. only dono may create a new profile version;
-- 3. users of the same tenant resolve the same active profile;
-- 4. no per-seller copy is created, preventing drift;
-- 5. raw seller access remains held until Seller Projection; future quote resolver uses tenant identity;
-- 6. one ACTIVE profile per tenant;
-- 7. activated history is immutable except ACTIVE -> ARCHIVED;
-- 8. no legacy/global calc_dados rates are copied automatically;
-- 9. no C02 arithmetic, quote calculation, learning or Interpreter mutation occurs here.
