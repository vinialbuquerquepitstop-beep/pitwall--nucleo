-- 20260913_calc_orfa_sem_cor_conta.sql
--
-- A LINHA ORFA SEM COR SUMIA DA CONTA (13/09/2026).
--
-- O dono leu a lista de 17/08 (3.473 linhas, 30 dias) e a guarda G2 do
-- `calc_carga_abrir` recusou: "o leitor perdeu linhas desta lista (lidas 812, casou
-- 308, duvidoso 168, nao reconhecido 331). Nada foi gravado." 812 - 807 = 5.
--
-- CAUSA, medida por mensagem num bloco revertido com uma copia do leitor que devolve
-- as linhas perdidas: todas estao em `orfas_sem_cor`. E a linha que CASOU (modelo,
-- condicao e fornecedor certos) mas veio sem cor reconhecida num grupo em que outras
-- linhas tem cor: `🌸 Blush - 💵 *R$ 4.700,00*` no MacBook NEO do BR10 (blush nao esta
-- no catalogo; o Silver do lado esta), `R$ 8200` sob `⚫️Midinight` no MacBook Air M5
-- do Cristiano. Ela ja vira pergunta (`cor: sem cor num grupo que tem cor`) e sai do
-- produto, de proposito, mas nao entrava em NENHUM contador:
--   n_casou  conta `bons`, que exclui a orfa;
--   n_duvidoso conta `final` com pilha duvidoso / outlier / abaixo, e a orfa e `casou`.
-- Reproduzido com duas linhas: `iPhone 16 128GB Preto Lacrado - 4.100` e
-- `iPhone 16 128GB Blush Lacrado - 4.200` davam lidas 2, casou 1, duvidoso 0.
--
-- O CONSERTO: a orfa conta como DUVIDOSA, que e o que ela e (tem pergunta aberta e
-- nao entra no produto). Nada muda no produto nem nas pendencias; so o contador.
--
-- COMO E FEITA: le o `prosrc` vivo, confere o md5, 1 troca exata, mesma assinatura.

begin;

create function pg_temp.troca(s text, a text, b text) returns text
language plpgsql as $f$
declare n int;
begin
  n := (length(s) - length(replace(s, a, ''))) / greatest(length(a), 1);
  if n <> 1 then
    raise exception 'orfa sem cor troca: esperado 1 ocorrencia, achou % para: %', n, left(a, 120);
  end if;
  return replace(s, a, b);
end $f$;

do $m$
declare
  s text;
begin
  select p.prosrc into s from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'privado' and p.proname = 'calc_parse_v2';
  if md5(s) <> '1baff6f9e949678d9e5c79b1f04227c0' then
    raise exception 'orfa sem cor: calc_parse_v2 mudou desde a medida (md5 %). Nada foi aplicado.', md5(s);
  end if;

  s := pg_temp.troca(s,
'(select count(distinct ln) from final where pilha=''duvidoso'' or e_outlier or e_baixo) as n_duvidoso,',
'(select count(distinct d.ln) from (select ln from final where pilha=''duvidoso'' or e_outlier or e_baixo'
|| ' union select ln from orfas_sem_cor) d) as n_duvidoso, -- 13/09/2026: a orfa sem cor tem pergunta e conta aqui');

  execute format(
    'create or replace function privado.calc_parse_v2(p_tenant uuid, p_texto text, '
    || 'p_condicoes jsonb default ''{}''::jsonb, p_forn_abertos text[] default ''{}''::text[], '
    || 'p_precos_ok text[] default ''{}''::text[]) returns jsonb language plpgsql stable '
    || 'set search_path to '''' as %L', s);
  revoke all on function privado.calc_parse_v2(uuid, text, jsonb, text[], text[]) from public;
end
$m$;

commit;
