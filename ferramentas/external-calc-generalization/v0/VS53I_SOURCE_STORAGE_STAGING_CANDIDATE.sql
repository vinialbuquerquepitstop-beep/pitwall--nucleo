-- EXTERNAL CALC VS5.3i — DDL CANDIDATE / STAGING REVIEW ONLY
-- UNAPPROVED, NOT A MIGRATION. DO NOT EXECUTE in production or by an
-- automated workflow. Security and storage decisions remain under human gate.
-- Preflight MUST verify: isolated authorized staging, schema 'privado' NOT
-- exposed by Data API, PostgreSQL >= 15, extensions.digest(bytea,text)
-- installed/accessible, Supabase Auth users and staging-only tenant/role seed,
-- retention/size approval. No productive tenant model is copied.
-- This is deliberately in ferramentas/, never in supabase/migrations/.

-- STAGING-ONLY identity bootstrap: NOT the productive tenant model.
-- Actual Supabase Auth users A/B will be created in a separately authorized gate.
-- Role/tenant are resolved from locked server-seeded rows, NEVER user_metadata,
-- a client-supplied tenant, or service_role queries used as RLS evidence.
create schema if not exists privado;

create table privado.extcalc_staging_tenant_v0 (
  tenant_id uuid primary key,
  label text not null check (length(label) between 1 and 80)
);
alter table privado.extcalc_staging_tenant_v0 enable row level security;
alter table privado.extcalc_staging_tenant_v0 force row level security;
revoke all on privado.extcalc_staging_tenant_v0 from public, anon, authenticated;

create table privado.extcalc_staging_membership_v0 (
  user_id uuid primary key references auth.users(id),
  tenant_id uuid not null references privado.extcalc_staging_tenant_v0(tenant_id),
  member_role text not null check (member_role = 'dono'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table privado.extcalc_staging_membership_v0 enable row level security;
alter table privado.extcalc_staging_membership_v0 force row level security;
create policy extcalc_stage_membership_self_read_v0
on privado.extcalc_staging_membership_v0
for select to authenticated
using (user_id = (select auth.uid()) and active is true);
revoke all on privado.extcalc_staging_membership_v0 from public, anon, authenticated;
grant usage on schema privado to authenticated;
grant select on privado.extcalc_staging_membership_v0 to authenticated;
-- No client INSERT/UPDATE/DELETE grants or policies on bootstrap data.

-- Original bytes are stored separately from any C01 derived candidate.
-- admin-only ingestion is deliberately NOT implemented in this candidate.
create table privado.extcalc_original_source_v0 (
  tenant_id uuid not null references privado.extcalc_staging_tenant_v0(tenant_id),
  source_ref text not null check (
    length(source_ref) between 3 and 160
    and source_ref ~ '^[A-Za-z0-9_.:-]+$'
  ),
  source_contract_version text not null default
    'external-calc-original-supplier-source/v0'
    check (source_contract_version = 'external-calc-original-supplier-source/v0'),
  source_type text not null default 'ORIGINAL_SUPPLIER_TEXT'
    check (source_type = 'ORIGINAL_SUPPLIER_TEXT'),
  immutability text not null default 'APPEND_ONLY'
    check (immutability = 'APPEND_ONLY'),
  filename text not null check (
    length(filename) between 1 and 240
    and length(btrim(filename)) > 0
  ),
  created_by uuid not null,
  content_bytes bytea not null check (
    octet_length(content_bytes) between 1 and 1048576
  ), -- 1 MiB proposed cap, subject to operational acceptance
  content_sha256 text generated always as (
    'sha256:' || pg_catalog.encode(
      extensions.digest(content_bytes, 'sha256'), 'hex'
    )
  ) stored,
  created_at timestamptz not null default now(),
  primary key (tenant_id, source_ref)
);

-- Events change *visibility*, not original bytes. Irreversible by design
-- until explicit lifecycle and deletion policy are approved.
create table privado.extcalc_original_source_state_event_v0 (
  event_id bigint generated always as identity primary key,
  tenant_id uuid not null,
  source_ref text not null,
  event_type text not null check (event_type in ('QUARANTINED','REVOKED')),
  decided_by uuid not null,
  reason_ref text not null check (
    length(reason_ref) between 1 and 160
    and reason_ref ~ '^[A-Za-z0-9_.:-]+$'
  ),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, source_ref)
    references privado.extcalc_original_source_v0 (tenant_id, source_ref)
);

-- An UPDATE/DELETE cannot silently replace a raw source or rewrite audit
-- history even if grants later drift. This does NOT protect against a DBA,
-- superuser or DDL privileges; those are separately governed.
create function privado.extcalc_original_source_reject_mutation_v0()
returns trigger language plpgsql security invoker
set search_path = '' as $$
begin
  raise exception using errcode='42501',
    message='EXTCALC_SOURCE_APPEND_ONLY';
end
$$;

create trigger extcalc_source_no_update_delete_v0
before update or delete on privado.extcalc_original_source_v0
for each row execute function privado.extcalc_original_source_reject_mutation_v0();

create trigger extcalc_event_no_update_delete_v0
before update or delete on privado.extcalc_original_source_state_event_v0
for each row execute function privado.extcalc_original_source_reject_mutation_v0();

-- Source and event tables live in a private, NON-EXPOSED schema.
-- Do not migrate them into public without a new security gate.
alter table privado.extcalc_original_source_v0 enable row level security;
alter table privado.extcalc_original_source_v0 force row level security;
alter table privado.extcalc_original_source_state_event_v0 enable row level security;
alter table privado.extcalc_original_source_state_event_v0 force row level security;

create policy extcalc_original_tenant_owner_select_v0
on privado.extcalc_original_source_v0
for select to authenticated
using (
  (select auth.uid()) is not null
  and exists (
    select 1 from privado.extcalc_staging_membership_v0 m
    where m.user_id = (select auth.uid())
      and m.tenant_id = privado.extcalc_original_source_v0.tenant_id
      and m.member_role = 'dono' and m.active is true
  )
);

create policy extcalc_original_events_tenant_owner_select_v0
on privado.extcalc_original_source_state_event_v0
for select to authenticated
using (
  (select auth.uid()) is not null
  and exists (
    select 1 from privado.extcalc_staging_membership_v0 m
    where m.user_id = (select auth.uid())
      and m.tenant_id = privado.extcalc_original_source_state_event_v0.tenant_id
      and m.member_role = 'dono' and m.active is true
  )
);

-- No authenticated/anon write grants or INSERT/UPDATE/DELETE policies.
revoke all on privado.extcalc_original_source_v0 from public, anon, authenticated;
revoke all on privado.extcalc_original_source_state_event_v0 from public, anon, authenticated;
revoke all on function privado.extcalc_original_source_reject_mutation_v0()
  from public, anon, authenticated;

-- Required for security_invoker view and a future authenticated read-only
-- source reader. MUST confirm that 'privado' is not exposed to Data API.
grant select on privado.extcalc_original_source_v0 to authenticated;
grant select on privado.extcalc_original_source_state_event_v0 to authenticated;

-- Public metadata-only RLS-respecting view. Never include content_bytes,
-- filename, created_by, or supplier text in this HTTP projection.
create view public.extcalc_original_source_probe_v0
with (security_invoker = true) as
select
  src.tenant_id,
  src.source_ref,
  src.source_contract_version,
  src.source_type,
  src.immutability,
  case
    when exists (
      select 1
      from privado.extcalc_original_source_state_event_v0 ev
      where ev.tenant_id=src.tenant_id and ev.source_ref=src.source_ref
        and ev.event_type='REVOKED'
    ) then 'REVOKED'
    when exists (
      select 1
      from privado.extcalc_original_source_state_event_v0 ev
      where ev.tenant_id=src.tenant_id and ev.source_ref=src.source_ref
        and ev.event_type='QUARANTINED'
    ) then 'QUARANTINED'
    else 'AVAILABLE'
  end as state,
  src.content_sha256
from privado.extcalc_original_source_v0 src;

revoke all on public.extcalc_original_source_probe_v0
  from public, anon, authenticated;
grant select on public.extcalc_original_source_probe_v0 to authenticated;

-- Deliberately omitted pending approval:
-- * ingestion API / capture / server-derived tenant + actor with signed Auth
-- * privilege-separated seed path, event-append transaction, idempotency
-- * legal retention/deletion lifecycle, approved byte limit, monitoring
-- * any deployment, SQL execution, migrations or production data movement.
