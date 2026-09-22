-- External Calc User Rate Profile Persistence V1.
-- G2: persistencia versionada + isolamento por usuario autenticado.
-- Nao calcula parcelas; C02 continua sendo a unica autoridade de calculo.
-- Nao altera C01/C03/C04/C05 nem o learning do Interpreter.

create table if not exists public.extcalc_user_rate_profiles (
  profile_id            uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenant(id),
  user_id               uuid not null references public.app_usuario(id),
  version               integer not null check (version > 0),
  status                text not null check (status in ('ACTIVE', 'ARCHIVED')),
  currency              text not null check (currency = 'BRL'),
  rate_scale            integer not null check (rate_scale > 0),
  fingerprint           text not null,
  supersedes_profile_id uuid references public.extcalc_user_rate_profiles(profile_id),
  created_at            timestamptz not null default now(),
  activated_at          timestamptz not null default now(),

  constraint extcalc_user_rate_profiles_user_version_uk
    unique (user_id, version),
  constraint extcalc_user_rate_profiles_not_self_ck
    check (supersedes_profile_id is null or supersedes_profile_id <> profile_id)
);

comment on table public.extcalc_user_rate_profiles is
  'Versoes imutaveis da configuracao percentual de parcelamento por usuario autenticado. Somente status ACTIVE->ARCHIVED pode mudar durante ativacao transacional.';

create table if not exists public.extcalc_user_rate_profile_entries (
  profile_id        uuid not null references public.extcalc_user_rate_profiles(profile_id),
  installment_count smallint not null check (installment_count between 1 and 18),
  rate_units         bigint not null check (rate_units >= 0),

  primary key (profile_id, installment_count)
);

comment on table public.extcalc_user_rate_profile_entries is
  'Entradas imutaveis de taxa por quantidade de parcelas. rate_percent = rate_units / rate_scale do profile.';

create unique index if not exists extcalc_user_rate_profiles_one_active_ix
  on public.extcalc_user_rate_profiles (user_id)
  where status = 'ACTIVE';

create index if not exists extcalc_user_rate_profiles_owner_history_ix
  on public.extcalc_user_rate_profiles (tenant_id, user_id, version desc);

create index if not exists extcalc_user_rate_profile_entries_profile_ix
  on public.extcalc_user_rate_profile_entries (profile_id, installment_count);

create or replace function privado.extcalc_enforce_rate_profile_membership_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $extcalc_rate_membership$
declare
  v_member_tenant uuid;
begin
  select u.tenant_id
    into v_member_tenant
    from public.app_usuario u
   where u.id = new.user_id
     and u.ativo;

  if not found or v_member_tenant is distinct from new.tenant_id then
    raise exception using errcode = '23514', message = 'EXTCALC_RATE_PROFILE_MEMBERSHIP_INVALID';
  end if;

  return new;
end;
$extcalc_rate_membership$;

drop trigger if exists extcalc_user_rate_profile_membership_v1
  on public.extcalc_user_rate_profiles;

create trigger extcalc_user_rate_profile_membership_v1
before insert on public.extcalc_user_rate_profiles
for each row
execute function privado.extcalc_enforce_rate_profile_membership_v1();

create or replace function privado.extcalc_guard_rate_profile_version_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $extcalc_rate_profile_guard$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'EXTCALC_RATE_PROFILE_IMMUTABLE';
  end if;

  if old.profile_id is distinct from new.profile_id
     or old.tenant_id is distinct from new.tenant_id
     or old.user_id is distinct from new.user_id
     or old.version is distinct from new.version
     or old.currency is distinct from new.currency
     or old.rate_scale is distinct from new.rate_scale
     or old.fingerprint is distinct from new.fingerprint
     or old.supersedes_profile_id is distinct from new.supersedes_profile_id
     or old.created_at is distinct from new.created_at
     or old.activated_at is distinct from new.activated_at
     or old.status is distinct from 'ACTIVE'
     or new.status is distinct from 'ARCHIVED' then
    raise exception using errcode = '55000', message = 'EXTCALC_RATE_PROFILE_IMMUTABLE';
  end if;

  return new;
end;
$extcalc_rate_profile_guard$;

drop trigger if exists extcalc_user_rate_profile_guard_v1
  on public.extcalc_user_rate_profiles;

create trigger extcalc_user_rate_profile_guard_v1
before update or delete on public.extcalc_user_rate_profiles
for each row
execute function privado.extcalc_guard_rate_profile_version_v1();

create or replace function privado.extcalc_guard_rate_profile_entry_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $extcalc_rate_entry_guard$
begin
  raise exception using errcode = '55000', message = 'EXTCALC_RATE_PROFILE_ENTRY_IMMUTABLE';
end;
$extcalc_rate_entry_guard$;

drop trigger if exists extcalc_user_rate_profile_entry_guard_v1
  on public.extcalc_user_rate_profile_entries;

create trigger extcalc_user_rate_profile_entry_guard_v1
before update or delete on public.extcalc_user_rate_profile_entries
for each row
execute function privado.extcalc_guard_rate_profile_entry_v1();

alter table public.extcalc_user_rate_profiles enable row level security;
alter table public.extcalc_user_rate_profile_entries enable row level security;

drop policy if exists extcalc_user_rate_profiles_own_sel
  on public.extcalc_user_rate_profiles;

create policy extcalc_user_rate_profiles_own_sel
  on public.extcalc_user_rate_profiles
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and tenant_id = privado.fn_tenant_atual()
    and privado.fn_extcalc_beta_operador_v0()
  );

drop policy if exists extcalc_user_rate_profile_entries_own_sel
  on public.extcalc_user_rate_profile_entries;

create policy extcalc_user_rate_profile_entries_own_sel
  on public.extcalc_user_rate_profile_entries
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.extcalc_user_rate_profiles p
      where p.profile_id = extcalc_user_rate_profile_entries.profile_id
        and p.user_id = auth.uid()
        and p.tenant_id = privado.fn_tenant_atual()
        and privado.fn_extcalc_beta_operador_v0()
    )
  );

revoke all on public.extcalc_user_rate_profiles
  from anon, authenticated;
revoke all on public.extcalc_user_rate_profile_entries
  from anon, authenticated;

grant select on public.extcalc_user_rate_profiles
  to authenticated;
grant select on public.extcalc_user_rate_profile_entries
  to authenticated;

create or replace function public.extcalc_replace_my_rate_profile_v1(
  p_rate_scale integer,
  p_entries jsonb,
  p_currency text default 'BRL',
  p_expected_active_version integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $extcalc_replace_rate_profile$
declare
  v_user uuid;
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
  v_user := auth.uid();

  if v_user is null then
    raise exception using errcode = '42501', message = 'EXTCALC_UNAUTHENTICATED';
  end if;

  select u.tenant_id, u.papel
    into v_tenant, v_role
    from public.app_usuario u
   where u.id = v_user
     and u.ativo
   for update;

  if not found then
    raise exception using errcode = '42501', message = 'EXTCALC_MEMBERSHIP_UNAVAILABLE';
  end if;

  if coalesce(v_role, '') not in ('dono', 'validador') then
    raise exception using errcode = '42501', message = 'EXTCALC_RATE_PROFILE_FORBIDDEN';
  end if;

  if v_tenant is distinct from privado.fn_tenant_atual() then
    raise exception using errcode = '42501', message = 'EXTCALC_TENANT_UNAVAILABLE';
  end if;

  v_currency := pg_catalog.upper(nullif(pg_catalog.btrim(p_currency), ''));

  if v_currency is distinct from 'BRL'
     or p_rate_scale is null
     or p_rate_scale <= 0
     or p_entries is null
     or pg_catalog.jsonb_typeof(p_entries) <> 'array'
     or pg_catalog.jsonb_array_length(p_entries) = 0 then
    raise exception 'EXTCALC_RATE_PROFILE_INVALID';
  end if;

  for v_entry in
    select value from pg_catalog.jsonb_array_elements(p_entries)
  loop
    if pg_catalog.jsonb_typeof(v_entry) <> 'object'
       or not (v_entry ? 'installment_count')
       or not (v_entry ? 'rate_units') then
      raise exception 'EXTCALC_RATE_PROFILE_ENTRY_INVALID';
    end if;

    begin
      v_installment := (v_entry->>'installment_count')::integer;
      v_units := (v_entry->>'rate_units')::bigint;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'EXTCALC_RATE_PROFILE_ENTRY_INVALID';
    end;

    if v_installment not between 1 and 18 or v_units < 0 then
      raise exception 'EXTCALC_RATE_PROFILE_ENTRY_INVALID';
    end if;

    if v_installment = any(v_seen) then
      raise exception 'EXTCALC_RATE_PROFILE_ENTRY_DUPLICATE';
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
    from public.extcalc_user_rate_profiles p
   where p.user_id = v_user
     and p.status = 'ACTIVE'
   for update;

  if found then
    if p_expected_active_version is null
       or p_expected_active_version is distinct from v_active_version then
      raise exception 'EXTCALC_RATE_PROFILE_CONFLICT';
    end if;

    if v_active_fingerprint = v_fingerprint then
      return pg_catalog.jsonb_build_object(
        'ok', true,
        'profile_id', v_active_profile_id,
        'version', v_active_version,
        'status', 'ACTIVE',
        'fingerprint', v_active_fingerprint,
        'idempotent', true
      );
    end if;
  elsif p_expected_active_version is not null then
    raise exception 'EXTCALC_RATE_PROFILE_CONFLICT';
  end if;

  select coalesce(pg_catalog.max(p.version), 0) + 1
    into v_new_version
    from public.extcalc_user_rate_profiles p
   where p.user_id = v_user;

  if v_active_profile_id is not null then
    update public.extcalc_user_rate_profiles
       set status = 'ARCHIVED'
     where profile_id = v_active_profile_id;
  end if;

  insert into public.extcalc_user_rate_profiles (
    tenant_id,
    user_id,
    version,
    status,
    currency,
    rate_scale,
    fingerprint,
    supersedes_profile_id
  ) values (
    v_tenant,
    v_user,
    v_new_version,
    'ACTIVE',
    v_currency,
    p_rate_scale,
    v_fingerprint,
    v_active_profile_id
  )
  returning profile_id into v_profile_id;

  insert into public.extcalc_user_rate_profile_entries (
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
    'version', v_new_version,
    'status', 'ACTIVE',
    'fingerprint', v_fingerprint,
    'idempotent', false
  );
end;
$extcalc_replace_rate_profile$;

comment on function public.extcalc_replace_my_rate_profile_v1(integer, jsonb, text, integer) is
  'Cria/ativa uma nova versao do UserRateProfile do proprio auth.uid(). Nao aceita user_id/profile authority do cliente e nao calcula quote.';

revoke all on function public.extcalc_replace_my_rate_profile_v1(integer, jsonb, text, integer)
  from public, anon, authenticated;

grant execute on function public.extcalc_replace_my_rate_profile_v1(integer, jsonb, text, integer)
  to authenticated;

-- G2 invariants:
-- 1. owner is auth.uid(), never client-supplied user_id;
-- 2. own-user RLS applies even between users of the same tenant;
-- 3. direct writes are revoked; version changes go through the guarded RPC;
-- 4. exactly one ACTIVE profile per user is enforced by a partial unique index;
-- 5. activated data is immutable; only ACTIVE -> ARCHIVED status transition is allowed;
-- 6. profile replacement is serialized by locking the active app_usuario row;
-- 7. legacy/global calc_dados rates are not copied into user profiles;
-- 8. no C02 arithmetic, quote calculation, learning or Interpreter mutation occurs here.
