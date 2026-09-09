-- Bloco 1.1 do plano 2026-09-05-calculadora-produto.
-- tenant_id NULO = linha de SEMENTE: copiada uma vez no nascimento da conta e
-- NUNCA lida em execucao (decisao do dono, 07/09/2026, D5). tenant_id preenchido
-- = catalogo daquele lojista, e quem o mantem e ele.
-- A unique carrega o tenant, senao o segundo cliente que cadastrar
-- "iPhone 18 Pro Max 256GB" colide com o primeiro. `nulls not distinct` mantem a
-- semente unica entre si.

create table public.calc_modelo (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references public.tenant(id),
  codigo     text not null,                 -- invariante 12: a chave e o codigo
  nome       text not null,                 -- nome canonico exibido
  categoria  text not null,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now(),
  constraint calc_modelo_u unique nulls not distinct (tenant_id, codigo),
  constraint calc_modelo_categoria_ck check (categoria in
    ('iPhone','iPad','MacBook','Apple Watch','Acessório','1ª Linha','Garmin','Moto Elétrica'))
);

create table public.calc_cor (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenant(id),
  codigo    text not null,
  nome      text not null,
  hex       text not null,
  ativo     boolean not null default true,
  criado_em timestamptz not null default now(),
  constraint calc_cor_u unique nulls not distinct (tenant_id, codigo),
  constraint calc_cor_hex_ck check (hex ~ '^#[0-9a-f]{6}$')
);

create table public.calc_alias (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references public.tenant(id),
  tipo       text not null,
  texto      text not null,               -- como o fornecedor escreve
  aponta     text not null,               -- codigo canonico de destino
  criado_em  timestamptz not null default now(),
  constraint calc_alias_tipo_ck check (tipo in ('modelo','cor','condicao','fornecedor')),
  constraint calc_alias_u unique nulls not distinct (tenant_id, tipo, texto)
);

create table public.calc_fornecedor (
  id         uuid not null default gen_random_uuid(),
  tenant_id  uuid not null references public.tenant(id),
  codigo     text not null,
  nome       text not null,
  praca      text not null,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now(),
  primary key (id),
  constraint calc_fornecedor_u unique (tenant_id, codigo)
);

-- prioridade: a ordem de condicao e COLUNA, nunca ordem de insercao. CPO (10) e
-- testado ANTES de Lacrado (20): em 27/07/2026 a ordem errada gerou 341 produtos
-- com zero CPO, com CPO farto nas listas.
create table public.calc_regra (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references public.tenant(id),
  tipo       text not null,
  padrao     text not null,
  acao       text not null,
  valor      text,
  prioridade integer not null default 100,
  motivo     text,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now(),
  constraint calc_regra_tipo_ck check (tipo in ('descarte','token','outlier','condicao')),
  constraint calc_regra_acao_ck check (acao in ('descartar','pendencia','substituir','aceitar')),
  constraint calc_regra_u unique nulls not distinct (tenant_id, tipo, padrao)
);

alter table public.calc_modelo     enable row level security;
alter table public.calc_cor        enable row level security;
alter table public.calc_alias      enable row level security;
alter table public.calc_fornecedor enable row level security;
alter table public.calc_regra      enable row level security;

-- As CINCO filtram igual, e NENHUMA faz "or tenant_id is null". Linha de semente
-- e invisivel em execucao de proposito: se vazasse, o dono do produto herdaria
-- por acidente a obrigacao de manter catalogo, que ele recusou em 07/09/2026.
create policy calc_modelo_sel on public.calc_modelo for select to authenticated
  using (ativo and tenant_id = privado.fn_tenant_atual());
create policy calc_cor_sel on public.calc_cor for select to authenticated
  using (ativo and tenant_id = privado.fn_tenant_atual());
create policy calc_alias_sel on public.calc_alias for select to authenticated
  using (tenant_id = privado.fn_tenant_atual());
create policy calc_regra_sel on public.calc_regra for select to authenticated
  using (tenant_id = privado.fn_tenant_atual());

-- fornecedor e praca sao dado de CUSTO: o vendedor nao ve.
create policy calc_fornecedor_sel on public.calc_fornecedor for select to authenticated
  using (tenant_id = privado.fn_tenant_atual() and privado.fn_papel_atual() = 'dono');

-- Nenhuma policy de INSERT, UPDATE ou DELETE em nenhuma das cinco: escrita so por
-- RPC SECURITY DEFINER (Bloco 2). Invariante 9: authenticated nunca recebe TRUNCATE.
grant select on public.calc_modelo, public.calc_cor, public.calc_alias,
                public.calc_fornecedor, public.calc_regra to authenticated;

create index calc_modelo_tenant_ix     on public.calc_modelo (tenant_id, categoria);
create index calc_cor_tenant_ix        on public.calc_cor (tenant_id);
create index calc_alias_tenant_ix      on public.calc_alias (tenant_id, tipo);
create index calc_fornecedor_tenant_ix on public.calc_fornecedor (tenant_id);
create index calc_regra_tenant_ix      on public.calc_regra (tenant_id, tipo, prioridade);
