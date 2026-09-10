-- ─────────────────────────────────────────────────────────────────────────────
-- calc_parse_v2: o parser passa a ler lista em BLOCO, e para de ser O(n2).
--
-- Medido em 09/09/2026 contra DUAS listas reais de fornecedor (ATACADO BR10 e
-- MP IMPORTS), que e a primeira vez que o parser viu entrada de verdade:
--
--   136 linhas com preco nas duas listas
--     0 traziam nome de produto na mesma linha
--     0 traziam capacidade na mesma linha
--   => cobertura 0,0%, e o teto era zero, nao uma amostra ruim.
--
-- O v1 exige modelo E capacidade na MESMA linha do preco. As listas reais
-- escrevem em bloco:
--
--     🍎 iPhone 13 Pro – 128GB (CPO)     <- modelo aqui, SEM preco
--     🔒 Lacrado                          <- condicao aqui
--     ⚪️ Branco - 💵 *R$ 3.150,00*        <- preco aqui, SEM modelo
--
-- Entra como funcao NOVA (_v2), de proposito: e o pre-check do PROCESSO 3.2.
-- Mede-se v2 contra as mesmas listas, compara-se com o v1, e so entao se
-- promove. Nada de trocar o parser vivo antes de ter o numero.
--
-- ── As tres mudancas ────────────────────────────────────────────────────────
--
-- 1. PAPEL `modelo` no cabecalho de bloco. Linha SEM preco que casa um modelo
--    do catalogo deixa de ser `quebra` e passa a declarar o modelo do trecho,
--    exatamente como `forn` ja declarava o fornecedor e `cond` a condicao.
--    Isso tambem conserta um efeito colateral do v1 que ninguem tinha visto:
--    no v1 a linha de modelo virava `quebra` e INTERROMPIA o bloco do
--    fornecedor, entao mesmo uma lista bem formatada perdia o fornecedor a
--    cada produto novo.
--    A trava do comentario original do v1 continua de pe: cabecalho que nao
--    casa NADA (`ATACADO XYZ`) segue sendo `quebra`, e preco de fornecedor
--    nao identificado continua sem herdar o fornecedor anterior.
--
-- 2. CTEs MATERIALIZADAS + window function no lugar da subquery correlacionada.
--    O v1 media, na mesma sessao: 20 linhas 6,8s / 40 linhas 26,4s (razao 3,87
--    para o dobro da entrada = quadratico) e a metade do BR10 nao terminou em
--    258s. A causa: `marc` faz um `select max(ln) from cab2` POR LINHA de
--    `base`, e `cab2` -> `cab` -> `base` sao inlined pelo planner, entao `base`
--    inteira, com suas tres subqueries correlacionadas contra calc_regra, era
--    reexecutada a cada linha.
--    O casamento de modelo em si nunca foi o custo: 60 casamentos contra os 124
--    modelos levam 2ms (medido). Por isso a mudanca 1 sai praticamente de graca.
--
-- 3. DATA DEIXA DE VIRAR PRECO. `calc_preco` pega a ULTIMA ocorrencia numerica
--    da linha; no cabecalho `- ATACADO BR10 - 09/09/26*` a ultima e `26`, e
--    26 >= 20 passa no piso da funcao. Medido: a linha devolvia preco 26.00 e
--    capacidade `9|9`, virando candidata a produto. Hoje ela so inflava o
--    denominador (nao casava modelo nenhum), mas com a mudanca 1 o modelo passa
--    a vir do CABECALHO, e ai um cabecalho datado gravaria um aparelho a R$ 26.
--    A guarda fica aqui, no chamador, e NAO em calc_preco: mexer em calc_preco
--    mudaria o v1 no meio do pre-check e as duas medicoes deixariam de ser
--    comparaveis.
--
-- ── Precedencia de condicao, e o que ela decide ─────────────────────────────
--
-- As listas reais declaram condicao em DOIS lugares que podem discordar:
--   🍎 iPhone 13 – 512GB (CPO)   <- no cabecalho do modelo
--   🔒 Lacrado                    <- no banner logo abaixo
--
-- Adotada aqui, e DECLARADA em vez de silenciosa:
--   1. condicao escrita na propria linha do preco
--   2. condicao do cabecalho de MODELO do bloco   <- mais especifico, ganha
--   3. condicao do banner vigente
--
-- `CPO` + `Lacrado` no mesmo bloco quer dizer "recondicionado pela Apple, ainda
-- lacrado": a condicao comercial e CPO e `Lacrado` e adjetivo. Por isso o
-- cabecalho ganha. Como isso e ESCOLHA e nao fato, o retorno passa a trazer
-- `n_cond_conflito`, contando as linhas onde os dois discordam, para o tamanho
-- do efeito ser medido em vez de estimado. Nao bloqueia: bloquear antes de ter
-- o numero impediria a propria medicao.
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
  v_res   jsonb;
begin
  -- ── 1. Regras de token (inalterado): substituicao literal, nunca regex.
  v_txt := coalesce(p_texto, '');
  for v_r in
    select padrao, valor from public.calc_regra
     where tenant_id = p_tenant and tipo = 'token' and ativo and valor is not null
     order by prioridade, padrao
  loop
    v_txt := replace(v_txt, v_r.padrao, v_r.valor);
  end loop;

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
  -- ── 2. Preco, descarte e condicao da propria linha.
  base as materialized (
    select u.ln, u.txt, u.nz,
           -- mudanca 3: a data sai do texto ANTES de procurar preco
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
  -- ── 3. Cabecalho: linha SEM preco. Agora resolve fornecedor E modelo.
  cab as materialized (
    select b.ln, b.txt, b.nz, b.cond_linha,
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
           -- mudanca 1: o mesmo casamento que a linha de preco ja fazia,
           -- aplicado ao cabecalho. Alias explicito primeiro, depois o
           -- multiconjunto de tokens + capacidade + polegada.
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
           ) as mod_hdr
      from base b
     where b.preco is null and length(b.nz) between 2 and 80
  ),
  -- Quatro papeis agora. `forn` continua ganhando de tudo, e `quebra` continua
  -- existindo para o cabecalho que nao casa NADA.
  cab2 as materialized (
    select c.*,
           case when c.forn       is not null then 'forn'
                when c.mod_hdr    is not null then 'modelo'
                when c.cond_linha is not null then 'cond'
                else 'quebra' end as papel
      from cab c
  ),
  -- ── 4. mudanca 2: window function no lugar de tres subqueries correlacionadas.
  -- `rows between unbounded preceding and current row` = "o ultimo ate aqui".
  marc as materialized (
    select b.ln, b.txt, b.nz, b.preco, b.descarte, b.pendura, b.cond_linha,
           max(c.ln) filter (where c.papel in ('forn','quebra'))
             over (order by b.ln rows between unbounded preceding and current row) as hdr_ln,
           max(c.ln) filter (where c.papel = 'modelo')
             over (order by b.ln rows between unbounded preceding and current row) as mod_ln,
           -- banner de condicao: so o papel `cond`. A condicao que vem junto do
           -- cabecalho de modelo entra pelo mod_ln, para as duas poderem ser
           -- comparadas em vez de uma sobrescrever a outra em silencio.
           max(c.ln) filter (where c.papel = 'cond')
             over (order by b.ln rows between unbounded preceding and current row) as ban_ln
      from base b
      left join cab2 c on c.ln = b.ln
  ),
  linha as materialized (
    select m.ln, m.txt, m.nz, m.preco, m.descarte, m.pendura, m.cond_linha,
           m.hdr_ln,
           h.forn as hdr_forn,
           h.txt  as hdr_txt,
           -- modelo e condicao do bloco so valem DENTRO do bloco do fornecedor
           case when m.mod_ln >= coalesce(m.hdr_ln, 0) then md.mod_hdr     end as hdr_mod,
           case when m.mod_ln >= coalesce(m.hdr_ln, 0) then md.cond_linha  end as mod_cond,
           case when m.ban_ln >= coalesce(m.hdr_ln, 0) then bn.cond_linha  end as ban_cond
      from marc m
      left join cab2 h  on h.ln  = m.hdr_ln
      left join cab2 md on md.ln = m.mod_ln
      left join cab2 bn on bn.ln = m.ban_ln
  ),
  -- ── 5. So linha COM preco e' candidata a produto (inalterado).
  prod as materialized (
    select l.*,
           privado.calc_tokens(l.txt)     as toks,
           privado.calc_capacidade(l.txt) as cap,
           privado.calc_polegada(l.txt)   as pol,
           -- precedencia declarada: linha > cabecalho de modelo > banner
           coalesce(l.cond_linha, l.mod_cond, l.ban_cond) as cond,
           (l.mod_cond is not null and l.ban_cond is not null
            and l.mod_cond is distinct from l.ban_cond) as cond_conflito
      from linha l
     where l.preco is not null and l.descarte is null
  ),
  -- ── 6. Modelo NA LINHA (inalterado). O cabecalho entra depois, como reserva.
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
  -- ── 6b. Cor e a armadilha da cor decorada (inalterado do v1).
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
  achou as materialized (
    select p.*,
           -- mudanca 1: o cabecalho do bloco e a TERCEIRA fonte de modelo,
           -- depois do alias e do token da propria linha. Nunca antes: linha
           -- que se identifica sozinha continua mandando na propria leitura.
           coalesce(pa.codigo, pt.codigo, p.hdr_mod) as mod_codigo,
           (coalesce(pa.codigo, pt.codigo) is null and p.hdr_mod is not null) as veio_do_cabecalho,
           (select mm.nome      from public.calc_modelo mm
             where mm.tenant_id = p_tenant and mm.codigo = coalesce(pa.codigo, pt.codigo, p.hdr_mod)) as mod_nome,
           (select mm.categoria from public.calc_modelo mm
             where mm.tenant_id = p_tenant and mm.codigo = coalesce(pa.codigo, pt.codigo, p.hdr_mod)) as mod_cat,
           case when coalesce(co.suspeita, false) then null else co.codigo end as cor_codigo,
           coalesce(co.suspeita, false) as cor_suspeita,
           case when coalesce(co.suspeita, false)
                then co.achado || ' ' || co.prox end as cor_texto
      from prod p
      left join por_alias pa on pa.ln = p.ln
      left join por_token pt on pt.ln = p.ln
      left join cor_ok    co on co.ln = p.ln
  ),
  -- ── 7. Classificacao nas pilhas (inalterado).
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
  -- ── 8. Trava de outlier (inalterado).
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
  -- ── 9. Produtos no formato do blob (inalterado).
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
  -- ── 10. Pendencias agrupadas por causa (inalterado, mais uma causa nova).
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
             'texto', txt, 'fornecedor', forn, 'modelo', mod_hdr,
             'papel', papel, 'n_linhas', n) order by n desc, txt) as arr
      from (
        select c.txt, c.forn, c.mod_hdr, c.papel, count(f.ln)::int as n
          from cab2 c left join final f on f.hdr_ln = c.ln
         where c.papel in ('forn','quebra')
         group by c.txt, c.forn, c.mod_hdr, c.papel
        having count(f.ln) > 0
      ) s
  ),
  desc_agr as (
    select jsonb_agg(jsonb_build_object('motivo', motivo, 'n_linhas', n, 'exemplo', ex)
                     order by n desc, motivo) as arr,
           coalesce(sum(n),0) as total
      from (
        select b.descarte as motivo, count(*)::int as n, min(b.txt) as ex
          from base b
         where b.descarte is not null and b.preco is not null
         group by b.descarte
      ) s
  ),
  contas as (
    select (select count(*) from prod)              as n_lidas,
           (select count(*) from bons)              as n_casou,
           (select count(*) from final where pilha='duvidoso' or e_outlier)
             + (select count(*) from orfas_sem_cor) as n_duvidoso,
           (select count(*) from final where pilha='nao_reconhecido') as n_nao_rec,
           (select count(*) from final where veio_do_cabecalho and pilha='casou') as n_do_cabecalho,
           (select count(*) from prod where cond_conflito) as n_cond_conflito
  )
  select jsonb_build_object(
           'n_lidas',     c.n_lidas,
           'n_casou',     c.n_casou,
           'n_duvidoso',  c.n_duvidoso,
           'n_nao_reconhecido', c.n_nao_rec,
           'n_descarte',  (select total from desc_agr),
           'n_pendencia', coalesce(jsonb_array_length((select arr from pend)), 0),
           -- os dois contadores novos existem para MEDIR o efeito das escolhas
           -- acima, nao para a tela: quanto veio do cabecalho, e em quantas
           -- linhas as duas fontes de condicao discordaram.
           'n_do_cabecalho',  c.n_do_cabecalho,
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

-- Mesmo perfil de privilegio do calc_parse: funcao de schema privado, invisivel
-- ao PostgREST, chamada so de dentro das RPCs SECURITY DEFINER.
revoke all on function privado.calc_parse_v2(uuid, text) from public;
