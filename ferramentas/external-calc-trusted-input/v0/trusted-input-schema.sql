-- External Calc Trusted Input V0
-- Server-owned immutable ingestion/source evidence. RLS is tenant scoped through app_usuario.

create table if not exists public.extcalc_trusted_input_originals (
  tenant_id uuid not null,
  ingestion_id text not null,
  actor_ref uuid not null,
  filename text not null,
  content_type text not null,
  byte_length bigint not null check (byte_length > 0),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  content_base64 text not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, ingestion_id)
);

create table if not exists public.extcalc_trusted_input_sources (
  tenant_id uuid not null,
  source_id text not null,
  ingestion_id text not null,
  actor_ref uuid not null,
  trusted_input_ref text not null,
  filename text not null,
  content_type text not null,
  byte_length bigint not null check (byte_length > 0),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  container_sha256 text,
  content_base64 text not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, source_id),
  unique (tenant_id, trusted_input_ref),
  foreign key (tenant_id, ingestion_id)
    references public.extcalc_trusted_input_originals(tenant_id, ingestion_id)
);

alter table public.extcalc_trusted_input_originals enable row level security;
alter table public.extcalc_trusted_input_sources enable row level security;

drop policy if exists extcalc_trusted_input_originals_tenant on public.extcalc_trusted_input_originals;
create policy extcalc_trusted_input_originals_tenant on public.extcalc_trusted_input_originals
for select using (
  exists (select 1 from public.app_usuario u where u.id = auth.uid() and u.tenant_id = tenant_id and u.ativo = true)
);

drop policy if exists extcalc_trusted_input_sources_tenant on public.extcalc_trusted_input_sources;
create policy extcalc_trusted_input_sources_tenant on public.extcalc_trusted_input_sources
for select using (
  exists (select 1 from public.app_usuario u where u.id = auth.uid() and u.tenant_id = tenant_id and u.ativo = true)
);

-- No client INSERT/UPDATE/DELETE policy by design. Writes belong to the authenticated server boundary.
