-- =====================================================================
-- Pit Wall 2.0 (Nucleo) - Esqueleto de schema da Fase 0
-- =====================================================================
-- NAO RODAR CEGO. Este e um starter para ADAPTAR. O schema real ja esta
-- vivo no projeto unjzpyexgtbcmjfgcqrx; use isto como referencia do
-- PADRAO (tenant_id + RLS + helper em privado + auditoria por trigger),
-- nao como source of truth. A source of truth e o banco (list_tables).
--
-- Preferir aplicar via MCP apply_migration (transacional, lida com acento).
-- Rodar o advisor de seguranca depois: get_advisors type=security.
-- =====================================================================

-- 1) Schemas -----------------------------------------------------------
create schema if not exists privado;   -- helpers de RLS, invisiveis a API

-- 2) Helpers de RLS (schema privado, nunca public) ---------------------
-- Resolvem tenant e papel do usuario logado a partir do JWT / app_usuario.
create or replace function privado.fn_tenant_atual()
returns uuid
language sql stable
security definer
set search_path = privado, public
as $$
  select u.tenant_id
  from public.app_usuario u
  where u.id = auth.uid()
  limit 1
$$;

create or replace function privado.fn_papel_atual()
returns text
language sql stable
security definer
set search_path = privado, public
as $$
  select u.papel
  from public.app_usuario u
  where u.id = auth.uid()
  limit 1
$$;

-- ACLs: apos todo CREATE OR REPLACE FUNCTION, refazer os grants.
revoke all on function privado.fn_tenant_atual() from public, anon;
revoke all on function privado.fn_papel_atual() from public, anon;

-- 3) Tenant e usuarios -------------------------------------------------
create table if not exists public.tenant (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  criado_em  timestamptz not null default now()
);

create table if not exists public.app_usuario (
  id         uuid primary key,                    -- = auth.users.id
  tenant_id  uuid not null references public.tenant(id),
  nome       text not null,
  papel      text not null check (papel in ('dono','vendedor')),
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);

-- 4) Lead (nucleo do CRM, subconjunto do schema real) ------------------
create table if not exists public.lead (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenant(id),
  lead_code         text not null,                -- LEAD-0001, chave humana estavel
  dono_user_id      uuid references public.app_usuario(id),
  nome              text not null,
  whatsapp_digitos  text check (whatsapp_digitos ~ '^[0-9]{10,15}$'),
  produto           text,
  condicao          text check (condicao in ('lacrado','vitrine','seminovo')),
  perfil            text check (perfil in
                      ('compra_imediata','avaliando','em_espera',
                       'repescagem','comprou','consulta')),
  origem            text check (origem in
                      ('indicacao','instagram','whatsapp_direto','loja_fisica',
                       'prospeccao_ativa','parceria_influencer',
                       'parceria_pag_local','whatsapp_status')),
  status            text not null default 'pendente'
                      check (status in
                      ('pendente','feito','convertido','lista_fria','cancelado')),
  etapa_cadencia    text check (etapa_cadencia in ('conversando','negociacao_parada')),
  observacoes       text,
  data_contato      date,
  proximo_contato   date,
  ultima_resposta   date,
  ultimo_toque_em   timestamptz,
  respondido_em     timestamptz,
  consentimento     boolean not null default true,
  consentimento_em  timestamptz,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),
  arquivado_em      timestamptz
  -- Nota: NIVEL (quente/morno/frio) nao e coluna. E derivado na leitura.
);

-- 5) Historico append-only ---------------------------------------------
create table if not exists public.lead_evento (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenant(id),
  lead_id    uuid not null references public.lead(id),
  tipo       text not null,                        -- ver enum real em modelo-de-dados.md
  detalhe    text,
  criado_por uuid references public.app_usuario(id),
  criado_em  timestamptz not null default now()
);

-- 6) Auditoria append-only + trigger generico --------------------------
create table if not exists public.auditoria (
  id          bigint generated always as identity primary key,
  tenant_id   uuid,
  tabela      text not null,
  registro_id text not null,
  acao        text not null check (acao in ('INSERT','UPDATE','DELETE')),
  antes       jsonb,
  depois      jsonb,
  usuario_id  uuid,
  criado_em   timestamptz not null default now()
);

create or replace function privado.fn_auditar()
returns trigger
language plpgsql
security definer
set search_path = privado, public
as $$
begin
  insert into public.auditoria(tenant_id, tabela, registro_id, acao, antes, depois, usuario_id)
  values (
    coalesce(new.tenant_id, old.tenant_id),
    tg_table_name,
    coalesce(new.id::text, old.id::text),
    tg_op,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end,
    auth.uid()
  );
  return coalesce(new, old);
end;
$$;

create trigger trg_auditar_lead
  after insert or update or delete on public.lead
  for each row execute function privado.fn_auditar();

-- 7) RLS ---------------------------------------------------------------
alter table public.tenant       enable row level security;
alter table public.app_usuario  enable row level security;
alter table public.lead         enable row level security;
alter table public.lead_evento  enable row level security;
alter table public.auditoria    enable row level security;

-- Padrao: isolar por tenant do usuario logado. Adaptar por papel onde precisar.
create policy lead_tenant_isolado on public.lead
  for all
  using (tenant_id = privado.fn_tenant_atual())
  with check (tenant_id = privado.fn_tenant_atual());

create policy lead_evento_tenant_isolado on public.lead_evento
  for all
  using (tenant_id = privado.fn_tenant_atual())
  with check (tenant_id = privado.fn_tenant_atual());

-- Auditoria: leitura isolada por tenant, escrita so via trigger (sem policy de insert
-- para authenticated; o trigger roda como security definer).
create policy auditoria_leitura on public.auditoria
  for select
  using (tenant_id = privado.fn_tenant_atual());

-- 8) Privilegios minimos ----------------------------------------------
-- authenticated NUNCA com TRUNCATE. anon sem nada.
revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- =====================================================================
-- Depois de aplicar: rodar get_advisors (security). Zero resultado = ok.
-- Testar RLS como dono, como vendedor e como tenant errado antes de confiar.
-- =====================================================================
