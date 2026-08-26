-- migration aplicada: 20260826014833_fin_fatia1_schema
-- Fatia 1 do modulo Financeiro: caixa (fin_movimento) separado do resultado (venda).
-- Todas as tabelas fin_* sao DONO-ONLY: vendedor nao ve nada de financeiro.

-- ---------------------------------------------------------------- fin_conta
create table public.fin_conta (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null default privado.fn_tenant_atual() references public.tenant(id),
  codigo          text not null,
  rotulo          text not null,
  banco           text,
  tipo            text not null check (tipo in ('corrente','poupanca','dinheiro','cartao')),
  dominio_padrao  text not null default 'misto' check (dominio_padrao in ('empresa','pessoal','misto')),
  ativo           boolean not null default true,
  ordem           int not null default 0,
  criado_por      uuid default auth.uid() references public.app_usuario(id),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz,
  constraint fin_conta_tenant_codigo_uniq unique (tenant_id, codigo)
);
comment on table public.fin_conta is
  'Contas de onde o dinheiro entra e sai. Config: chave e o codigo (invariante 12), rotulo e editavel. dominio_padrao e so sugestao para a tela; NUNCA vira default de fin_movimento.dominio (invariante 18).';

-- ------------------------------------------------------------ fin_categoria
create table public.fin_categoria (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null default privado.fn_tenant_atual() references public.tenant(id),
  codigo             text not null,
  rotulo             text not null,
  grupo              text not null,
  natureza_esperada  text not null check (natureza_esperada in ('entrada','saida','neutro')),
  dominio_sugerido   text not null check (dominio_sugerido in ('empresa','pessoal','ambos')),
  ordem              int not null default 0,
  ativo              boolean not null default true,
  criado_por         uuid default auth.uid() references public.app_usuario(id),
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz,
  constraint fin_categoria_tenant_codigo_uniq unique (tenant_id, codigo)
);
comment on table public.fin_categoria is
  'Plano de contas. Config em tabela, nunca hardcoded em funcao (invariante 12): a chave e codigo, o rotulo e display editavel. grupo e a SECAO na tela. natureza_esperada = neutro (transferencia, aplicacao, resgate) fica FORA de todo total de gasto.';

-- ----------------------------------------------------------- fin_importacao
create table public.fin_importacao (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null default privado.fn_tenant_atual() references public.tenant(id),
  conta_id               uuid not null references public.fin_conta(id),
  arquivo                text,
  banco                  text,
  periodo_ini            date,
  periodo_fim            date,
  saldo_final_informado   numeric(14,2),
  linhas_lidas           int not null default 0,
  linhas_novas           int not null default 0,
  linhas_duplicadas      int not null default 0,
  enviado_em             timestamptz not null default now(),
  enviado_por            uuid default auth.uid()
);
comment on table public.fin_importacao is
  'Um envio de extrato OFX. arquivo e o ponteiro no bucket privado extrato. Append-only para authenticated (SELECT + INSERT); as contagens sao fechadas por privado.fn_fin_importacao_fechar, chamada so pela RPC.';

-- ------------------------------------------------------------ fin_movimento
create table public.fin_movimento (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null default privado.fn_tenant_atual() references public.tenant(id),
  conta_id            uuid not null references public.fin_conta(id),
  data                date not null,
  descricao           text not null,
  descricao_original  text,
  valor               numeric(14,2) not null check (valor <> 0),
  categoria_codigo    text,
  dominio             text check (dominio in ('empresa','pessoal')),
  origem              text not null check (origem in ('extrato','manual','venda')),
  fitid               text,
  hash_dedupe         text not null,
  importacao_id       uuid references public.fin_importacao(id),
  venda_id            uuid references public.venda(id),
  observacao          text,
  criado_por          uuid default auth.uid() references public.app_usuario(id),
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz,
  arquivado_em        timestamptz,
  constraint fin_movimento_categoria_fk
    foreign key (tenant_id, categoria_codigo)
    references public.fin_categoria (tenant_id, codigo) on update cascade
);
comment on table public.fin_movimento is
  'CAIXA. Nunca se soma com venda, que e RESULTADO por competencia. valor carrega SINAL (negativo = saida); natureza (entrada/saida) e derivada na leitura, nunca coluna (invariante 4). dominio nasce NULL e nao tem default: movimento sem dominio nao entra em nenhum total (invariante 18). Remocao e soft delete por arquivado_em, nunca DELETE.';
comment on column public.fin_movimento.venda_id is
  'Conciliacao caixa x resultado. A coluna nasce na Fatia 1 sem consumidor: a fatia de conciliacao le daqui, e vinculo nao se constroi retroativamente.';
comment on column public.fin_movimento.hash_dedupe is
  'md5(conta_id|data|valor|descricao_base|ocorrencia). A ocorrencia e o indice da linha dentro do grupo de linhas identicas do MESMO arquivo: sem ela, duas compras iguais no mesmo dia (dois Ubers de R$ 20) colidiriam e uma sumiria calada do caixa.';

-- ------------------------------------------------------------------ indices
create unique index fin_mov_fitid_uniq on public.fin_movimento (tenant_id, conta_id, fitid)
  where fitid is not null and arquivado_em is null;
create unique index fin_mov_hash_uniq on public.fin_movimento (tenant_id, conta_id, hash_dedupe)
  where arquivado_em is null;
create index fin_mov_data_idx on public.fin_movimento (tenant_id, data desc);
create index fin_mov_naoclass_idx on public.fin_movimento (tenant_id, data desc)
  where dominio is null and arquivado_em is null;
create index fin_mov_importacao_idx on public.fin_movimento (importacao_id) where importacao_id is not null;
create index fin_mov_venda_idx on public.fin_movimento (venda_id) where venda_id is not null;
create index fin_imp_conta_idx on public.fin_importacao (tenant_id, enviado_em desc);

-- ---------------------------------------------------------------------- RLS
alter table public.fin_conta      enable row level security;
alter table public.fin_categoria  enable row level security;
alter table public.fin_importacao enable row level security;
alter table public.fin_movimento  enable row level security;

create policy fin_conta_sel on public.fin_conta for select to authenticated
  using (tenant_id = privado.fn_tenant_atual() and privado.fn_papel_atual() = 'dono');

create policy fin_categoria_sel on public.fin_categoria for select to authenticated
  using (tenant_id = privado.fn_tenant_atual() and privado.fn_papel_atual() = 'dono');

create policy fin_importacao_sel on public.fin_importacao for select to authenticated
  using (tenant_id = privado.fn_tenant_atual() and privado.fn_papel_atual() = 'dono');
create policy fin_importacao_ins on public.fin_importacao for insert to authenticated
  with check (tenant_id = privado.fn_tenant_atual() and privado.fn_papel_atual() = 'dono');

create policy fin_movimento_sel on public.fin_movimento for select to authenticated
  using (tenant_id = privado.fn_tenant_atual() and privado.fn_papel_atual() = 'dono');
create policy fin_movimento_ins on public.fin_movimento for insert to authenticated
  with check (tenant_id = privado.fn_tenant_atual() and privado.fn_papel_atual() = 'dono');
create policy fin_movimento_upd on public.fin_movimento for update to authenticated
  using (tenant_id = privado.fn_tenant_atual() and privado.fn_papel_atual() = 'dono')
  with check (tenant_id = privado.fn_tenant_atual() and privado.fn_papel_atual() = 'dono');

-- ------------------------------------------------------------------- grants
-- privilegio minimo: nenhum DELETE, nenhum TRUNCATE (invariante 9).
grant select on public.fin_conta      to authenticated;
grant select on public.fin_categoria  to authenticated;
grant select, insert on public.fin_importacao to authenticated;
grant select, insert, update on public.fin_movimento to authenticated;

-- --------------------------------------------------------------- auditoria
create trigger trg_auditar_fin_conta      after insert or update or delete on public.fin_conta
  for each row execute function public.fn_auditar();
create trigger trg_auditar_fin_categoria  after insert or update or delete on public.fin_categoria
  for each row execute function public.fn_auditar();
create trigger trg_auditar_fin_importacao after insert or update or delete on public.fin_importacao
  for each row execute function public.fn_auditar();
create trigger trg_auditar_fin_movimento  after insert or update or delete on public.fin_movimento
  for each row execute function public.fn_auditar();
