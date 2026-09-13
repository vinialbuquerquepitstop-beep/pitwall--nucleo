-- 20260913_calc_timeout_authenticated_30s.sql
--
-- Decisao do dono em 13/09/2026: "banco cortou em 8 segundos com a lista completa. aumente".
--
-- MEDIDO antes:
--   - a tela ja cortou a lista para os ultimos 7 dias (o envio caiu de 374.950 para
--     85.613 bytes) e `calc_carga_abrir` ainda parou em 8s: 57014, tempo de origem
--     9.202 ms, 02:40:59 UTC;
--   - `calc_carga_abrir` inteira gasta ~6,15 ms por linha (826 linhas em 5.082 ms,
--     bloco revertido), o mesmo que o leitor sozinho: o tempo e da leitura;
--   - limites antes: authenticated 8s, anon 3s, authenticator 8s (lock 8s).
--
-- CUSTO DECLARADO: o limite e do PAPEL `authenticated`, nao da funcao. Vale para TODA
-- chamada de qualquer usuario logado (dono e vendedor), em todas as telas: uma consulta
-- presa passa a segurar a conexao ate 30s em vez de 8s. `anon` segue em 3s e
-- `authenticator` nao muda.
--
-- Por que nao na funcao: `statement_timeout` e armado quando o statement de fora
-- comeca; um `set` dentro da funcao nao estende esse relogio. O PostgREST aplica o
-- valor do papel antes da chamada, entao o lugar e o papel.
--
-- Desfazer: alter role authenticated set statement_timeout = '8s'; notify pgrst, 'reload config';

alter role authenticated set statement_timeout = '30s';

notify pgrst, 'reload config';
