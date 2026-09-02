-- migration aplicada: 20260902052626_fin_fatia4_contraparte_backfill
-- Aplicada por apply_migration em 02/09/2026. Paridade de CORPO conferida
-- contra o ledger por md5 normalizado: 9d299c1ec28a23cf4e08e388eb018f3f.

-- =====================================================================
-- Fatia 4, Etapa 1. Backfill da contraparte nas linhas que ja existem.
--
-- IDEMPOTENTE POR CONSTRUCAO, nao por sorte: o WHERE compara o valor
-- gravado com o valor que a helper produz AGORA. Rodar de novo sem mudar
-- a regra encontra zero linha a mexer. Isso importa porque a regra de
-- extracao VAI mudar (grafia nova de fornecedor, formato novo de banco) e
-- o backfill precisa poder rodar outra vez sem virar uma migration nova.
--
-- Toca SOMENTE contraparte. Nao encosta em categoria_codigo, dominio,
-- valor, data nem repasse_id. Em particular NAO grava dominio: Inv. 18
-- proibe default silencioso, e contraparte e NOME, nao lado.
--
-- Nao filtra por tenant: e migration, roda como postgres para a tabela
-- inteira. Single-tenant hoje, e o dia do segundo tenant nao muda nada
-- aqui porque a extracao depende so do texto da propria linha.
--
-- O trigger trg_auditar_fin_movimento esta ativo e vai gravar um registro
-- append-only por linha tocada, com antes e depois. Isso e desejado
-- (Inv. 6): o backfill fica auditavel.
-- =====================================================================
update public.fin_movimento m
   set contraparte = privado.fn_fin_contraparte(m.descricao)
 where m.contraparte is distinct from privado.fn_fin_contraparte(m.descricao);
