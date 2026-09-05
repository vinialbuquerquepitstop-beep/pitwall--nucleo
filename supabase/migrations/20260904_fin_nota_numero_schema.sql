-- migration aplicada: 20260905022511_20260904_fin_nota_numero_schema
--
-- NOTA DE NOME: o ledger carimba a version em UTC e o nome do arquivo segue a data de
-- operacao (America/Sao_Paulo). Esta migration foi aplicada em 04/09/2026 23:25 em Sao
-- Paulo, que e 05/09/2026 02:25 UTC. Nao e arquivo fora de ordem, e a virada do dia.
--
-- E1, passo 1: mecanismo GENERICO de nota de mudanca de numero.
--
-- POR QUE
-- Portao 6.3 do CONTRATO: nenhum numero da tela pode mudar de valor sem que a MESMA
-- entrega traga a explicacao na tela. Ate hoje nao existia onde guardar essa explicacao,
-- entao a divida do 6.3 se pagava em handoff, que o dono nao le enquanto opera.
-- Esta tabela e o lugar. Nao e um texto da Thay: e o mecanismo que a E2 reusa.
--
-- DESENHO
-- Uma linha = um numero da tela que mudou, num mes de competencia, com o valor de antes,
-- o valor de depois e a causa em UMA frase escrita para o dono.
-- 'codigo' e a chave estavel da nota (Inv. 12) e e o que torna o seed idempotente.
-- 'escopo' e o codigo do numero explicado, e e o que diz a tela ONDE colar a nota.
--   Conjunto fechado, casado com as chaves que fin_painel ja serve.
-- 'diferenca' e coluna gerada: a tela nunca recalcula e nunca diverge.
-- 'competencia' e sempre o primeiro dia do mes, travado por CHECK.
-- 'mudou_em' e data de negocio: quem grava calcula no fuso de Sao Paulo (Inv. 10).
--   Nao ha default aqui de proposito: a data da mudanca e a data do FATO, que pode ser
--   anterior a data em que a nota e escrita, e um default com now() mentiria nesse caso.
--
-- PRIVILEGIO (Inv. 9)
-- 'authenticated' recebe SELECT e mais nada. Nota nasce por migration, junto da entrega
-- que mexeu no numero, nunca pela tela: nao existe caminho de escrita no app, entao nao
-- existe grant de escrita. Sem INSERT/UPDATE/DELETE e sem policy para eles, o banco falha
-- fechado se alguem conceder o grant sem escrever a policy.
-- Supabase concede ALL por default privilege em toda tabela nova de public: o REVOKE
-- abaixo nao e decorativo, e o que impede anon e authenticated de nascerem com tudo.
-- 'arquivado_em' existe para que a unica remocao possivel no futuro seja soft; hoje
-- ninguem pode escrever nela, e isso e proposital.
--
-- APPEND-ONLY (Inv. 6): auditada por public.fn_auditar(), no molde de fin_regra.

create table if not exists public.fin_nota_numero (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null default privado.fn_tenant_atual()
                  references public.tenant(id),
  codigo        text not null,
  escopo        text not null,
  competencia   date not null,
  valor_antes   numeric(14,2) not null,
  valor_depois  numeric(14,2) not null,
  diferenca     numeric(14,2) generated always as (valor_depois - valor_antes) stored,
  causa         text not null,
  mudou_em      date not null,
  criado_por    uuid references public.app_usuario(id) default auth.uid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz,
  arquivado_em  timestamptz,
  constraint fin_nota_numero_codigo_uk
    unique (tenant_id, codigo),
  constraint fin_nota_numero_codigo_check
    check (codigo ~ '^[a-z0-9_]{3,64}$'),
  constraint fin_nota_numero_escopo_check
    check (escopo = any (array[
      'saldo','saldo_empresa','saldo_pessoal',
      'entrou','saiu','gasto','estoque',
      'pct_julgado','lucro'])),
  constraint fin_nota_numero_competencia_check
    check (competencia = date_trunc('month', competencia)::date),
  constraint fin_nota_numero_causa_check
    check (btrim(causa) <> '' and length(causa) <= 400),
  constraint fin_nota_numero_mudou_de_fato_check
    check (valor_antes is distinct from valor_depois)
);

comment on table public.fin_nota_numero is
  'Nota de mudanca de numero. Uma linha = um numero da tela que mudou de valor, com o antes, o depois e a causa em uma frase para o dono. Existe para pagar o portao 6.3 do CONTRATO na TELA, nao no handoff. codigo e a chave (Inv. 12) e e o que torna o seed idempotente; escopo diz a tela onde colar. Escrita so por migration: authenticated tem SELECT e mais nada. Remocao, se um dia existir, e soft por arquivado_em, nunca DELETE (Inv. 9).';

comment on column public.fin_nota_numero.escopo is
  'Codigo do numero explicado, conjunto fechado casado com as chaves de fin_painel. Valor novo exige migration, de proposito: escopo livre viraria nota que a tela nao sabe onde colar.';

comment on column public.fin_nota_numero.mudou_em is
  'Data do FATO que mudou o numero, no fuso America/Sao_Paulo (Inv. 10). Sem default: a data da mudanca pode ser anterior a data em que a nota e escrita.';

create index if not exists fin_nota_numero_comp_ix
  on public.fin_nota_numero (tenant_id, competencia)
  where arquivado_em is null;

alter table public.fin_nota_numero enable row level security;

drop policy if exists fin_nota_numero_sel on public.fin_nota_numero;
create policy fin_nota_numero_sel on public.fin_nota_numero
  for select to authenticated
  using (tenant_id = privado.fn_tenant_atual()
         and privado.fn_papel_atual() = 'dono');

revoke all on public.fin_nota_numero from public;
revoke all on public.fin_nota_numero from anon;
revoke all on public.fin_nota_numero from authenticated;
grant select on public.fin_nota_numero to authenticated;

drop trigger if exists trg_auditar_fin_nota_numero on public.fin_nota_numero;
create trigger trg_auditar_fin_nota_numero
  after insert or delete or update on public.fin_nota_numero
  for each row execute function public.fn_auditar();
