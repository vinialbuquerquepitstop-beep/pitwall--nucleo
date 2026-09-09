-- Bloco 2.1 — schema de carga da calculadora.
-- Plano: docs/superpowers/plans/2026-09-05-calculadora-produto.md, secao 2.1
--
-- Restricao global 10: nenhuma FK de calc_* para tabela de operacao. So `tenant`.
-- Invariante 6 : append-only para `authenticated` (SELECT apenas; escrita so por RPC).
-- Invariante 7 : toda tabela de dado tem tenant_id e policy que o usa.
-- Invariante 9 : `authenticated` nunca recebe TRUNCATE.
-- Invariante 10: data de negocio no fuso do Brasil, nunca CURRENT_DATE.
--
-- Custo de fornecedor e dado do DONO: as tres tabelas exigem papel `dono`,
-- igual a calc_dados e calc_fornecedor. O vendedor nao ve carga nenhuma.

create table if not exists public.calc_carga (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenant(id),
  status        text not null default 'rascunho',
  origem        text,
  blob_proposto jsonb,
  -- `resumo` guarda o que a tela precisa mostrar e o blob nao carrega:
  -- os cabecalhos achados (passo 2 do wizard) e a quebra dos descartes por
  -- motivo (passo 4). Sem ele o passo 2 nao tem o que exibir. Ver a nota
  -- "correcoes do plano" no handoff.
  resumo        jsonb not null default '{}'::jsonb,
  n_lidas       int not null default 0,
  n_casou       int not null default 0,
  n_duvidoso    int not null default 0,
  n_descarte    int not null default 0,
  n_pendencia   int not null default 0,
  aprovado_por  uuid,
  aprovado_em   timestamptz,
  criado_em     timestamptz not null default now(),
  constraint calc_carga_status_ck check (status in ('rascunho','aprovada','descartada'))
);

create index if not exists calc_carga_tenant_ix
  on public.calc_carga (tenant_id, criado_em desc);

create table if not exists public.calc_pendencia (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenant(id),
  carga_id    uuid not null references public.calc_carga(id) on delete cascade,
  causa       text not null,
  tipo        text not null,
  texto       text not null,
  n_linhas    int  not null default 1,
  exemplo     text,
  decisao     text,
  aponta      text,
  decidido_em timestamptz,
  criado_em   timestamptz not null default now(),
  constraint calc_pendencia_tipo_ck
    check (tipo in ('modelo','cor','fornecedor','condicao','preco','capacidade')),
  constraint calc_pendencia_decisao_ck
    check (decisao is null or decisao in ('apontar','descartar','ignorar'))
);

-- Uma pendencia por (tipo, texto) dentro da carga. E a regra "agrupar por
-- CAUSA, nunca por linha": cem linhas de cor PURPLE sao UMA pendencia. Sem a
-- unique, um reprocessamento duplica e o dono decide a mesma coisa duas vezes.
create unique index if not exists calc_pendencia_grupo_ix
  on public.calc_pendencia (carga_id, tipo, texto);

create index if not exists calc_pendencia_tenant_ix
  on public.calc_pendencia (tenant_id, carga_id);

create table if not exists public.calc_uso (
  tenant_id     uuid not null references public.tenant(id),
  competencia   date not null,          -- primeiro dia do mes, fuso do Brasil
  linhas_modelo int  not null default 0,
  credito_extra int  not null default 0,
  primary key (tenant_id, competencia)
);

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.calc_carga     enable row level security;
alter table public.calc_pendencia enable row level security;
alter table public.calc_uso       enable row level security;

drop policy if exists calc_carga_sel     on public.calc_carga;
drop policy if exists calc_pendencia_sel on public.calc_pendencia;
drop policy if exists calc_uso_sel       on public.calc_uso;

-- SELECT apenas. Nenhuma policy de INSERT/UPDATE/DELETE em lugar nenhum: o
-- unico caminho de escrita sao as RPCs SECURITY DEFINER, e la o tenant_id vem
-- de privado.fn_tenant_atual(), nunca do payload do cliente.
create policy calc_carga_sel on public.calc_carga
  for select to authenticated
  using (tenant_id = privado.fn_tenant_atual() and privado.fn_papel_atual() = 'dono');

create policy calc_pendencia_sel on public.calc_pendencia
  for select to authenticated
  using (tenant_id = privado.fn_tenant_atual() and privado.fn_papel_atual() = 'dono');

create policy calc_uso_sel on public.calc_uso
  for select to authenticated
  using (tenant_id = privado.fn_tenant_atual() and privado.fn_papel_atual() = 'dono');

-- ── GRANT ──────────────────────────────────────────────────────────────────
revoke all on public.calc_carga     from authenticated, anon;
revoke all on public.calc_pendencia from authenticated, anon;
revoke all on public.calc_uso       from authenticated, anon;

grant select on public.calc_carga     to authenticated;
grant select on public.calc_pendencia to authenticated;
grant select on public.calc_uso       to authenticated;
