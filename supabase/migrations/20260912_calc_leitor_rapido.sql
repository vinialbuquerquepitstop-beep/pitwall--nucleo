-- 20260912_calc_leitor_rapido.sql
--
-- A LISTA COMPLETA NAO CABIA NO TEMPO (12/09/2026, noite).
--
-- O dono leu pela tela um export de 375 KB e `calc_carga_abrir` voltou
-- `canceling statement due to statement timeout` (57014): o papel `authenticated`
-- tem statement_timeout de 8s. Medido: o leitor gasta ~10 ms por linha de texto,
-- linear (34 linhas 346 ms, 142 linhas 1.274 ms, 547 linhas 5.235 ms). A lista da MP,
-- de 6 KB, ja levava 3,4 s.
--
-- ONDE O TEMPO ESTAVA, medido trecho a trecho nas mesmas 541 linhas:
--   casamento de modelo (cada linha x 125 modelos x tokens, capacidade, polegada)  6.749 ms
--   casamento de cor (cada linha x 32 cores, regex montada a cada comparacao)      2.291 ms
--   regras por linha                                                                220 ms
--   limpeza e preco                                                                 143 ms
--
-- O CONSERTO: o que depende so do CATALOGO e calculado UMA vez por leitura (CTEs
-- `mods`, `mtok`, `cores_c`, `apel_c`), e o que depende so da LINHA e calculado
-- UMA vez por linha (`lcap`, `ltoks`, `lpol` em `uteis`). A cor ganha um filtro
-- barato antes: linha que nao casa nenhuma cor (`v_cores`, que o leitor ja monta)
-- nao passa pelas comparacoes uma a uma.
--
-- NAO MUDA RESULTADO, e isso foi a condicao: prototipos das duas pecas deram md5
-- IDENTICO linha a linha contra a expressao viva (modelo: 7.890 -> 355 ms; cor:
-- 2.656 -> 629 ms). A pre-prova compara a SAIDA INTEIRA do leitor, antes e depois,
-- nas fixtures das provas de banco, e as provas de banco rodam depois.
--
-- COMO E FEITA: como a D20, le o `prosrc` vivo, confere o md5, troca trechos
-- exatos (cada troca exige 1 ocorrencia, senao nada e aplicado) e recria com a
-- MESMA assinatura (`create or replace`, ACL preservada; o revoke fica mesmo assim).

begin;

create function pg_temp.troca(s text, a text, b text) returns text
language plpgsql as $f$
declare n int;
begin
  n := (length(s) - length(replace(s, a, ''))) / greatest(length(a), 1);
  if n <> 1 then
    raise exception 'leitor rapido troca: esperado 1 ocorrencia, achou % para: %', n, left(a, 120);
  end if;
  return replace(s, a, b);
end $f$;

do $m$
declare
  s text;
begin
  select p.prosrc into s from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'privado' and p.proname = 'calc_parse_v2';
  if md5(s) <> '00044db7d28144a8db783bb4a8d2a4ef' then
    raise exception 'leitor rapido: calc_parse_v2 mudou desde a medida (md5 %). Nada foi aplicado.', md5(s);
  end if;

  -- 1. o catalogo derivado UMA vez por leitura
  s := pg_temp.troca(s,
E'  with\n  linhas as materialized (',
E'  with\n'
'  -- 12/09/2026: o que depende so do CATALOGO sai UMA vez por leitura. Antes cada\n'
'  -- linha recalculava tokens, capacidade e polegada dos 125 modelos, e a lista\n'
'  -- completa estourava o statement_timeout de 8s (~10 ms por linha).\n'
'  mods as materialized (\n'
'    select m.codigo, privado.calc_capacidade(m.nome) as cap, privado.calc_tokens(m.nome) as toks,\n'
'           privado.calc_polegada_canon(m.nome) as pol, cardinality(privado.calc_tokens(m.nome)) as ntok\n'
'      from public.calc_modelo m\n'
'     where m.tenant_id = p_tenant and m.ativo\n'
'  ),\n'
'  mtok as materialized (\n'
'    select md.codigo, tk, count(*) as n\n'
'      from mods md, unnest(md.toks) as tk\n'
'     group by md.codigo, tk\n'
'  ),\n'
'  cores_c as materialized (\n'
'    select c2.codigo, privado.calc_norm(c2.nome) as nz,\n'
'           ''\\y'' || privado.calc_norm(c2.nome) || ''\\y'' as re, length(c2.nome) as len\n'
'      from public.calc_cor c2\n'
'     where c2.tenant_id = p_tenant and c2.ativo\n'
'  ),\n'
'  apel_c as materialized (\n'
'    select a2.aponta, privado.calc_norm(a2.texto) as nz,\n'
'           ''\\y'' || privado.calc_norm(a2.texto) || ''\\y'' as re, length(a2.texto) as len\n'
'      from public.calc_alias a2\n'
'     where a2.tenant_id = p_tenant and a2.tipo = ''cor''\n'
'  ),\n'
'  linhas as materialized (');

  -- 2. a linha derivada UMA vez
  s := pg_temp.troca(s,
E'    select ln, txt, inicio_msg, privado.calc_norm(txt) as nz,\n',
E'    select ln, txt, inicio_msg, privado.calc_norm(txt) as nz,\n'
'           privado.calc_capacidade(txt) as lcap, privado.calc_tokens(txt) as ltoks,\n'
'           privado.calc_polegada(txt) as lpol,\n');

  s := pg_temp.troca(s,
E'    select u.ln, u.txt, u.nz, u.nzq, u.inicio_msg,\n',
E'    select u.ln, u.txt, u.nz, u.nzq, u.inicio_msg, u.lcap, u.ltoks, u.lpol,\n');

  -- 3. o modelo do CABECALHO contra `mods`
  s := pg_temp.troca(s,
E'             (select m.codigo from public.calc_modelo m\n'
'               where m.tenant_id = p_tenant and m.ativo\n'
'                 and privado.calc_capacidade(m.nome) = privado.calc_capacidade(b.txt)\n'
'                 and not exists (\n'
'                   select 1 from unnest(privado.calc_tokens(m.nome)) as tk\n'
'                    group by tk\n'
'                   having count(*) > (select count(*) from unnest(privado.calc_tokens(b.txt)) as lt where lt = tk)\n'
'                 )\n'
'                 and ( privado.calc_polegada_canon(m.nome) is null\n'
'                    or privado.calc_polegada(b.txt) is null\n'
'                    or privado.calc_polegada(b.txt) = privado.calc_polegada_canon(m.nome) )\n'
'               order by cardinality(privado.calc_tokens(m.nome)) desc,\n'
'                        (case when privado.calc_polegada_canon(m.nome) = 13 then 0 else 1 end),\n'
'                        m.codigo\n'
'               limit 1)',
E'             (select md.codigo from mods md\n'
'               where md.cap = b.lcap\n'
'                 and not exists (\n'
'                   select 1 from mtok mt\n'
'                    where mt.codigo = md.codigo\n'
'                      and mt.n > (select count(*) from unnest(b.ltoks) as lt where lt = mt.tk)\n'
'                 )\n'
'                 and ( md.pol is null or b.lpol is null or b.lpol = md.pol )\n'
'               order by md.ntok desc,\n'
'                        (case when md.pol = 13 then 0 else 1 end),\n'
'                        md.codigo\n'
'               limit 1)');

  -- 4. o modelo da LINHA DE PRECO contra `mods` (p.cap, p.toks e p.pol ja eram da linha)
  s := pg_temp.troca(s,
E'           (select m.codigo\n'
'              from public.calc_modelo m\n'
'             where m.tenant_id = p_tenant and m.ativo\n'
'               and privado.calc_capacidade(m.nome) = p.cap\n'
'               and not exists (\n'
'                 select 1 from unnest(privado.calc_tokens(m.nome)) as tk\n'
'                  group by tk\n'
'                 having count(*) > (select count(*) from unnest(p.toks) as lt where lt = tk)\n'
'               )\n'
'               and ( privado.calc_polegada_canon(m.nome) is null\n'
'                  or p.pol is null\n'
'                  or p.pol = privado.calc_polegada_canon(m.nome) )\n'
'             order by cardinality(privado.calc_tokens(m.nome)) desc,\n'
'                      (case when privado.calc_polegada_canon(m.nome) = 13 then 0 else 1 end),\n'
'                      m.codigo\n'
'             limit 1) as codigo',
E'           (select md.codigo\n'
'              from mods md\n'
'             where md.cap = p.cap\n'
'               and not exists (\n'
'                 select 1 from mtok mt\n'
'                  where mt.codigo = md.codigo\n'
'                    and mt.n > (select count(*) from unnest(p.toks) as lt where lt = mt.tk)\n'
'               )\n'
'               and ( md.pol is null or p.pol is null or p.pol = md.pol )\n'
'             order by md.ntok desc,\n'
'                      (case when md.pol = 13 then 0 else 1 end),\n'
'                      md.codigo\n'
'             limit 1) as codigo');

  -- 5. a cor da linha de preco contra `cores_c` / `apel_c`, com o filtro barato antes
  s := pg_temp.troca(s,
E'  cor_cand as materialized (\n'
'    select p.ln, p.nzq,\n'
'           coalesce(\n'
'             (select privado.calc_norm(c2.nome) from public.calc_cor c2\n'
'               where c2.tenant_id = p_tenant and c2.ativo\n'
'                 and p.nzq ~ (''\\y'' || privado.calc_norm(c2.nome) || ''\\y'')\n'
'               order by length(c2.nome) desc limit 1),\n'
'             (select privado.calc_norm(a.texto) from public.calc_alias a\n'
'               where a.tenant_id = p_tenant and a.tipo = ''cor''\n'
'                 and p.nzq ~ (''\\y'' || privado.calc_norm(a.texto) || ''\\y'')\n'
'               order by length(a.texto) desc limit 1)\n'
'           ) as achado,\n'
'           coalesce(\n'
'             (select c2.codigo from public.calc_cor c2\n'
'               where c2.tenant_id = p_tenant and c2.ativo\n'
'                 and p.nzq ~ (''\\y'' || privado.calc_norm(c2.nome) || ''\\y'')\n'
'               order by length(c2.nome) desc limit 1),\n'
'             (select a.aponta from public.calc_alias a\n'
'               where a.tenant_id = p_tenant and a.tipo = ''cor''\n'
'                 and p.nzq ~ (''\\y'' || privado.calc_norm(a.texto) || ''\\y'')\n'
'               order by length(a.texto) desc limit 1)\n'
'           ) as codigo\n'
'      from prod p\n'
'  ),',
E'  cor_cand as materialized (\n'
'    -- 12/09/2026: a linha que nao casa NENHUMA cor (`v_cores`, a mesma lista que\n'
'    -- o `so_cor` usa) nao passa pelas comparacoes uma a uma. Mesmo resultado.\n'
'    select p.ln, p.nzq,\n'
'           coalesce(kc.nz, ka.nz) as achado,\n'
'           coalesce(kc.codigo, ka.aponta) as codigo\n'
'      from prod p\n'
'      left join lateral (\n'
'        select cc.nz, cc.codigo from cores_c cc\n'
'         where v_cores is not null and p.nzq ~ (''\\y('' || v_cores || '')\\y'') and p.nzq ~ cc.re\n'
'         order by cc.len desc limit 1) kc on true\n'
'      left join lateral (\n'
'        select ac.nz, ac.aponta from apel_c ac\n'
'         where v_cores is not null and p.nzq ~ (''\\y('' || v_cores || '')\\y'') and p.nzq ~ ac.re\n'
'         order by ac.len desc limit 1) ka on true\n'
'  ),');

  execute format(
    'create or replace function privado.calc_parse_v2(p_tenant uuid, p_texto text, '
    || 'p_condicoes jsonb default ''{}''::jsonb, p_forn_abertos text[] default ''{}''::text[], '
    || 'p_precos_ok text[] default ''{}''::text[]) returns jsonb language plpgsql stable '
    || 'set search_path to '''' as %L', s);
  revoke all on function privado.calc_parse_v2(uuid, text, jsonb, text[], text[]) from public;
end
$m$;

commit;
