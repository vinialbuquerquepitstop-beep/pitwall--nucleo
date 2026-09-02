-- migration aplicada: 20260902052547_fin_fatia4_contraparte_helper
-- Aplicada por apply_migration em 02/09/2026. Paridade de CORPO conferida
-- contra o ledger por md5 normalizado: 5439cdbbd7a1396a449b464e0cc36912.

-- =====================================================================
-- Fatia 4, Etapa 1 (banco). Frase da entrega:
--   "cada linha sabe de quem veio ou para quem foi."
--
-- Esta migration cria o MOTOR UNICO da extracao do nome da contraparte
-- (C1 do docs/financeiro/CONTRATO.md) e a coluna que o guarda.
--
-- Ela NAO grava dominio, NAO cria regra e NAO classifica nada (Inv. 18).
-- Contraparte e NOME, nunca lado. Nao existe saldo por contraparte aqui,
-- nem netting: F4 barra isso, e o erro ja foi cometido sobre BR IPHONES.
--
-- A REGRA, medida na base real de 1.132 movimentos em 02/09/2026, nao
-- suposta. Foram encontrados 8 prefixos de tipo no primeiro trecho e
-- 5 aridades de descricao:
--   n_trechos=1  ->  19 linhas (Aplicação RDB 7, Resgate RDB 12)
--   n_trechos=2  -> 402
--   n_trechos=3  ->   7
--   n_trechos=4  -> 577
--   n_trechos=5  -> 127
-- O ' - ' explica 1.113 de 1.132 (98,3%), entao a regra do segundo trecho
-- se sustenta. Duas excecoes MEDIDAS entram na regra, e so elas:
--
--   1) prefixo 'Estorno - ' (5 linhas). Ali o segundo trecho e o TIPO
--      ('Transferência enviada pelo Pix'), nao o nome, e o nome esta no
--      terceiro. Sem esta regra, 5 linhas ganhariam um tipo de transacao
--      como se fosse contraparte, criando um nome falso na lista.
--   2) segundo trecho SO DIGITOS (4 linhas: '3717' e '3767' em
--      'Compra no débito - 3717 - GRSA GR PAO DE'). Numero de terminal nao
--      e nome, e faria a MESMA padaria virar duas contrapartes.
--
-- O que NAO entrou na regra, tambem por medicao: NAO se remove prefixo
-- numerico do nome. Sao 41 linhas com digito na frente e a maioria e nome
-- de verdade: '99 TECNOLOGIA LTDA' (37 linhas), '99 FOOD', '40 GRAUS
-- AGENCIA DE MODELOS LTDA'. Remover o digito destruiria os tres.
--
-- Sem separador, devolve NULL. Nunca string vazia, nunca a descricao
-- inteira. As 19 linhas de RDB nao tem contraparte porque nao ha
-- contraparte a ter: sao aplicacao e resgate na propria instituicao.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) A normalizacao, num lugar so
-- ---------------------------------------------------------------------
-- Existe separada porque DOIS chamadores precisam dela: a extracao (que
-- normaliza o que achou) e o filtro p_contraparte da fin_movimentos (que
-- normaliza o que o cliente mandou). Se a segunda fosse escrita inline na
-- RPC, seriam duas implementacoes de normalizacao, exatamente o que o C1
-- proibe. Nao reescreve nada: chama privado.fn_fin_norm, que ja faz
-- maiuscula e retirada de acento sem depender de unaccent (D-g).
-- O que acrescenta e o colapso de espaco e o btrim, que a fn_fin_norm
-- nao faz: sem eles, '00039  SH RIO SUL' (espaco duplo, medido) seria
-- uma contraparte diferente de '00039 SH RIO SUL'.
create or replace function privado.fn_fin_cp_norm(t text)
returns text
language sql
immutable
set search_path to ''
as $$
  select nullif(btrim(regexp_replace(privado.fn_fin_norm(t), '\s+', ' ', 'g')), '');
$$;
revoke all on function privado.fn_fin_cp_norm(text) from public;
grant execute on function privado.fn_fin_cp_norm(text) to authenticated;

-- ---------------------------------------------------------------------
-- 2) O MOTOR UNICO da extracao (C1)
-- ---------------------------------------------------------------------
-- IMMUTABLE e search_path vazio, no mesmo molde de fn_fin_norm, fn_fin_esc
-- e fn_fin_casa. NAO e security definer: nao le tabela nenhuma, so texto.
-- A unica security definer do modulo continua sendo
-- privado.fn_fin_importacao_fechar (CONTRATO secao 1).
--
-- Serve o backfill E a importacao. Duas implementacoes divergem, e no dia
-- em que divergirem o backfill nomeia diferente da importacao.
create or replace function privado.fn_fin_contraparte(t text)
returns text
language sql
immutable
set search_path to ''
as $$
  with d as (
    -- 'i' porque a grafia do prefixo e do banco, nao nossa; o '+' porque
    -- um estorno de estorno nao e impossivel.
    select regexp_replace(coalesce(t, ''), '^(Estorno - )+', '', 'i') as s
  )
  select privado.fn_fin_cp_norm(
    case
      when position(' - ' in d.s) = 0 then null
      -- terminal numerico: pula para o trecho seguinte. Se ele nao existir,
      -- split_part devolve '' e o nullif fecha em NULL, que e o certo:
      -- melhor sem nome do que com um numero de maquininha por nome.
      when split_part(d.s, ' - ', 2) ~ '^[0-9]+$'
           then nullif(split_part(d.s, ' - ', 3), '')
      else nullif(split_part(d.s, ' - ', 2), '')
    end)
  from d;
$$;
revoke all on function privado.fn_fin_contraparte(text) from public;
grant execute on function privado.fn_fin_contraparte(text) to authenticated;

-- ---------------------------------------------------------------------
-- 3) A coluna
-- ---------------------------------------------------------------------
-- text null, sem default, sem not null, sem trigger. Preenchida por
-- backfill (migration seguinte) e pela importacao, ambos pela helper acima.
-- Os grants de fin_movimento sao de TABELA, nao de coluna, entao
-- authenticated herda SELECT/INSERT/UPDATE sem grant novo, e continua sem
-- DELETE e sem TRUNCATE (Inv. 9). A RLS dono-only ja vigente recorta.
alter table public.fin_movimento
  add column if not exists contraparte text null;

comment on column public.fin_movimento.contraparte is
  'Nome da contraparte extraido da descricao por privado.fn_fin_contraparte. E NOME, nunca lado: nao diz empresa nem pessoal (Inv. 18). NULL quando a descricao nao carrega nome.';

-- Serve os dois usos da fin_movimentos: o filtro por contraparte e o
-- agrupamento do resumo. Parcial em arquivado_em is null porque toda
-- leitura do modulo recorta assim, no mesmo molde do fin_mov_venda_idx.
create index if not exists fin_mov_contraparte_idx
  on public.fin_movimento (tenant_id, contraparte, data)
  where arquivado_em is null;
