-- 20260913_calc_timeout_authenticated_60s.sql
--
-- D23 (13/09/2026): O LIMITE DO PAPEL `authenticated` SOBE DE 30s PARA 60s.
--
-- Decisao do dono, junto com a de responder em lote
-- (`20260913_calc_responder_em_lote.sql`). Medido antes, no log do dia:
--   15:14:41 UTC  calc_carga_abrir        72.280 bytes  200 em 30.136 ms
--   15:24:58 UTC  calc_pendencia_resolver    107 bytes  500 em 30.340 ms (57014)
-- A lista de 17/08 (3.473 linhas, 812 lidas) ABRE colada no limite e a releitura de
-- uma resposta NAO cabe. Com o lote a releitura acontece uma vez, mas ainda e a
-- mesma releitura de ~30 s: sem folga ela falha do mesmo jeito.
--
-- Custo declarado, o mesmo da D22 em dobro: o limite e do PAPEL, vale para toda
-- chamada de todo usuario logado, e uma consulta presa segura a conexao ate 60 s.
-- `anon` segue em 3s e `authenticator` em 8s.
--
-- Desfazer: alter role authenticated set statement_timeout = '30s';
--           notify pgrst, 'reload config';

begin;

alter role authenticated set statement_timeout = '60s';
notify pgrst, 'reload config';

commit;
