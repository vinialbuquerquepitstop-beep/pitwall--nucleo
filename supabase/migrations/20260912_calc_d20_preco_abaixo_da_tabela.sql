-- 20260912_calc_d20_preco_abaixo_da_tabela.sql
--
-- D20, decidida pelo dono em 12/09/2026: "sim, o preco muito abaixo vira pergunta".
--
-- O MOTIVO, medido na primeira lista real (carga 43c964ff, descartada): um preco
-- baixo ERRADO (a bateria `🔋100%` lida como R$ 100) virou o menor da combinacao,
-- e o outlier (preco acima de 1,6x o menor) EXPULSOU os `R$` verdadeiros. O
-- `calc_preco` foi consertado para aquele caso (20260912_calc_preco_nao_le_
-- porcentagem), mas o outlier segue olhando so para cima: o proximo numero errado
-- que ainda nao conhecemos faz o mesmo estrago.
--
-- O QUE MUDA:
--   1. `privado.calc_parse_v2` compara cada linha que casou com o MENOR preco da
--      tabela gravada (`calc_dados`) do mesmo modelo e condicao, de qualquer
--      fornecedor. Preco x fator do outlier (dado em `calc_regra`, 1,6) abaixo da
--      referencia vira PERGUNTA de `preco`, com texto `abaixo da tabela: ...`, e
--      NAO entra na tabela nem no calculo do outlier. Sem referencia (produto
--      novo), nao ha guarda.
--   2. A resposta que aceita e `confirmar` (verbo novo), e ela vale SO para esta
--      lista, como o `definir` da D14: nao escreve no catalogo, pode ser desfeita
--      com `ignorar`. O leitor recebe as confirmadas em `p_precos_ok` (argumento
--      novo: DROP + CREATE, ACL refeita).
--   3. `privado.calc_reprocessar` passa as confirmadas a cada releitura, e o
--      resumo ganha `n_preco_confirmado`.
--
-- COMO E FEITA: nao ha corpo transcrito. A migration le o `prosrc` VIVO de cada
-- funcao, confere o md5 medido em 12/09/2026, troca trechos exatos (cada troca
-- exige UMA ocorrencia, senao levanta e nada e aplicado) e recria. Um corpo de
-- 37 KB transcrito a mao e o erro que o PROCESSO 3.1 proibe.
--
-- Limite declarado: um preco CONFIRMADO baixo entra no calculo do outlier como
-- qualquer outro, entao uma promocao real confirmada pode fazer os precos normais
-- do mesmo modelo, na mesma lista, sairem como outlier. E o comportamento que ja
-- existia para preco baixo verdadeiro.

begin;

create function pg_temp.troca(s text, a text, b text) returns text
language plpgsql as $f$
declare n int;
begin
  n := (length(s) - length(replace(s, a, ''))) / greatest(length(a), 1);
  if n <> 1 then
    raise exception 'D20 troca: esperado 1 ocorrencia, achou % para: %', n, left(a, 120);
  end if;
  return replace(s, a, b);
end $f$;

alter table public.calc_pendencia drop constraint calc_pendencia_decisao_ck;
alter table public.calc_pendencia add constraint calc_pendencia_decisao_ck
  check (decisao is null or decisao = any (array['apontar','descartar','ignorar','definir','criar','confirmar']::text[]));

do $m$
declare
  s text;
begin
  -- ── 1. o leitor ──────────────────────────────────────────────────────────
  select p.prosrc into s from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'privado' and p.proname = 'calc_parse_v2';
  if md5(s) <> 'b4a400617275d972bda2a68d0c7d2669' then
    raise exception 'D20: calc_parse_v2 mudou desde a medida (md5 %). Nada foi aplicado.', md5(s);
  end if;

  s := pg_temp.troca(s,
E'  minimo as materialized (\n    select mod_codigo, cond, min(preco) as menor\n      from pilha where pilha = \'casou\'\n',
E'  -- D20 (12/09/2026): o menor preco da tabela GRAVADA, por modelo e condicao,\n'
'  -- de qualquer fornecedor. E a referencia contra preco baixo demais.\n'
'  referencia as materialized (\n'
'    select x.value->>''n'' as n, x.value->>''t'' as t,\n'
'           min(coalesce((select min((c->>''v'')::numeric) from jsonb_array_elements(x.value->''cs'') c),\n'
'                        (x.value->>''v'')::numeric)) as menor\n'
'      from public.calc_dados d,\n'
'           jsonb_array_elements(coalesce(d.dados->''produtos'', ''[]''::jsonb)) x\n'
'     where d.tenant_id = p_tenant\n'
'     group by 1, 2\n'
'  ),\n'
'  -- D20: linha que casou com preco x fator abaixo da referencia vira PERGUNTA e\n'
'  -- sai do calculo do outlier. Foi o que faltou na primeira lista real: o R$ 100\n'
'  -- da bateria virou o menor e expulsou os precos verdadeiros. A resposta\n'
'  -- `confirmar` vale so para esta lista e chega em `p_precos_ok`.\n'
'  pilha2 as materialized (\n'
'    select q.*,\n'
'           (q.abaixo and not (q.baixo_chave = any(coalesce(p_precos_ok, ''{}''::text[])))) as e_baixo\n'
'      from (\n'
'        select p.*, rf.menor as ref_menor,\n'
'               (p.pilha = ''casou'' and rf.menor is not null\n'
'                and p.preco * (select f from fator) < rf.menor) as abaixo,\n'
'               ''abaixo da tabela: '' || concat_ws('' · '', p.forn_nome, p.mod_nome, p.cond, p.cor_nome,\n'
'                   ''R$ '' || replace(p.preco::text, ''.'', '','')) as baixo_chave\n'
'          from pilha p\n'
'          left join referencia rf on rf.n = p.mod_nome and rf.t is not distinct from p.cond\n'
'      ) q\n'
'  ),\n'
'  minimo as materialized (\n    select mod_codigo, cond, min(preco) as menor\n      from pilha2 where pilha = \'casou\' and not e_baixo\n');

  s := pg_temp.troca(s,
E'      from pilha p\n      left join minimo mi',
E'      from pilha2 p\n      left join minimo mi');

  s := pg_temp.troca(s,
E'           case when p.pilha = \'casou\'\n                 and p.preco > mi.menor',
E'           case when p.pilha = \'casou\' and not p.e_baixo\n                 and p.preco > mi.menor');

  s := pg_temp.troca(s,
E'    select * from final where pilha = \'casou\' and not e_outlier\n',
E'    select * from final where pilha = \'casou\' and not e_outlier and not e_baixo\n');

  s := pg_temp.troca(s,
E'    select \'preco\', \'preco fora de faixa (outlier)\',',
E'    select \'preco\', f.baixo_chave,\n'
'           ''Preco muito abaixo do menor da tabela atual deste modelo e condicao (R$ ''\n'
'             || replace(f.ref_menor::text, ''.'', '','') || ''): confira na lista. Se estiver certo, confirme so para esta lista'',\n'
'           f.txt\n'
'      from final f where f.e_baixo\n'
'    union all\n'
'    select \'preco\', \'preco fora de faixa (outlier)\',');

  s := pg_temp.troca(s,
    'from final where pilha=''duvidoso'' or e_outlier) as n_duvidoso',
    'from final where pilha=''duvidoso'' or e_outlier or e_baixo) as n_duvidoso');

  s := pg_temp.troca(s,
    '(select count(distinct ln) from bons where cond_respondida) as n_cond_respondida',
E'(select count(distinct ln) from bons where cond_respondida) as n_cond_respondida,\n'
'           -- D20: linhas que entraram porque o dono CONFIRMOU o preco abaixo da tabela\n'
'           (select count(distinct ln) from bons where abaixo) as n_preco_confirmado');

  s := pg_temp.troca(s,
    '''n_cond_respondida'', c.n_cond_respondida,',
    '''n_cond_respondida'', c.n_cond_respondida,' || E'\n           ''n_preco_confirmado'', c.n_preco_confirmado,');

  -- Argumento novo: `create or replace` criaria SOBRECARGA. DROP + CREATE.
  drop function privado.calc_parse_v2(uuid, text, jsonb, text[]);
  execute format(
    'create function privado.calc_parse_v2(p_tenant uuid, p_texto text, '
    || 'p_condicoes jsonb default ''{}''::jsonb, p_forn_abertos text[] default ''{}''::text[], '
    || 'p_precos_ok text[] default ''{}''::text[]) returns jsonb language plpgsql stable '
    || 'set search_path to '''' as %L', s);
  revoke all on function privado.calc_parse_v2(uuid, text, jsonb, text[], text[]) from public;

  -- ── 2. a releitura ───────────────────────────────────────────────────────
  select p.prosrc into s from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'privado' and p.proname = 'calc_reprocessar';
  if md5(s) <> 'abf5e10c1fd46d44b178ad21f5c39f01' then
    raise exception 'D20: calc_reprocessar mudou desde a medida (md5 %). Nada foi aplicado.', md5(s);
  end if;

  s := pg_temp.troca(s, E'  v_abertos text[];\n', E'  v_abertos text[];\n  v_precos  text[];\n');

  s := pg_temp.troca(s,
    '  v_parse := privado.calc_parse_v2(p_tenant, p_txt, v_resp, v_abertos);',
E'  -- D20: os precos abaixo da tabela que o dono CONFIRMOU nesta carga. Mesma\n'
'  -- logica das respostas de condicao: todas, a cada releitura, de qualquer resposta.\n'
'  select coalesce(array_agg(q.texto order by q.texto), ''{}''::text[])\n'
'    into v_precos\n'
'    from public.calc_pendencia q\n'
'   where q.carga_id = p_carga and q.tenant_id = p_tenant\n'
'     and q.tipo = ''preco'' and q.decisao = ''confirmar'';\n\n'
'  v_parse := privado.calc_parse_v2(p_tenant, p_txt, v_resp, v_abertos, v_precos);');

  s := pg_temp.troca(s,
    '''n_cond_respondida'', coalesce(v_parse->''n_cond_respondida'',''0''::jsonb))',
    '''n_cond_respondida'', coalesce(v_parse->''n_cond_respondida'',''0''::jsonb),'
    || E'\n                                        ''n_preco_confirmado'', coalesce(v_parse->''n_preco_confirmado'',''0''::jsonb))');

  execute format(
    'create or replace function privado.calc_reprocessar(p_tenant uuid, p_carga uuid, p_txt text, '
    || 'p_tipo text, p_texto text, p_ensinar boolean, p_quem text) returns jsonb language plpgsql '
    || 'security definer set search_path to '''' as %L', s);
  revoke all on function privado.calc_reprocessar(uuid, uuid, text, text, text, boolean, text) from public;

  -- ── 3. o resolver ────────────────────────────────────────────────────────
  select p.prosrc into s from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'calc_pendencia_resolver';
  if md5(s) <> '456d9bc97d532235f8bc8c7445f51b2a' then
    raise exception 'D20: calc_pendencia_resolver mudou desde a medida (md5 %). Nada foi aplicado.', md5(s);
  end if;

  s := pg_temp.troca(s,
    'if p_decisao not in (''apontar'',''descartar'',''ignorar'',''definir'') then',
    'if p_decisao not in (''apontar'',''descartar'',''ignorar'',''definir'',''confirmar'') then');

  s := pg_temp.troca(s,
    'if v_txt is null and p_decisao in (''apontar'',''descartar'',''definir'') then',
    'if v_txt is null and p_decisao in (''apontar'',''descartar'',''definir'',''confirmar'') then');

  s := pg_temp.troca(s,
    E'  elsif p_decisao = \'descartar\' then',
E'  elsif p_decisao = \'confirmar\' then\n'
'    -- D20. So a pergunta de preco ABAIXO DA TABELA se confirma. A de condicao\n'
'    -- pendurada e a de outlier nao: nelas o texto e um motivo, nao um preco que\n'
'    -- a lista escreveu. Nao escreve no catalogo: vale so para esta lista.\n'
'    if v_p.tipo <> ''preco'' or v_p.texto not like ''abaixo da tabela: %'' then\n'
'      raise exception ''calc_pendencia_resolver: confirmar so vale para pergunta de preco abaixo da tabela (esta e de %: "%"). Nada foi gravado.'', v_p.tipo, v_p.texto;\n'
'    end if;\n\n'
'  elsif p_decisao = \'descartar\' then');

  s := pg_temp.troca(s,
    'p_decisao in (''apontar'',''descartar'',''definir''),',
    'p_decisao in (''apontar'',''descartar'',''definir'',''confirmar''),');

  execute format(
    'create or replace function public.calc_pendencia_resolver(p_pendencia uuid, p_decisao text, '
    || 'p_aponta text default null::text) returns jsonb language plpgsql security definer '
    || 'set search_path to '''' as %L', s);
end
$m$;

-- ACL: o resolver segue para `authenticated` (a barreira de papel mora no corpo);
-- as duas de `privado` sem grant nenhum, por desenho.
revoke all on function public.calc_pendencia_resolver(uuid, text, text) from public;
revoke all on function public.calc_pendencia_resolver(uuid, text, text) from anon;
grant execute on function public.calc_pendencia_resolver(uuid, text, text) to authenticated, service_role;

commit;
