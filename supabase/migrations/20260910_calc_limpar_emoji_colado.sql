-- ─────────────────────────────────────────────────────────────────────────────
-- `calc_limpar`: emoji colado na palavra deixa de comer o nome do produto.
--
-- Achado ao aplicar o JBL, 10/09/2026. A verificacao V2 daquela rodada reprovou
-- com a linha REAL do MP IMPORTS, mesmo com o modelo ja no catalogo nos dois
-- escopos:
--
--   '*🎼JBL BOOMBOX 4*'  ->  tokens {'🎼jbl', '4', 'boombox'}
--   'JBL Boombox 4'      ->  tokens {'jbl', 'boombox', '4'}
--
-- O casamento por multiconjunto exige que TODO token do canonico apareca na
-- linha. A linha nao tem `jbl` puro: tem `🎼jbl`. Nao casa, e o produto vira
-- pendencia de modelo.
--
-- ── Nao e o JBL, e uma classe inteira ──────────────────────────────────────
--
-- Medido nas linhas reais do MP, que escreve o emoji SEM espaco:
--
--   '*🎼JBL BOOMBOX 4*'              -> '🎼jbl'       (perde `jbl`)
--   '*💻MACBOOK NEO 256GB/8RAM*'     -> '💻macbook'   (perde `macbook`)
--   '*🎧AIRPODS 4 (lacrado)*'        -> '🎧airpods'   (perde `airpods`)
--   '*⌚️RELÓGIO GARMIN VIVOACTIVE 5*' -> '⌚️relogio'   (perde `relogio`)
--
-- Com espaco (`🎧 AirPods 4`, que e como o BR10 escreve) o emoji vira token
-- proprio e o nome fica limpo. Por isso o BR10 fechou em 97,2% e o MP so
-- passou porque quase todo item dele casou por OUTRO caminho: os MacBooks
-- tem apelido, e o apelido casa por `position()` sobre o texto inteiro, que
-- atravessa o emoji. Onde nao havia apelido, o produto sumia calado.
--
-- Ou seja: mais um caso da classe PERDA SILENCIOSA, a mesma dos AirPods 4 ANC.
-- Cobertura baixa grita; isto nao gritava, porque virava uma pendencia de
-- modelo indistinguivel de "o catalogo nao tem esse aparelho".
--
-- ── Por que em `calc_limpar` e nao em `calc_tokens` ────────────────────────
--
-- Escolha deliberada, e ela limita o alcance do risco.
--
-- `calc_tokens` roda nos DOIS lados: na linha da lista E no nome do catalogo
-- (`calc_tokens(m.nome)`). Mexer la mudaria o casamento de tudo de uma vez.
-- `calc_limpar` roda SO na linha crua da lista (`linhas as (... calc_limpar(t.l))`);
-- nenhum nome do catalogo passa por ela. O conserto fica do lado do texto sujo,
-- que e de onde o problema vem.
--
-- ── A regex, e a armadilha que ela evita ───────────────────────────────────
--
--   regexp_replace(txt, '([^[:alnum:][:space:][:punct:]])([[:alnum:]])', '\1 \2', 'g')
--
-- O obvio seria separar "nao-ASCII" de letra. Isso QUEBRARIA acento, porque
-- `calc_limpar` roda ANTES de `calc_norm`, com o texto ainda acentuado:
-- `RELÓGIO` viraria `REL Ó GIO`.
--
-- A classe usada exclui `[:alnum:]`, e no locale UTF-8 do banco `Ó`, `ê` e `ª`
-- contam como alfanumericos. Sobram os emoji. Medido nos dois sentidos antes
-- de escrever:
--
--   '*🎼JBL BOOMBOX 4*'            -> '*🎼 JBL BOOMBOX 4*'        (separou)
--   '*⌚️RELÓGIO GARMIN VIVOACTIVE 5*' -> '*⌚️ RELÓGIO GARMIN ...'   (acento intacto)
--   'Garmin Fênix 8 47mm'         -> inalterado
--   'AirPods Max 1ª linha'        -> inalterado
--   'MacBook Air M4 13" 16/256GB' -> inalterado
--   '🍎 iPhone 13 Pro – 128GB'    -> inalterado (ja tinha espaco)
--
-- A substituicao roda por ULTIMO, depois dos tres `regexp_replace` que ja
-- existiam (carimbo do WhatsApp e marcador de lista), para nao mudar a ancora
-- `^` de nenhum deles.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function privado.calc_limpar(p_linha text)
 returns text
 language sql
 immutable
 set search_path to ''
as $function$
  select btrim(
    -- NOVO: emoji colado na palavra ganha um espaco, para o nome do produto
    -- sobreviver a tokenizacao. Roda por ultimo, depois das ancoras `^`.
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(coalesce(p_linha,''),
            -- [27/07/2026, 10:32:15] Fulano:
            '^\s*\[[^\]]{4,40}\]\s*[^:]{1,60}:\s*', '', ''),
          -- 27/07/2026 10:32 - Fulano:
          '^\s*\d{1,2}/\d{1,2}/\d{2,4},?\s+\d{1,2}:\d{2}(:\d{2})?\s*[-' || chr(8211) || chr(8212) || ']\s*[^:]{1,60}:\s*', '', ''),
        -- marcador de lista / seta / bullet no comeco
        '^[\s\-\*' || chr(8226) || '>#]+', '', ''),
      '([^[:alnum:][:space:][:punct:]])([[:alnum:]])', '\1 \2', 'g')
  );
$function$;
