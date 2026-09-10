-- ─────────────────────────────────────────────────────────────────────────────
-- calc_parse_v2, segunda rodada: os tres itens que a medicao real deixou abertos.
--
-- A primeira rodada (20260909_calc_parse_bloco_e_escala.sql) resolveu escala
-- (26,4s -> 0,474s em 40 linhas, quadratico -> linear) e data-virando-preco, e
-- provou que a heranca de modelo FUNCIONA. Mas medida contra as listas reais a
-- cobertura seguiu em 0%, e tres coisas explicam o zero. Medido em 09/09/2026:
--
--   Caso A  fornecedor + cabecalho de modelo + preco com cor  -> casou 1  ✔
--   Caso B  o mesmo, com uma linha de cores no meio           -> casou 0  ✘
--   Caso C  `ATACADO BR10` como cabecalho de fornecedor       -> casou 1  ✔
--
-- ── Item 1: o papel `quebra` era agressivo demais ───────────────────────────
--
-- Qualquer linha sem preco que nao casasse fornecedor, modelo nem condicao
-- virava `quebra` e RESETAVA o bloco. Nas listas reais isso pega decoracao
-- (`❌ REPOSIÇÃO LIMITADA ❌`), endereco (`📍 RETIRADA: Irajá`) e, pior, linha
-- de cores (`🟣 Roxo | 🟡 Gold | ⚫️ Preto`). No BR10 o fornecedor morria na
-- SEGUNDA linha da lista, antes do primeiro produto.
--
-- O `quebra` NAO e removido: a trava que ele defende e real e esta escrita no
-- v1 com todas as letras (preco de fornecedor nao identificado nao pode herdar
-- o nome do fornecedor anterior; preco certo no fornecedor errado passa no
-- validador, passa no diff, e so aparece quando alguem compra pelo custo de
-- outra loja). Ele fica, com DUAS restricoes estreitas:
--
--   a) linha composta so de cores conhecidas ganha papel `cor` e nunca quebra;
--   b) `quebra` so RESETA se ja houve ao menos uma linha de preco desde o
--      ultimo cabecalho de fornecedor.
--
-- O racional de (b): cabecalho de fornecedor novo aparece DEPOIS dos produtos
-- do anterior. Linha decorativa logo abaixo do cabecalho, antes de qualquer
-- preco, e parte do proprio cabecalho, nao um bloco novo. A trava continua de
-- pe exatamente onde importa: cabecalho desconhecido que aparece depois de
-- precos segue quebrando.
--
-- ── Item 2: as duas listas usam formatos OPOSTOS ────────────────────────────
--
-- Medido nas 136 linhas com preco:
--
--                          BR10    MP
--   linhas com preco         77     59
--   ...com cor na linha      61      0
--   ...preco nu              16     59
--
-- BR10 poe as cores ANTES do preco:      MP poe as cores DEPOIS:
--   ⚪️ Branco | 🟡 Gold | ⚫️ Preto        *R$5.049,99*
--   💵 *R$ 3.100,00*                      🔵azul
--                                         ⚫️preto
--
-- Saber o modelo nao basta: e preciso ligar um preco NU as cores das linhas
-- vizinhas, e os dois sentidos aparecem. A regra adotada e a mesma para os
-- dois: cada cor solta se liga ao preco nu MAIS PROXIMO dentro do mesmo bloco
-- de modelo, medido em distancia de linha, em qualquer direcao.
--
-- Ela cai certo no caso dificil, que e o MP com dois precos no mesmo bloco:
--   *R$5.049,99*  azul(1) preto(2)   <- preto: 2 daqui, 3 do outro -> daqui
--   *R$5.099,99*  branco(1) lavanda(2)
--
-- Empate resolve pelo preco de MENOR linha, declarado e nao arbitrario.
-- Fora de um bloco de modelo nao ha associacao: cor sem modelo nao vira preco.
--
-- ── Item 3: `caixa aberta` nao segurava o preco (o unico que grava ERRADO) ──
--
-- Os itens 1 e 2, se errarem, dao cobertura baixa: barato, vira pendencia.
-- Este grava preco errado passando por certo. Medido:
--
--   '* ⁠não ativado / caixa aberta' ~ regra de descarte  -> TRUE, mas preco NULL
--   '*R$4.949,99*'                 ~ regra de descarte  -> FALSE, preco 4949.99
--
-- O descarte casa a LINHA, e nas listas reais o aviso mora numa linha e o preco
-- noutra. Entao a regra `caixa aberta` (ativa, decisao do dono de 17/08/2026)
-- nunca via o preco que devia barrar. Com a heranca de modelo do item 1 isso
-- deixaria de ser inofensivo: o iPhone 17 256GB de caixa aberta a R$ 4.949,99
-- entraria como Lacrado normal e, sendo mais barato que o lacrado de verdade
-- (R$ 5.049,99), viraria o MENOR CUSTO do modelo. E o cenario que o
-- PROCESSO.md ja descreve, agora medido: 9 blocos do MP tem esse aviso.
--
-- Conserto: o descarte passa a herdar do bloco, exatamente como a condicao.
-- Aviso declarado depois do cabecalho de modelo vale para os precos daquele
-- bloco, e nao vaza para o bloco seguinte.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function privado.calc_parse_v2(p_tenant uuid, p_texto text)
 returns jsonb
 language plpgsql
 stable
 set search_path to ''
as $function$
declare
  v_txt   text;
  v_r     record;
  v_cores text;
  v_res   jsonb;
begin
  v_txt := coalesce(p_texto, '');
  for v_r in
    select padrao, valor from public.calc_regra
     where tenant_id = p_tenant and tipo = 'token' and ativo and valor is not null
     order by prioridade, padrao
  loop
    v_txt := replace(v_txt, v_r.padrao, v_r.valor);
  end loop;

  -- Padrao alternado com TODAS as cores e apelidos de cor do tenant, montado uma
  -- vez so. Serve para responder "esta linha e so cor?" sem varrer a tabela por
  -- linha. Mais longa primeiro: `space gray` antes de `gray`.
  select string_agg(x, '|' order by length(x) desc)
    into v_cores
    from (
      select distinct privado.calc_norm(nome) as x
        from public.calc_cor where tenant_id = p_tenant and ativo
      union
      select distinct privado.calc_norm(texto)
        from public.calc_alias where tenant_id = p_tenant and tipo = 'cor'
    ) s
   where x is not null and x <> '';

  with
  linhas as materialized (
    select t.ord::int as ln, privado.calc_limpar(t.l) as txt
      from regexp_split_to_table(v_txt, '\r?\n') with ordinality as t(l, ord)
  ),
  uteis as materialized (
    select ln, txt, privado.calc_norm(txt) as nz
      from linhas
     where not privado.calc_e_ruido(txt)
  ),
  base as materialized (
    select u.ln, u.txt, u.nz,
           privado.calc_preco(
             regexp_replace(u.txt, '\d{1,2}\s*/\s*\d{1,2}(\s*/\s*\d{2,4})?', ' ', 'g')
           ) as preco,
           (select r.motivo from public.calc_regra r
             where r.tenant_id = p_tenant and r.tipo = 'descarte'
               and r.ativo and r.acao = 'descartar' and u.nz ~ r.padrao
             order by r.prioridade, r.padrao limit 1) as descarte,
           (select r.motivo from public.calc_regra r
             where r.tenant_id = p_tenant and r.tipo = 'descarte'
               and r.ativo and r.acao = 'pendencia' and u.nz ~ r.padrao
             order by r.prioridade, r.padrao limit 1) as pendura,
           (select r.valor from public.calc_regra r
             where r.tenant_id = p_tenant and r.tipo = 'condicao'
               and r.ativo and u.nz ~ r.padrao
             order by r.prioridade limit 1) as cond_linha
      from uteis u
  ),
  cab as materialized (
    select b.ln, b.txt, b.nz, b.cond_linha, b.descarte,
           coalesce(
             (select f.codigo from public.calc_fornecedor f
               where f.tenant_id = p_tenant and f.ativo
                 and position(privado.calc_norm(f.nome) in b.nz) > 0
               order by length(f.nome) desc limit 1),
             (select a.aponta from public.calc_alias a
               where a.tenant_id = p_tenant and a.tipo = 'fornecedor'
                 and position(privado.calc_norm(a.texto) in b.nz) > 0
               order by length(a.texto) desc limit 1)
           ) as forn,
           coalesce(
             (select a.aponta from public.calc_alias a
               where a.tenant_id = p_tenant and a.tipo = 'modelo'
                 and position(privado.calc_norm(a.texto) in b.nz) > 0
               order by length(a.texto) desc limit 1),
             (select m.codigo from public.calc_modelo m
               where m.tenant_id = p_tenant and m.ativo
                 and privado.calc_capacidade(m.nome) = privado.calc_capacidade(b.txt)
                 and not exists (
                   select 1 from unnest(privado.calc_tokens(m.nome)) as tk
                    group by tk
                   having count(*) > (select count(*) from unnest(privado.calc_tokens(b.txt)) as lt where lt = tk)
                 )
                 and ( privado.calc_polegada_canon(m.nome) is null
                    or privado.calc_polegada(b.txt) is null
                    or privado.calc_polegada(b.txt) = privado.calc_polegada_canon(m.nome) )
               order by cardinality(privado.calc_tokens(m.nome)) desc,
                        (case when privado.calc_polegada_canon(m.nome) = 13 then 0 else 1 end),
                        m.codigo
               limit 1)
           ) as mod_hdr,
           -- item 1a: a linha e SO cor? Tira as cores conhecidas e ve se sobrou
           -- palavra. `🟣 Roxo | 🟡 Gold | ⚫️ Preto` -> nao sobra nada -> e cor.
           (v_cores is not null
            and b.nz ~ ('\y(' || v_cores || ')\y')
            and regexp_replace(b.nz, '\y(' || v_cores || ')\y', ' ', 'g') !~ '[a-z]{3,}'
           ) as so_cor
      from base b
     where b.preco is null and length(b.nz) between 2 and 80
  ),
  cab2 as materialized (
    select c.*,
           case when c.forn       is not null then 'forn'
                when c.mod_hdr    is not null then 'modelo'
                when c.so_cor                 then 'cor'
                when c.cond_linha is not null then 'cond'
                when c.descarte   is not null then 'aviso'
                else 'quebra' end as papel
      from cab c
  ),
  -- item 1b: `quebra` so reseta se ja houve preco desde o ultimo cabecalho de
  -- fornecedor. Ancora no papel `forn` (nunca em `quebra`), para nao criar
  -- dependencia circular.
  anc as materialized (
    select b.ln, c.papel,
           max(c.ln) filter (where c.papel = 'forn')
             over (order by b.ln rows between unbounded preceding and current row) as forn_ln,
           count(*) filter (where b.preco is not null)
             over (order by b.ln rows between unbounded preceding and current row) as precos_ate
      from base b
      left join cab2 c on c.ln = b.ln
  ),
  anc2 as materialized (
    select a.ln, a.papel, a.forn_ln, a.precos_ate,
           (a.papel = 'quebra'
            and a.precos_ate > coalesce(f.precos_ate, 0)) as quebra_efetiva
      from anc a
      left join anc f on f.ln = a.forn_ln
  ),
  marc as materialized (
    select b.ln, b.txt, b.nz, b.preco, b.descarte, b.pendura, b.cond_linha,
           max(k.ln) filter (where k.papel = 'forn' or k.quebra_efetiva)
             over (order by b.ln rows between unbounded preceding and current row) as hdr_ln,
           max(k.ln) filter (where k.papel = 'modelo')
             over (order by b.ln rows between unbounded preceding and current row) as mod_ln,
           max(k.ln) filter (where k.papel = 'cond')
             over (order by b.ln rows between unbounded preceding and current row) as ban_ln,
           -- item 3: aviso de descarte declarado em linha propria do bloco
           max(k.ln) filter (where k.papel = 'aviso')
             over (order by b.ln rows between unbounded preceding and current row) as avi_ln
      from base b
      left join anc2 k on k.ln = b.ln
  ),
  linha as materialized (
    select m.ln, m.txt, m.nz, m.preco, m.pendura, m.cond_linha,
           m.hdr_ln, m.mod_ln,
           h.forn as hdr_forn,
           h.txt  as hdr_txt,
           case when m.mod_ln >= coalesce(m.hdr_ln, 0) then md.mod_hdr    end as hdr_mod,
           case when m.mod_ln >= coalesce(m.hdr_ln, 0) then md.cond_linha end as mod_cond,
           case when m.ban_ln >= coalesce(m.hdr_ln, 0) then bn.cond_linha end as ban_cond,
           -- o aviso so vale do cabecalho de modelo para baixo, e nunca vaza
           -- para o bloco de modelo seguinte
           coalesce(m.descarte,
             case when m.avi_ln >= greatest(coalesce(m.mod_ln,0), coalesce(m.hdr_ln,0))
                  then av.descarte end) as descarte
      from marc m
      left join cab2 h  on h.ln  = m.hdr_ln
      left join cab2 md on md.ln = m.mod_ln
      left join cab2 bn on bn.ln = m.ban_ln
      left join cab2 av on av.ln = m.avi_ln
  ),
  -- ── item 2: as cores soltas, uma linha por cor encontrada ──────────────────
  -- O bloco de modelo vai do seu cabecalho ate o proximo. Fora dele nao ha
  -- associacao: cor sem modelo nunca vira preco.
  blocos as materialized (
    select c.ln as mod_ln,
           lead(c.ln) over (order by c.ln) as mod_fim
      from cab2 c where c.papel = 'modelo'
  ),
  cor_solta as materialized (
    select c.ln as cor_ln, b.mod_ln, cc.codigo, cc.nome, cc.hex
      from cab2 c
      join blocos b
        on c.ln > b.mod_ln and c.ln < coalesce(b.mod_fim, 2147483647)
      join public.calc_cor cc
        on cc.tenant_id = p_tenant and cc.ativo
       and c.nz ~ ('\y' || privado.calc_norm(cc.nome) || '\y')
     where c.papel = 'cor'
  ),
  precos_nus as materialized (
    select l.ln, l.mod_ln
      from linha l
      left join public.calc_cor cn
        on cn.tenant_id = p_tenant and cn.ativo
       and l.nz ~ ('\y' || privado.calc_norm(cn.nome) || '\y')
     where l.preco is not null and l.mod_ln is not null
     group by l.ln, l.mod_ln
    having count(cn.codigo) = 0
  ),
  -- cada cor solta se liga ao preco nu MAIS PROXIMO do mesmo bloco de modelo.
  -- Empate: o de menor linha.
  cor_assoc as materialized (
    select cs.cor_ln, cs.codigo, cs.nome, cs.hex,
           (select p.ln from precos_nus p
             where p.mod_ln = cs.mod_ln
             order by abs(p.ln - cs.cor_ln), p.ln
             limit 1) as preco_ln
      from cor_solta cs
  ),
  -- ── 5. Candidatas a produto.
  prod as materialized (
    select l.*,
           privado.calc_tokens(l.txt)     as toks,
           privado.calc_capacidade(l.txt) as cap,
           privado.calc_polegada(l.txt)   as pol,
           coalesce(l.cond_linha, l.mod_cond, l.ban_cond) as cond,
           (l.mod_cond is not null and l.ban_cond is not null
            and l.mod_cond is distinct from l.ban_cond) as cond_conflito
      from linha l
     where l.preco is not null and l.descarte is null
  ),
  por_alias as materialized (
    select p.ln,
           (select a.aponta from public.calc_alias a
             where a.tenant_id = p_tenant and a.tipo = 'modelo'
               and position(privado.calc_norm(a.texto) in p.nz) > 0
             order by length(a.texto) desc limit 1) as codigo
      from prod p
  ),
  por_token as materialized (
    select p.ln,
           (select m.codigo
              from public.calc_modelo m
             where m.tenant_id = p_tenant and m.ativo
               and privado.calc_capacidade(m.nome) = p.cap
               and not exists (
                 select 1 from unnest(privado.calc_tokens(m.nome)) as tk
                  group by tk
                 having count(*) > (select count(*) from unnest(p.toks) as lt where lt = tk)
               )
               and ( privado.calc_polegada_canon(m.nome) is null
                  or p.pol is null
                  or p.pol = privado.calc_polegada_canon(m.nome) )
             order by cardinality(privado.calc_tokens(m.nome)) desc,
                      (case when privado.calc_polegada_canon(m.nome) = 13 then 0 else 1 end),
                      m.codigo
             limit 1) as codigo
      from prod p
  ),
  cor_cand as materialized (
    select p.ln, p.nz,
           coalesce(
             (select privado.calc_norm(c2.nome) from public.calc_cor c2
               where c2.tenant_id = p_tenant and c2.ativo
                 and p.nz ~ ('\y' || privado.calc_norm(c2.nome) || '\y')
               order by length(c2.nome) desc limit 1),
             (select privado.calc_norm(a.texto) from public.calc_alias a
               where a.tenant_id = p_tenant and a.tipo = 'cor'
                 and p.nz ~ ('\y' || privado.calc_norm(a.texto) || '\y')
               order by length(a.texto) desc limit 1)
           ) as achado,
           coalesce(
             (select c2.codigo from public.calc_cor c2
               where c2.tenant_id = p_tenant and c2.ativo
                 and p.nz ~ ('\y' || privado.calc_norm(c2.nome) || '\y')
               order by length(c2.nome) desc limit 1),
             (select a.aponta from public.calc_alias a
               where a.tenant_id = p_tenant and a.tipo = 'cor'
                 and p.nz ~ ('\y' || privado.calc_norm(a.texto) || '\y')
               order by length(a.texto) desc limit 1)
           ) as codigo
      from prod p
  ),
  cor_res as materialized (
    select cc.ln, cc.achado, cc.codigo,
           substring(cc.nz from ('\y' || cc.achado || '\y\s+([a-z]{3,})')) as prox
      from cor_cand cc
     where cc.achado is not null
  ),
  cor_ok as materialized (
    select cr.ln, cr.achado, cr.codigo, cr.prox,
           (cr.prox is not null
            and not exists (
              select 1 from public.calc_regra r
               where r.tenant_id = p_tenant and r.tipo = 'condicao'
                 and r.ativo and cr.prox ~ r.padrao)) as suspeita
      from cor_res cr
  ),
  -- Uma linha de preco pode agora render VARIAS: a propria (se tem cor na
  -- linha) ou uma por cor associada do bloco. `ln` continua sendo a linha do
  -- preco, para a cobertura seguir contada em linhas lidas.
  expandido as materialized (
    select p.*,
           coalesce(pa.codigo, pt.codigo, p.hdr_mod) as mod_codigo,
           (coalesce(pa.codigo, pt.codigo) is null and p.hdr_mod is not null) as veio_do_cabecalho,
           coalesce(ca.codigo,
                    case when coalesce(co.suspeita,false) then null else co.codigo end) as cor_codigo,
           (ca.codigo is not null) as cor_de_outra_linha,
           coalesce(co.suspeita, false) and ca.codigo is null as cor_suspeita,
           case when coalesce(co.suspeita,false) and ca.codigo is null
                then co.achado || ' ' || co.prox end as cor_texto
      from prod p
      left join por_alias pa on pa.ln = p.ln
      left join por_token pt on pt.ln = p.ln
      left join cor_ok    co on co.ln = p.ln
      left join cor_assoc ca on ca.preco_ln = p.ln
  ),
  achou as materialized (
    select e.*,
           (select mm.nome      from public.calc_modelo mm
             where mm.tenant_id = p_tenant and mm.codigo = e.mod_codigo) as mod_nome,
           (select mm.categoria from public.calc_modelo mm
             where mm.tenant_id = p_tenant and mm.codigo = e.mod_codigo) as mod_cat
      from expandido e
  ),
  pilha as materialized (
    select a.*,
           cn.nome as cor_nome, cn.hex as cor_hex,
           f.nome  as forn_nome, f.praca as forn_praca,
           case
             when a.mod_codigo is null                 then 'nao_reconhecido'
             when a.hdr_forn   is null                 then 'duvidoso'
             when a.cond       is null                 then 'duvidoso'
             when a.pendura    is not null             then 'duvidoso'
             when a.cor_suspeita                       then 'duvidoso'
             else 'casou'
           end as pilha
      from achou a
      left join public.calc_cor cn
             on cn.tenant_id = p_tenant and cn.codigo = a.cor_codigo
      left join public.calc_fornecedor f
             on f.tenant_id = p_tenant and f.codigo = a.hdr_forn
  ),
  fator as materialized (
    select coalesce(max(nullif(valor,'')::numeric), 1.6) as f
      from public.calc_regra
     where tenant_id = p_tenant and tipo = 'outlier' and ativo
  ),
  minimo as materialized (
    select mod_codigo, cond, min(preco) as menor
      from pilha where pilha = 'casou'
     group by mod_codigo, cond
  ),
  final as materialized (
    select p.*,
           case when p.pilha = 'casou'
                 and p.preco > mi.menor * (select f from fator)
                then true else false end as e_outlier
      from pilha p
      left join minimo mi on mi.mod_codigo = p.mod_codigo and mi.cond is not distinct from p.cond
  ),
  candidatos as materialized (
    select * from final where pilha = 'casou' and not e_outlier
  ),
  grp_cor as materialized (
    select mod_nome, mod_cat, cond, forn_nome,
           bool_or(cor_codigo is not null) as tem_cor
      from candidatos
     group by 1,2,3,4
  ),
  bons as materialized (
    select c.* from candidatos c
      join grp_cor g
        on  g.mod_nome  = c.mod_nome
        and g.mod_cat   = c.mod_cat
        and g.cond is not distinct from c.cond
        and g.forn_nome = c.forn_nome
     where c.cor_codigo is not null or not g.tem_cor
  ),
  orfas_sem_cor as materialized (
    select c.* from candidatos c
      join grp_cor g
        on  g.mod_nome  = c.mod_nome
        and g.mod_cat   = c.mod_cat
        and g.cond is not distinct from c.cond
        and g.forn_nome = c.forn_nome
     where c.cor_codigo is null and g.tem_cor
  ),
  grupo as materialized (
    select mod_nome, mod_cat, cond, forn_nome, forn_praca,
           bool_or(cor_codigo is not null) as tem_cor,
           min(preco) as v_sem_cor
      from bons
     group by 1,2,3,4,5
  ),
  cores as materialized (
    select b.mod_nome, b.mod_cat, b.cond, b.forn_nome, b.forn_praca,
           b.cor_nome, b.cor_hex, min(b.preco) as v
      from bons b
     where b.cor_codigo is not null
     group by 1,2,3,4,5,6,7
  ),
  produtos as (
    select jsonb_agg(x order by x->>'n', x->>'t', x->>'f') as arr
      from (
        select case when g.tem_cor then
                 jsonb_build_object(
                   'n', g.mod_nome, 'c', g.mod_cat, 't', g.cond,
                   'f', g.forn_nome, 'l', g.forn_praca,
                   'cs', (select jsonb_agg(jsonb_build_object('n', c.cor_nome, 'h', c.cor_hex, 'v', c.v)
                                           order by c.cor_nome)
                            from cores c
                           where c.mod_nome = g.mod_nome and c.mod_cat = g.mod_cat
                             and c.cond is not distinct from g.cond
                             and c.forn_nome = g.forn_nome))
               else
                 jsonb_build_object(
                   'n', g.mod_nome, 'c', g.mod_cat, 't', g.cond,
                   'f', g.forn_nome, 'l', g.forn_praca,
                   'v', g.v_sem_cor)
               end as x
          from grupo g
      ) s
  ),
  pend_bruta as (
    select 'fornecedor'::text as tipo,
           coalesce(nullif(btrim(f.hdr_txt),''), '(sem cabecalho antes da lista)') as texto,
           'Cabecalho nao casa com fornecedor nenhum do catalogo' as causa,
           f.txt as exemplo
      from final f where f.pilha = 'duvidoso' and f.hdr_forn is null
    union all
    select 'condicao', 'sem condicao declarada',
           'A linha nao diz se e Lacrado, CPO ou Seminovo, e o cabecalho do bloco tambem nao',
           f.txt
      from final f where f.pilha = 'duvidoso' and f.hdr_forn is not null and f.cond is null
    union all
    select 'preco', coalesce(f.pendura,'condicao pendurada'),
           'Preco com condicao pendurada: a calc nao tem onde guardar condicao',
           f.txt
      from final f where f.pilha = 'duvidoso' and f.pendura is not null
                     and f.hdr_forn is not null and f.cond is not null
    union all
    select 'modelo',
           coalesce(nullif(btrim(regexp_replace(privado.calc_norm(f.txt),
             '\s*[-:]?\s*(r\$)?\s*[\d.,]+\s*$', '')),''), '(linha vazia)'),
           'Nao casou com nenhum modelo do catalogo',
           f.txt
      from final f where f.pilha = 'nao_reconhecido'
    union all
    select 'cor', f.cor_texto,
           'Cor desconhecida: o catalogo tem a primeira palavra, mas a cor da lista e outra. Nao se inventa hex',
           f.txt
      from final f where f.cor_suspeita and f.mod_codigo is not null
                     and f.hdr_forn is not null
    union all
    select 'preco', 'preco fora de faixa (outlier)',
           'Acima do fator de outlier sobre o menor da mesma combinacao: descartado',
           f.txt
      from final f where f.e_outlier
    union all
    select 'cor', 'sem cor num grupo que tem cor',
           'O mesmo modelo, condicao e fornecedor veio com cor em outras linhas: esta ficou sem, e nao cabe no produto',
           o.txt
      from orfas_sem_cor o
  ),
  pend as (
    select jsonb_agg(jsonb_build_object(
             'tipo', tipo, 'texto', texto, 'causa', causa,
             'n_linhas', n, 'exemplo', exemplo) order by n desc, tipo, texto) as arr,
           coalesce(sum(n),0) as total
      from (
        select tipo, texto, min(causa) as causa, count(*)::int as n, min(exemplo) as exemplo
          from pend_bruta group by tipo, texto
      ) g
  ),
  cabs as (
    select jsonb_agg(jsonb_build_object(
             'texto', txt, 'fornecedor', forn, 'papel', papel, 'n_linhas', n)
             order by n desc, txt) as arr
      from (
        select c.txt, c.forn, c.papel, count(distinct f.ln)::int as n
          from cab2 c left join final f on f.hdr_ln = c.ln
         where c.papel = 'forn' or c.papel = 'quebra'
         group by c.txt, c.forn, c.papel
        having count(distinct f.ln) > 0
      ) s
  ),
  desc_agr as (
    select jsonb_agg(jsonb_build_object('motivo', motivo, 'n_linhas', n, 'exemplo', ex)
                     order by n desc, motivo) as arr,
           coalesce(sum(n),0) as total
      from (
        select l.descarte as motivo, count(*)::int as n, min(l.txt) as ex
          from linha l
         where l.descarte is not null and l.preco is not null
         group by l.descarte
      ) s
  ),
  -- Cobertura conta LINHA DE PRECO, nunca produto expandido: uma linha que
  -- rende quatro cores continua sendo uma linha lida e uma linha que casou,
  -- senao a cobertura passa de 100% e deixa de querer dizer alguma coisa.
  contas as (
    select (select count(distinct ln) from prod)  as n_lidas,
           (select count(distinct ln) from bons)  as n_casou,
           (select count(distinct ln) from final where pilha='duvidoso' or e_outlier) as n_duvidoso,
           (select count(distinct ln) from final where pilha='nao_reconhecido') as n_nao_rec,
           (select count(distinct ln) from final where veio_do_cabecalho and pilha='casou') as n_do_cabecalho,
           (select count(distinct ln) from final where cor_de_outra_linha and pilha='casou') as n_cor_vizinha,
           (select count(distinct ln) from prod where cond_conflito) as n_cond_conflito
  )
  select jsonb_build_object(
           'n_lidas',     c.n_lidas,
           'n_casou',     c.n_casou,
           'n_duvidoso',  c.n_duvidoso,
           'n_nao_reconhecido', c.n_nao_rec,
           'n_descarte',  (select total from desc_agr),
           'n_pendencia', coalesce(jsonb_array_length((select arr from pend)), 0),
           'n_do_cabecalho',  c.n_do_cabecalho,
           'n_cor_vizinha',   c.n_cor_vizinha,
           'n_cond_conflito', c.n_cond_conflito,
           'cobertura',   case when c.n_lidas = 0 then 0
                               else round(100.0 * c.n_casou / c.n_lidas, 1) end,
           'produtos',    coalesce((select arr from produtos), '[]'::jsonb),
           'pendencias',  coalesce((select arr from pend),     '[]'::jsonb),
           'cabecalhos',  coalesce((select arr from cabs),     '[]'::jsonb),
           'descartes',   coalesce((select arr from desc_agr), '[]'::jsonb)
         )
    into v_res
    from contas c;

  return v_res;
end;
$function$;

revoke all on function privado.calc_parse_v2(uuid, text) from public;
