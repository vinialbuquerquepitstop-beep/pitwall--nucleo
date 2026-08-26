-- migration aplicada: 20260826132629_fin_fatia2_regra_schema
-- Fatia 2 do modulo Financeiro: regras de classificacao automatica.
-- A tabela nasce VAZIA de proposito: quem decide o que e cada gasto e o dono,
-- nunca o sistema. Inferir dominio seria adivinhar (invariante 18).

-- ------------------------------------------------------------ normalizador
-- unaccent NAO esta instalado neste projeto (installed_version = null) e a
-- instrucao foi nao instalar sem aviso. Este translate faz o mesmo servico para
-- o portugues, e IMMUTABLE (serve em indice) e nao depende de extensao.
-- Reverter para casamento sensivel a acento = trocar o corpo por upper(t).
create or replace function privado.fn_fin_norm(t text)
returns text
language sql
immutable
as $$
  select upper(translate(coalesce(t, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'));
$$;
comment on function privado.fn_fin_norm(text) is
  'Normaliza texto para casamento de regra: tira acento (translate, sem depender da extensao unaccent) e sobe para maiuscula. IMMUTABLE porque o indice unico de fin_regra depende dela.';

-- escapa os metacaracteres de LIKE do padrao digitado pelo dono.
-- Sem isso, um padrao com _ casaria qualquer caractere e um com % casaria tudo.
create or replace function privado.fn_fin_esc(p text)
returns text
language sql
immutable
as $$
  select replace(replace(replace(privado.fn_fin_norm(p), '\', '\\'), '%', '\%'), '_', '\_');
$$;

create or replace function privado.fn_fin_casa(p_alvo_norm text, p_padrao text, p_tipo text)
returns boolean
language sql
immutable
as $$
  select case p_tipo
    when 'exato'  then p_alvo_norm = privado.fn_fin_norm(p_padrao)
    when 'comeca' then p_alvo_norm like privado.fn_fin_esc(p_padrao) || '%' escape '\'
    else               p_alvo_norm like '%' || privado.fn_fin_esc(p_padrao) || '%' escape '\'
  end;
$$;

revoke all on function privado.fn_fin_norm(text) from public;
revoke all on function privado.fn_fin_esc(text)  from public;
revoke all on function privado.fn_fin_casa(text,text,text) from public;
grant execute on function privado.fn_fin_norm(text) to authenticated;
grant execute on function privado.fn_fin_esc(text)  to authenticated;
grant execute on function privado.fn_fin_casa(text,text,text) to authenticated;

-- ----------------------------------------------------------------- fin_regra
create table public.fin_regra (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null default privado.fn_tenant_atual() references public.tenant(id),
  padrao            text not null check (btrim(padrao) <> ''),
  tipo_match        text not null default 'contem' check (tipo_match in ('contem','comeca','exato')),
  categoria_codigo  text,
  dominio           text check (dominio in ('empresa','pessoal')),
  prioridade        int not null default 100,
  ativo             boolean not null default true,
  origem            text not null default 'aprendida' check (origem in ('manual','aprendida')),
  aplicada_n        int not null default 0,
  ultima_aplicacao  timestamptz,
  criado_por        uuid default auth.uid() references public.app_usuario(id),
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz,
  arquivado_em      timestamptz,
  constraint fin_regra_classifica_algo check (categoria_codigo is not null or dominio is not null),
  constraint fin_regra_categoria_fk
    foreign key (tenant_id, categoria_codigo)
    references public.fin_categoria (tenant_id, codigo) on update cascade
);
comment on table public.fin_regra is
  'Regras de classificacao automatica de fin_movimento. Nasce VAZIA: quem decide que MUDAVENDING e alimentacao/pessoal e o dono, nunca o sistema (invariante 18). Menor prioridade ganha; desempate por padrao mais LONGO (mais especifico), depois criado_em mais recente. Remocao e soft delete por arquivado_em, nunca DELETE.';
comment on column public.fin_regra.padrao is
  'Texto a casar contra coalesce(descricao_original, descricao). Comparado NORMALIZADO (sem acento, maiusculo) e com os metacaracteres de LIKE escapados.';
comment on column public.fin_regra.aplicada_n is
  'Quantos movimentos esta regra JA classificou de fato, acumulado. So sobe quando a aplicacao muda alguma coluna: rodar de novo sem efeito nao infla o contador.';
comment on column public.fin_regra.origem is
  'aprendida = nasceu de fin_regra_sugerir a partir de um lancamento real; manual = o dono digitou o padrao.';

create unique index fin_regra_padrao_uniq
  on public.fin_regra (tenant_id, privado.fn_fin_norm(padrao), tipo_match)
  where arquivado_em is null;
create index fin_regra_ativa_idx
  on public.fin_regra (tenant_id, prioridade, id)
  where ativo and arquivado_em is null;
create index fin_regra_categoria_idx
  on public.fin_regra (tenant_id, categoria_codigo)
  where categoria_codigo is not null;

-- ---------------------------------------------------------------------- RLS
alter table public.fin_regra enable row level security;

create policy fin_regra_sel on public.fin_regra for select to authenticated
  using (tenant_id = privado.fn_tenant_atual() and privado.fn_papel_atual() = 'dono');
create policy fin_regra_ins on public.fin_regra for insert to authenticated
  with check (tenant_id = privado.fn_tenant_atual() and privado.fn_papel_atual() = 'dono');
create policy fin_regra_upd on public.fin_regra for update to authenticated
  using (tenant_id = privado.fn_tenant_atual() and privado.fn_papel_atual() = 'dono')
  with check (tenant_id = privado.fn_tenant_atual() and privado.fn_papel_atual() = 'dono');

-- ------------------------------------------------------------------- grants
-- privilegio minimo: nenhum DELETE, nenhum TRUNCATE (invariante 9).
grant select, insert, update on public.fin_regra to authenticated;

-- ---------------------------------------------------------------- auditoria
create trigger trg_auditar_fin_regra after insert or update or delete on public.fin_regra
  for each row execute function public.fn_auditar();
