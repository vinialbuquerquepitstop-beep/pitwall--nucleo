-- EXTERNAL CALC B | 00 production tenancy (multi-store product). Owner decision 2026-11-23: the External Calc is an
-- independent product that serves several stores. Same identity contract as the Núcleo calculator it shares engines
-- with (public.tenant, public.app_usuario, privado.fn_tenant_atual, privado.fn_papel_atual), so the calculator
-- (calc_*) and External Calc product (extcalc_*) migrations apply unchanged.
-- Roles: dono (owner), gerente, operador, vendedor (seller, kept for engine compatibility) and servico (service
-- account of an integration such as the Pitwall CRM: read and simulate, never administer).
create schema if not exists privado;
revoke all on schema privado from public, anon;

create table if not exists public.tenant (
 id uuid primary key default gen_random_uuid(),
 nome text not null check (char_length(btrim(nome)) between 2 and 120),
 criado_em timestamptz not null default now()
);
create table if not exists public.app_usuario (
 id uuid primary key references auth.users(id) on delete cascade,
 tenant_id uuid not null references public.tenant(id) on delete restrict,
 nome text not null,
 papel text not null check (papel in ('dono','gerente','operador','vendedor','servico')),
 ativo boolean not null default true,
 criado_em timestamptz not null default now()
);
create index if not exists app_usuario_tenant_ix on public.app_usuario(tenant_id);
alter table public.tenant enable row level security;
alter table public.app_usuario enable row level security;
revoke all on public.tenant, public.app_usuario from public, anon, authenticated;
grant select on public.tenant, public.app_usuario to authenticated;

-- One active membership per user (a user belongs to one store), resolved only on the server from auth.uid().
create or replace function privado.fn_tenant_atual() returns uuid
language sql stable security definer set search_path to '' as $$
 select u.tenant_id from public.app_usuario u where u.id = (select auth.uid()) and u.ativo
$$;
create or replace function privado.fn_papel_atual() returns text
language sql stable security definer set search_path to '' as $$
 select u.papel from public.app_usuario u where u.id = (select auth.uid()) and u.ativo
$$;
revoke all on function privado.fn_tenant_atual(), privado.fn_papel_atual() from public, anon;
grant execute on function privado.fn_tenant_atual(), privado.fn_papel_atual() to authenticated;
grant usage on schema privado to authenticated;

create policy tenant_self_read on public.tenant for select to authenticated using (id = privado.fn_tenant_atual());
create policy app_usuario_same_tenant_read on public.app_usuario for select to authenticated
 using (tenant_id = privado.fn_tenant_atual());
