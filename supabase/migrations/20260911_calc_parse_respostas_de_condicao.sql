-- ─────────────────────────────────────────────────────────────────────────────────
-- A pergunta de condicao vira resposta (D14 revisada, 11/09/2026).
--
-- Ate aqui o leitor PERGUNTAVA ("qual a condicao do Junior nesta lista?"), mas a
-- unica saida era `ignorar`, e as linhas ficavam fora da tabela. `apontar` segue
-- recusado (trava T1: condicao nao se ensina por apelido), e deve seguir: a D14
-- diz que a resposta vale para UMA lista, nunca vira regra.
--
-- ── O que muda ─────────────────────────────────────────────────────────────────
--
-- 1. VERBO NOVO `definir` em `calc_pendencia.decisao` (o check e refeito).
--    `calc_pendencia_resolver(p, 'definir', 'Lacrado')`. So vale para pendencia de
--    `condicao`, e so para uma condicao ATIVA do tenant (`calc_regra`, tipo
--    `condicao`: hoje `CPO`, `Lacrado`, `Seminovo`, grafia exata). NAO escreve no
--    catalogo: grava so a decisao na propria pendencia. Pode ser trocada (definir
--    de novo) e desfeita (`ignorar`), porque nao deixa rastro fora da carga.
--
-- 2. O LEITOR RECEBE AS RESPOSTAS. `privado.calc_parse_v2` ganha
--    `p_condicoes jsonb default '{}'`: um mapa `texto da pergunta -> condicao`.
--    A chave e o MESMO `texto` que a pendencia de condicao usa, e agora ele e
--    calculado UMA vez (`cond_chave`) e lido nos dois lugares, na pergunta e na
--    resposta. Com duas expressoes, bastaria uma divergir para a resposta nunca
--    pegar e a pergunta voltar para sempre.
--    A resposta so preenche linha SEM condicao lida: nunca troca a que a lista
--    escreveu. E o proprio leitor recusa valor que nao e condicao ativa do tenant
--    (a resposta vira nada, e a pergunta volta), mesmo sendo `privado`.
--
-- 3. O RESOLVER PASSA TODAS AS RESPOSTAS DA CARGA A CADA RELEITURA. Esta e a
--    armadilha da fatia: o resolver rele a lista inteira a cada resposta, de
--    qualquer tipo. Se passasse so a resposta do momento, a proxima resposta de
--    modelo relia sem as de condicao e as linhas ja respondidas voltavam para
--    duvidoso, caladas.
--
-- 4. TRAVA T4: `descartar` em pergunta de condicao e recusado. Hoje ele ja era
--    recusado, mas POR ACASO (a G3 pegava). Descartar o texto `junior` gravaria
--    uma regra de descarte com o nome do fornecedor, e o mesmo mecanismo que faz
--    `descartar fornecedor` apagar o bloco inteiro (D16) passaria a valer por uma
--    pergunta de condicao.
--
-- `calc_carga_abrir` NAO muda: abre sem resposta nenhuma, de proposito. A D14 diz
-- que se pergunta TODA lista; a resposta da lista anterior e so SUGESTAO, e a
-- sugestao se le da tabela, nao se aplica (a consulta esta no handoff v11).
--
-- ── Assinatura: DROP e CREATE, nunca `create or replace` ────────────────────────
--
-- Argumento novo por `create or replace` cria SOBRECARGA, e com o `default` a
-- chamada de dois argumentos ficaria AMBIGUA entre as duas. Por isso `drop` e
-- `create` na mesma transacao. O `drop` leva a ACL junto: o `revoke` abaixo e o
-- que mantem o desenho (sem grant para `authenticated`, handoff v8), e a prova
-- R13 cobra que ninguem alem do dono executa.
--
-- O corpo do leitor e GERADO POR SCRIPT a partir do corpo vivo
-- (20260911_calc_parse_condicao_e_cabecalho.sql, md5 do corpo
-- e4b7f4ad8ecd66edc784ba8d43a7fbc8), e o do resolver a partir de
-- 20260911_calc_resolver_nada_calado.sql (md5 aa8efe9920f12c61207f4b161a4a1177),
-- com trocas que tinham que achar o trecho exatamente uma vez.
--
-- Sem resposta nenhuma, a leitura e a MESMA de antes: o md5 da saida das quatro
-- fixtures, sem a chave nova `n_cond_respondida`, foi fotografado antes e tem que
-- bater depois.
--
-- Prova: `ferramentas/prova_calc_parse.sql`, secao R.
-- ─────────────────────────────────────────────────────────────────────────────────

-- ── 0. O verbo novo ────────────────────────────────────────────────────────────
alter table public.calc_pendencia
  drop constraint calc_pendencia_decisao_ck,
  add constraint calc_pendencia_decisao_ck
    check (decisao is null or decisao in ('apontar','descartar','ignorar','definir'));

-- ── 1. O leitor ────────────────────────────────────────────────────────────────
drop function privado.calc_parse_v2(uuid, text);

create function privado.calc_parse_v2(p_tenant uuid, p_texto text,
                                      p_condicoes jsonb default '{}'::jsonb)
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
    select t.ord::int as ln, privado.calc_limpar(t.l) as txt,
           -- 2.4a zero: esta linha ABRE uma mensagem do WhatsApp? Sao os MESMOS
           -- dois carimbos que `privado.calc_limpar` remove (se um mudar la, mudar
           -- aqui). E a fronteira que permite achar o cabecalho de um fornecedor
           -- que o catalogo ainda nao conhece.
           ( t.l ~ '^\s*\[[^\]]{4,40}\]\s*[^:]{1,60}:'
             or t.l ~ ('^\s*\d{1,2}/\d{1,2}/\d{2,4},?\s+\d{1,2}:\d{2}(:\d{2})?\s*[-'
                       || chr(8211) || chr(8212) || ']\s*[^:]{1,60}:')
           ) as inicio_msg
      from regexp_split_to_table(v_txt, '\r?\n') with ordinality as t(l, ord)
  ),
  uteis as materialized (
    select ln, txt, inicio_msg, privado.calc_norm(txt) as nz,
           -- causa 1: o texto SEM o que esta entre parenteses, usado so para
           -- decidir "esta linha e so cor?" e "a cor esta decorada?".
           -- O texto inteiro (`nz`) segue valendo para condicao e descarte.
           regexp_replace(privado.calc_norm(txt), '\([^)]*\)', ' ', 'g') as nzq
      from linhas
     where not privado.calc_e_ruido(txt)
  ),
  base0 as materialized (
    select u.ln, u.txt, u.nz, u.nzq, u.inicio_msg,
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
             order by r.prioridade limit 1) as cond_linha,
           -- D15: TODAS as condicoes que a linha declara, nao so a de maior
           -- prioridade. `cond_linha` escolhe uma pela ordem (CPO 10, Lacrado 20,
           -- Seminovo 30), e isso gravava `LACRADOS E SEMINOVOS` como Lacrado.
           (select array_agg(distinct r.valor order by r.valor) from public.calc_regra r
             where r.tenant_id = p_tenant and r.tipo = 'condicao'
               and r.ativo and u.nz ~ r.padrao) as cond_set
      from uteis u
  ),
  base as materialized (
    select b0.*,
           -- D15, regra 5: duas condicoes que NAO combinam no mesmo lugar. CPO com
           -- Lacrado combina (CPO vem lacrado, assercao A2); qualquer outro par,
           -- ou seja, Seminovo junto de outra, e ambiguo e vira pergunta.
           (coalesce(cardinality(b0.cond_set), 0) >= 2
            and not (b0.cond_set <@ array['CPO','Lacrado']::text[])) as cond_mista
      from base0 b0
  ),
  cab as materialized (
    select b.ln, b.txt, b.nz, b.nzq, b.cond_linha, b.cond_mista, b.descarte,
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
           -- causa 1: o teste de "so cor" agora roda no texto sem parenteses
           (v_cores is not null
            and b.nzq ~ ('\y(' || v_cores || ')\y')
            and regexp_replace(b.nzq, '\y(' || v_cores || ')\y', ' ', 'g') !~ '[a-z]{3,}'
           ) as so_cor,
           -- causa 2: tem cara de produto? capacidade, mm ou polegada DECLARADAS.
           -- Familia (`iphone`, `apple`) de proposito NAO entra: e larga demais.
           ( coalesce(privado.calc_capacidade(b.txt),'') <> ''
             or b.nz ~ '\y\d{2}\s*mm\y'
             or privado.calc_polegada(b.txt) is not null
           ) as cara_de_produto
      from base b
     where b.preco is null and length(b.nz) between 2 and 80
  ),
  cab2 as materialized (
    select c.*,
           case when c.forn       is not null then 'forn'
                when c.mod_hdr    is not null then 'modelo'
                when c.so_cor                 then 'cor'
                -- antes de `cond`: `iPhone Air 256GB (CPO)` tem condicao E cara
                -- de produto, e o que ele declara e um MODELO que nao casou.
                when c.cara_de_produto        then 'modelo_desconhecido'
                when c.cond_linha is not null then 'cond'
                when c.descarte   is not null then 'aviso'
                else 'quebra' end as papel
      from cab c
  ),
  -- As CTEs `anc` e `anc2` existiam so para decidir quando um `quebra` era
  -- "efetivo". Com a regra nova nao ha mais essa decisao a tomar, e elas saem
  -- junto: codigo morto que ainda calcula window envelhece pior que codigo
  -- removido.
  marc as materialized (
    select b.ln, b.txt, b.nz, b.nzq, b.preco, b.descarte, b.pendura, b.cond_linha, b.cond_mista,
           -- O fornecedor vale do cabecalho DELE ate o proximo cabecalho de
           -- fornecedor RECONHECIDO, e nada mais interrompe isso.
           max(k.ln) filter (where k.papel = 'forn')
             over (order by b.ln rows between unbounded preceding and current row) as hdr_ln,
           -- `modelo_desconhecido` entra AQUI: ele nao quebra o fornecedor, mas
           -- e' o inicio de um bloco de modelo novo, cujo modelo e' nulo. E isso
           -- que impede o preco de herdar o modelo do bloco anterior.
           max(k.ln) filter (where k.papel in ('modelo','modelo_desconhecido'))
             over (order by b.ln rows between unbounded preceding and current row) as mod_ln,
           max(k.ln) filter (where k.papel = 'cond')
             over (order by b.ln rows between unbounded preceding and current row) as ban_ln,
           max(k.ln) filter (where k.papel = 'aviso')
             over (order by b.ln rows between unbounded preceding and current row) as avi_ln,
           -- D15, regra 2: a ULTIMA linha que declarou condicao, seja banner,
           -- cabecalho de bloco (`(CPO)`), cabecalho de fornecedor ou linha de
           -- modelo. A condicao vale para as de baixo ate aparecer outra.
           max(b.ln) filter (where b.cond_linha is not null)
             over (order by b.ln rows between unbounded preceding and current row) as decl_ln,
           -- D15, regra 3: o ultimo TITULO (linha sem preco) que declarou
           -- condicao. Se ele e misto, ali nao ha heranca.
           max(b.ln) filter (where b.cond_linha is not null and b.preco is null)
             over (order by b.ln rows between unbounded preceding and current row) as tit_ln,
           -- 2.4a zero: onde comeca a mensagem desta linha.
           max(b.ln) filter (where b.inicio_msg)
             over (order by b.ln rows between unbounded preceding and current row) as msg_ln
      from base b
      left join cab2 k on k.ln = b.ln
  ),
  linha as materialized (
    select m.ln, m.txt, m.nz, m.nzq, m.preco, m.pendura, m.cond_linha, m.cond_mista,
           m.hdr_ln, m.mod_ln,
           h.forn as hdr_forn,
           h.txt  as hdr_txt,
           case when m.mod_ln >= coalesce(m.hdr_ln, 0) then md.mod_hdr    end as hdr_mod,
           -- cabecalho de bloco misto nao declara condicao nenhuma
           case when m.mod_ln >= coalesce(m.hdr_ln, 0) and not md.cond_mista
                then md.cond_linha end as mod_cond,
           case when m.ban_ln >= coalesce(m.hdr_ln, 0) then bn.cond_linha end as ban_cond,
           -- D15: a condicao herdada, e se a declaracao ou o titulo sao mistos.
           -- `>= hdr_ln`: fornecedor novo zera a heranca (regra 6).
           case when m.decl_ln >= coalesce(m.hdr_ln, 0) then dc.cond_linha end as decl_cond,
           case when m.decl_ln >= coalesce(m.hdr_ln, 0) then dc.cond_mista end as decl_mista,
           case when m.tit_ln  >= coalesce(m.hdr_ln, 0) then tt.cond_mista end as tit_mista,
           -- 2.4a zero: ANTES de qualquer fornecedor reconhecido, o cabecalho
           -- candidato e a primeira linha de cabecalho (`quebra`) da MENSAGEM
           -- desta linha. Sem isto a pendencia dizia `(sem cabecalho antes da
           -- lista)` e o dono nao tinha o que ensinar. Depois de um fornecedor
           -- reconhecido nada muda: a D10 segue valendo (`fornecedor_conferir`).
           case when m.hdr_ln is null then
             (select c.txt from cab2 c
               where c.papel = 'quebra'
                 and c.ln >= coalesce(m.msg_ln, 0) and c.ln <= m.ln
               order by c.ln limit 1)
           end as cand_txt,
           coalesce(m.descarte,
             case when m.avi_ln >= greatest(coalesce(m.mod_ln,0), coalesce(m.hdr_ln,0))
                  then av.descarte end) as descarte
      from marc m
      left join cab2 h  on h.ln  = m.hdr_ln
      left join cab2 md on md.ln = m.mod_ln
      left join cab2 bn on bn.ln = m.ban_ln
      left join cab2 av on av.ln = m.avi_ln
      left join base dc on dc.ln = m.decl_ln
      left join base tt on tt.ln = m.tit_ln
  ),
  blocos as materialized (
    select c.ln as mod_ln,
           lead(c.ln) over (order by c.ln) as mod_fim
      from cab2 c where c.papel in ('modelo','modelo_desconhecido')
  ),
  -- causa 3: a cor solta agora passa pela mesma trava de cor decorada.
  cor_solta as materialized (
    select c.ln as cor_ln, b.mod_ln, cc.codigo, cc.nome, cc.hex
      from cab2 c
      join blocos b
        on c.ln > b.mod_ln and c.ln < coalesce(b.mod_fim, 2147483647)
      join public.calc_cor cc
        on cc.tenant_id = p_tenant and cc.ativo
       and c.nzq ~ ('\y' || privado.calc_norm(cc.nome) || '\y')
     where c.papel = 'cor'
       and substring(c.nzq from ('\y' || privado.calc_norm(cc.nome) || '\y\s+([a-z]{3,})')) is null
  ),
  precos_nus as materialized (
    select l.ln, l.mod_ln
      from linha l
      left join public.calc_cor cn
        on cn.tenant_id = p_tenant and cn.ativo
       and l.nzq ~ ('\y' || privado.calc_norm(cn.nome) || '\y')
     where l.preco is not null and l.mod_ln is not null
     group by l.ln, l.mod_ln
    having count(cn.codigo) = 0
  ),
  -- ── Pareamento CORES x PRECOS NUS dentro do bloco de modelo ──────────────
  -- O vizinho mais proximo SOZINHO erra no layout "cor ANTES do preco": uma cor
  -- entre dois precos fica a distancia 1 dos DOIS, e o desempate por linha
  -- entregava o preco de CIMA, que ja e da cor anterior. Medido em 10/09/2026:
  --
  --   🟣 Roxo / 💵 4.480 / 🟡 Gold / 💵 4.520
  --   ->  Roxo = 4480 (certo), Gold = 4480 (ERRADO), e o 4.520 vira orfa.
  --
  -- No layout "cor DEPOIS do preco" o mesmo desempate acerta, e foi por isso que
  -- o defeito passou: metade dos casos dava certo. E classe PRECO ERRADO, a que
  -- nao grita: a cobertura nao cai, nenhuma pendencia aparece, e a tela nao tem
  -- como denunciar. So a prova pega.
  --
  -- Regra nova: quando o bloco tem UMA cor solta para cada preco nu, a lista
  -- esta escrita numa direcao so, e o pareamento por ORDEM acerta os DOIS
  -- layouts (a n-esima cor casa com o n-esimo preco). Quando as contagens nao
  -- batem (cor sem preco, preco sem cor, bloco misturado), cai no vizinho mais
  -- proximo, exatamente como antes: a mudanca nao alarga o alcance.
  cor_rk as materialized (
    -- dense_rank, nao row_number: uma mesma linha de cor pode casar mais de uma
    -- cor do catalogo, e as duas tem que receber o MESMO posto.
    select cs.*, dense_rank() over (partition by cs.mod_ln order by cs.cor_ln) as rk
      from cor_solta cs
  ),
  preco_rk as materialized (
    select p.mod_ln, p.ln,
           row_number() over (partition by p.mod_ln order by p.ln) as rk
      from precos_nus p
  ),
  pareavel as materialized (
    select c.mod_ln
      from (select mod_ln, count(distinct cor_ln) as n from cor_solta  group by mod_ln) c
      join (select mod_ln, count(*)              as n from precos_nus group by mod_ln) p
        on p.mod_ln = c.mod_ln and p.n = c.n
  ),
  cor_assoc as materialized (
    select cs.cor_ln, cs.codigo, cs.nome, cs.hex,
           coalesce(
             (select pr.ln from preco_rk pr
               where pr.mod_ln = cs.mod_ln and pr.rk = cs.rk
                 and exists (select 1 from pareavel pv where pv.mod_ln = cs.mod_ln)),
             (select p.ln from precos_nus p
               where p.mod_ln = cs.mod_ln
               order by abs(p.ln - cs.cor_ln), p.ln
               limit 1)
           ) as preco_ln
      from cor_rk cs
  ),
  prod as materialized (
    select l.*,
           privado.calc_tokens(l.txt)     as toks,
           privado.calc_capacidade(l.txt) as cap,
           privado.calc_polegada(l.txt)   as pol,
           -- D15. Linha com duas condicoes que nao combinam: nada, pergunta.
           -- Senao: a da linha, a do cabecalho do bloco, e por fim a herdada, que
           -- NAO vale sob titulo misto nem quando a declaracao de cima e mista.
           case when l.cond_mista then null
                else coalesce(l.cond_linha, l.mod_cond,
                              case when coalesce(l.tit_mista, false)
                                     or coalesce(l.decl_mista, false)
                                   then null else l.decl_cond end)
           -- A resposta do dono (D14) NAO entra aqui: entra em `respondida`, depois
           -- que o modelo e conhecido, porque a chave da pergunta usa o nome dele.
           end as cond_lida,
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
    select p.ln, p.nzq,
           coalesce(
             (select privado.calc_norm(c2.nome) from public.calc_cor c2
               where c2.tenant_id = p_tenant and c2.ativo
                 and p.nzq ~ ('\y' || privado.calc_norm(c2.nome) || '\y')
               order by length(c2.nome) desc limit 1),
             (select privado.calc_norm(a.texto) from public.calc_alias a
               where a.tenant_id = p_tenant and a.tipo = 'cor'
                 and p.nzq ~ ('\y' || privado.calc_norm(a.texto) || '\y')
               order by length(a.texto) desc limit 1)
           ) as achado,
           coalesce(
             (select c2.codigo from public.calc_cor c2
               where c2.tenant_id = p_tenant and c2.ativo
                 and p.nzq ~ ('\y' || privado.calc_norm(c2.nome) || '\y')
               order by length(c2.nome) desc limit 1),
             (select a.aponta from public.calc_alias a
               where a.tenant_id = p_tenant and a.tipo = 'cor'
                 and p.nzq ~ ('\y' || privado.calc_norm(a.texto) || '\y')
               order by length(a.texto) desc limit 1)
           ) as codigo
      from prod p
  ),
  cor_res as materialized (
    select cc.ln, cc.achado, cc.codigo,
           substring(cc.nzq from ('\y' || cc.achado || '\y\s+([a-z]{3,})')) as prox
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
  -- ── D14: a resposta do dono para ESTA lista ─────────────────────────────────
  -- `cond_chave` e o `texto` da pergunta de condicao, calculado AQUI e so aqui:
  -- a pendencia (em `pend_bruta`) e a leitura da resposta (em `respondida`) leem
  -- a MESMA coluna. Com duas expressoes, bastaria uma divergir para a resposta
  -- nunca pegar e a pergunta voltar para sempre. Sem fornecedor nao ha pergunta
  -- de condicao, entao nao ha chave.
  chave as materialized (
    select a.*,
           case when a.hdr_forn is null then null
                when a.cond_mista
                  or coalesce(a.tit_mista, false) or coalesce(a.decl_mista, false)
                then concat_ws(' / ', a.mod_nome,
                       nullif(btrim(regexp_replace(privado.calc_norm(a.txt),
                         '\s*[-:]?\s*(r\$)?\s*[\d.,]+\s*$', '')),''))
                else a.hdr_forn
           end as cond_chave
      from achou a
  ),
  -- A resposta so preenche linha SEM condicao lida (nunca troca a que a lista
  -- escreveu), e so com condicao ATIVA do tenant: valor fora disso vira nada, e
  -- a pergunta volta. O leitor e `privado`, mas nao confia em quem o chama.
  respondida as materialized (
    select k.*,
           coalesce(k.cond_lida, rv.valor) as cond,
           (k.cond_lida is null and rv.valor is not null) as cond_respondida
      from chave k
      left join lateral (
        select r.valor from public.calc_regra r
         where r.tenant_id = p_tenant and r.tipo = 'condicao' and r.ativo
           and r.valor = p_condicoes->>k.cond_chave
         limit 1) rv on true
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
      from respondida a
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
           coalesce(nullif(btrim(f.hdr_txt),''), nullif(btrim(f.cand_txt),''),
                    '(sem cabecalho antes da lista)') as texto,
           'Cabecalho nao casa com fornecedor nenhum do catalogo' as causa,
           f.txt as exemplo
      from final f where f.pilha = 'duvidoso' and f.hdr_forn is null
    union all
    -- D14 revisada e D15. Tres causas, e o `texto` e a CHAVE da pergunta:
    --   sem condicao nenhuma acima  -> uma pergunta por FORNECEDOR (o `codigo`
    --                                  dele, invariante 12), nao uma por carga;
    --   titulo misto / linha mista  -> uma pergunta por LINHA (modelo e texto),
    --                                  porque ali cada linha pode ser uma coisa.
    -- O `texto` e a `cond_chave`: a mesma coluna que `respondida` le.
    select 'condicao',
           f.cond_chave,
           case when f.cond_mista
                then 'A linha traz duas condicoes que nao combinam (Seminovo junto de outra): diga qual e'
                when coalesce(f.tit_mista, false) or coalesce(f.decl_mista, false)
                then 'A condicao declarada acima e mista e a linha nao diz qual e a dela'
                else 'Nenhuma condicao declarada para este fornecedor antes destas linhas: diga qual e'
           end,
           f.txt
      from final f where f.pilha = 'duvidoso' and f.hdr_forn is not null and f.cond is null
    union all
    select 'preco', coalesce(f.pendura,'condicao pendurada'),
           'Preco com condicao pendurada: a calc nao tem onde guardar condicao',
           f.txt
      from final f where f.pilha = 'duvidoso' and f.pendura is not null
                     and f.hdr_forn is not null and f.cond is not null
    -- Pendencia de modelo agora nomeia o CABECALHO que nao casou, quando ele
    -- existe. Antes ela agrupava pela linha do preco, entao `⚫️ preto - 💵`
    -- virava a "causa", que nao ensina nada ao catalogo. `iPhone Air 256GB`
    -- ensina: e o apelido que falta.
    union all
    select 'modelo',
           coalesce(
             nullif(btrim(md.txt),''),
             nullif(btrim(regexp_replace(privado.calc_norm(f.txt),
               '\s*[-:]?\s*(r\$)?\s*[\d.,]+\s*$', '')),''),
             '(linha vazia)'),
           'Nao casou com nenhum modelo do catalogo',
           f.txt
      from final f
      left join cab2 md on md.ln = f.mod_ln and md.papel = 'modelo_desconhecido'
     where f.pilha = 'nao_reconhecido'
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
         where c.papel = 'forn'
         group by c.txt, c.forn, c.papel
        having count(distinct f.ln) > 0
      ) s
  ),
  -- ── `fornecedor_conferir`: o que a tela precisa mostrar ────────────────────
  -- Com o `quebra` fora, o fornecedor vale ate o proximo cabecalho reconhecido.
  -- Isto NAO tenta adivinhar se houve troca: expoe o que foi IGNORADO dentro de
  -- cada bloco, para o dono bater o olho e confirmar.
  --
  -- Adivinhar nao funcionaria aqui, e isso foi medido: dos 17 fornecedores do
  -- tenant, oito sao nome de pessoa (`Cristiano`, `Rafael`, `Júnior`, `Raposa`,
  -- `Davi/Fábio`, `João Telles`, `M Apple`, `Quality`). Nao ha forma de uma
  -- heuristica dizer que `Cristiano` e loja e `Irajá` nao e, sem inventar
  -- falso positivo em cima do dono toda semana.
  ign as materialized (
    select f.hdr_ln, c.ln, c.txt
      from cab2 c
      join final f on f.hdr_ln = (
        select max(h.ln) from cab2 h where h.papel = 'forn' and h.ln <= c.ln
      )
     where c.papel = 'quebra'
     group by f.hdr_ln, c.ln, c.txt
  ),
  -- Sinal FORTE, e o unico que vale a pena levantar: a linha ignorada carrega
  -- uma palavra que aparece no nome de um fornecedor conhecido (`imports`,
  -- `cell`, `comercio`), mas o nome inteiro nao casou. Um `XYZ Imports` novo
  -- cai aqui; `📍 RETIRADA: Irajá` nao.
  forn_palavras as materialized (
    select distinct w as palavra
      from public.calc_fornecedor f,
           lateral unnest(privado.calc_tokens(f.nome)) as w
     where f.tenant_id = p_tenant and f.ativo and length(w) >= 4
  ),
  conferir as (
    select jsonb_agg(jsonb_build_object(
             'fornecedor', forn_nome,
             'cabecalho',  hdr_txt,
             'n_linhas',   n_linhas,
             'ignoradas',  ignoradas,
             'suspeita_alta', suspeita_alta)
             order by n_linhas desc) as arr
      from (
        select f.forn_nome, min(h.txt) as hdr_txt,
               count(distinct f.ln)::int as n_linhas,
               coalesce((select jsonb_agg(i.txt order by i.ln)
                           from ign i where i.hdr_ln = f.hdr_ln), '[]'::jsonb) as ignoradas,
               exists (
                 select 1 from ign i
                  where i.hdr_ln = f.hdr_ln
                    and exists (select 1 from forn_palavras p
                                 where privado.calc_norm(i.txt) ~ ('\y' || p.palavra || '\y'))
               ) as suspeita_alta
          from final f
          join cab2 h on h.ln = f.hdr_ln
         where f.forn_nome is not null
         group by f.forn_nome, f.hdr_ln
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
  contas as (
    select (select count(distinct ln) from prod)  as n_lidas,
           (select count(distinct ln) from bons)  as n_casou,
           (select count(distinct ln) from final where pilha='duvidoso' or e_outlier) as n_duvidoso,
           (select count(distinct ln) from final where pilha='nao_reconhecido') as n_nao_rec,
           (select count(distinct ln) from final where veio_do_cabecalho and pilha='casou') as n_do_cabecalho,
           (select count(distinct ln) from final where cor_de_outra_linha and pilha='casou') as n_cor_vizinha,
           (select count(distinct ln) from prod where cond_conflito) as n_cond_conflito,
           -- linhas que entraram pela resposta do dono (D14), nao pela lista
           (select count(distinct ln) from bons where cond_respondida) as n_cond_respondida
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
           'n_cond_respondida', c.n_cond_respondida,
           'cobertura',   case when c.n_lidas = 0 then 0
                               else round(100.0 * c.n_casou / c.n_lidas, 1) end,
           'produtos',    coalesce((select arr from produtos), '[]'::jsonb),
           'pendencias',  coalesce((select arr from pend),     '[]'::jsonb),
           'cabecalhos',  coalesce((select arr from cabs),     '[]'::jsonb),
           -- o que a tela tem que por na frente do dono antes de aprovar
           'fornecedor_conferir', coalesce((select arr from conferir), '[]'::jsonb),
           'descartes',   coalesce((select arr from desc_agr), '[]'::jsonb)
         )
    into v_res
    from contas c;

  return v_res;
end;
$function$;

-- O `drop` levou a ACL junto: refazer. Ninguem alem do dono executa (desenho,
-- handoff v8): as RPCs de `public` chamam o leitor com a barreira de papel.
revoke all on function privado.calc_parse_v2(uuid, text, jsonb)
  from public, anon, authenticated, service_role;


-- ── 2. O resolver ─────────────────────────────────────────────────────────────
create or replace function public.calc_pendencia_resolver(
  p_pendencia uuid, p_decisao text, p_aponta text default null)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_papel  text := privado.fn_papel_atual();
  v_p      public.calc_pendencia%rowtype;
  v_txt    text;
  v_parse  jsonb;
  v_novos  jsonb;
  v_antigos jsonb;
  v_lidos  text[];
  v_existe boolean;
  v_resp   jsonb;
begin
  if v_tenant is null or v_papel <> 'dono' then
    raise exception 'calc_pendencia_resolver: so o papel dono resolve pendencia';
  end if;
  if p_decisao not in ('apontar','descartar','ignorar','definir') then
    raise exception 'calc_pendencia_resolver: decisao invalida: %', p_decisao;
  end if;

  select * into v_p from public.calc_pendencia
   where id = p_pendencia and tenant_id = v_tenant;
  if not found then
    raise exception 'calc_pendencia_resolver: pendencia nao encontrada neste tenant';
  end if;

  -- T2. Resposta que ja escreveu no catalogo nao se repete.
  if v_p.decisao in ('apontar','descartar') then
    raise exception 'calc_pendencia_resolver: esta pendencia ja foi respondida (%). Desfazer uma resposta ainda nao existe.', v_p.decisao;
  end if;

  -- A lista crua so existe enquanto a carga esta em rascunho.
  select texto_bruto into v_txt from public.calc_carga
   where id = v_p.carga_id and tenant_id = v_tenant and status = 'rascunho';

  -- T3. Sem a lista nao ha como provar que a resposta ensina (G2 e G3).
  if v_txt is null and p_decisao in ('apontar','descartar','definir') then
    raise exception 'calc_pendencia_resolver: a carga nao esta mais em rascunho, entao nao da para conferir se a resposta ensina. Nada foi gravado. A mesma pendencia volta na proxima lista, e se responde la.';
  end if;

  -- T4. Condicao nao se descarta. Ja era recusado, mas por ACASO (a G3 pegava).
  -- O texto da pergunta de condicao e o `codigo` do fornecedor: descarta-lo
  -- gravaria regra de descarte com o nome dele, e o bloco inteiro sairia de toda
  -- lista futura (D16) por uma pergunta que era so "qual a condicao".
  if p_decisao = 'descartar' and v_p.tipo = 'condicao' then
    raise exception 'calc_pendencia_resolver: condicao nao se descarta. Diga qual e (definir) ou deixe estas linhas fora desta lista (ignorar). Nada foi gravado.';
  end if;

  if p_decisao = 'apontar' then
    if coalesce(btrim(p_aponta),'') = '' then
      raise exception 'calc_pendencia_resolver: apontar exige o destino';
    end if;
    if v_p.tipo not in ('modelo','cor','fornecedor','condicao') then
      raise exception 'calc_pendencia_resolver: tipo % nao se ensina por apelido', v_p.tipo;
    end if;
    -- T1. O leitor le condicao so de `calc_regra`, nunca de `calc_alias`.
    if v_p.tipo = 'condicao' then
      raise exception 'calc_pendencia_resolver: condicao nao se ensina por apelido: o leitor nao le apelido de condicao. Nada foi gravado.';
    end if;
    -- G1. O destino tem que existir no catalogo DESTE tenant. O apelido aponta
    -- para o CODIGO, nunca para o rotulo (invariante 12).
    v_existe := case v_p.tipo
      when 'modelo'     then exists (select 1 from public.calc_modelo
                                      where tenant_id = v_tenant and codigo = p_aponta)
      when 'cor'        then exists (select 1 from public.calc_cor
                                      where tenant_id = v_tenant and codigo = p_aponta)
      when 'fornecedor' then exists (select 1 from public.calc_fornecedor
                                      where tenant_id = v_tenant and codigo = p_aponta)
    end;
    if not v_existe then
      raise exception 'calc_pendencia_resolver: o destino "%" nao existe no catalogo de % deste tenant. Nada foi gravado.', p_aponta, v_p.tipo;
    end if;
    insert into public.calc_alias (tenant_id, tipo, texto, aponta)
    values (v_tenant, v_p.tipo, v_p.texto, p_aponta);

  elsif p_decisao = 'definir' then
    -- D14. A resposta vale para ESTA lista e NAO escreve no catalogo: fica so na
    -- propria pendencia (`aponta`), e o leitor a recebe na releitura abaixo. Por
    -- isso pode ser trocada (definir de novo) e desfeita (ignorar).
    if v_p.tipo <> 'condicao' then
      raise exception 'calc_pendencia_resolver: definir so vale para pergunta de condicao (esta e de %). Nada foi gravado.', v_p.tipo;
    end if;
    -- Condicao ATIVA do tenant, grafia exata: e o valor que vai para o `t` do blob.
    if not exists (select 1 from public.calc_regra r
                    where r.tenant_id = v_tenant and r.tipo = 'condicao' and r.ativo
                      and r.valor = p_aponta) then
      raise exception 'calc_pendencia_resolver: a condicao "%" nao existe neste tenant (validas: %). Nada foi gravado.',
        coalesce(p_aponta, '(vazia)'),
        (select string_agg(distinct r.valor, ', ' order by r.valor) from public.calc_regra r
          where r.tenant_id = v_tenant and r.tipo = 'condicao' and r.ativo);
    end if;

  elsif p_decisao = 'descartar' then
    -- Descarte permanente: a proxima carga ja nao traz esta linha.
    insert into public.calc_regra (tenant_id, tipo, padrao, acao, motivo, prioridade)
    values (v_tenant, 'descarte',
            regexp_replace(lower(v_p.texto), '([.^$*+?()\[\]{}|\\])', '\\\1', 'g'),
            'descartar',
            'aprendido ao resolver pendencia em ' ||
              to_char((now() at time zone 'America/Sao_Paulo')::date, 'DD/MM/YYYY'),
            100);
  end if;

  update public.calc_pendencia
     set decisao = p_decisao, aponta = p_aponta,
         decidido_em = now()
   where id = p_pendencia;

  -- So `ignorar` chega aqui sem a lista (T3 barrou os outros tres).
  if v_txt is null then
    return jsonb_build_object('reprocessou', false,
                              'motivo', 'a carga nao esta mais em rascunho');
  end if;

  -- O v2, o MESMO que `calc_carga_abrir` usa para abrir. Abrir com um parser e
  -- reprocessar com outro faz a cobertura mudar sozinha entre os dois passos.
  -- D14. TODAS as respostas de condicao desta carga, a cada releitura, e nao so
  -- a do momento. Esta releitura acontece em QUALQUER resposta: se ela fosse sem
  -- as de condicao, a proxima resposta de modelo devolvia para duvidoso, calada,
  -- cada linha que o dono ja respondeu.
  select coalesce(jsonb_object_agg(q.texto, q.aponta), '{}'::jsonb)
    into v_resp
    from public.calc_pendencia q
   where q.carga_id = v_p.carga_id and q.tenant_id = v_tenant
     and q.tipo = 'condicao' and q.decisao = 'definir';

  v_parse := privado.calc_parse_v2(v_tenant, v_txt, v_resp);

  -- G2. Nenhuma linha pode sumir de todas as pilhas. E a guarda que pega o
  -- apelido para destino que o leitor nao acha, sem precisar conhecer o caso.
  if (v_parse->>'n_lidas')::int is distinct from
     (v_parse->>'n_casou')::int + (v_parse->>'n_duvidoso')::int
       + (v_parse->>'n_nao_reconhecido')::int then
    raise exception 'calc_pendencia_resolver: com esta resposta o leitor perderia linhas (lidas %, casou %, duvidoso %, nao reconhecido %). Nada foi gravado.',
      v_parse->>'n_lidas', v_parse->>'n_casou', v_parse->>'n_duvidoso', v_parse->>'n_nao_reconhecido';
  end if;

  -- G3. A resposta tem que mudar a leitura. Se a mesma pendencia volta, o
  -- catalogo ganharia uma linha que nao ensina nada, e o dono veria a mesma
  -- pergunta no mes que vem achando que ja respondeu.
  if p_decisao in ('apontar','descartar','definir') and exists (
       select 1 from jsonb_array_elements(coalesce(v_parse->'pendencias','[]'::jsonb)) q
        where q->>'tipo' = v_p.tipo and q->>'texto' = v_p.texto) then
    raise exception 'calc_pendencia_resolver: esta resposta nao ensina nada ao leitor: "%" continua pendente depois de reler a lista. Nada foi gravado. Use ignorar.', v_p.texto;
  end if;

  v_novos := coalesce(v_parse->'produtos', '[]'::jsonb);

  select coalesce(array_agg(distinct p->>'f'), '{}'::text[])
    into v_lidos
    from jsonb_array_elements(v_novos) p;

  -- Fornecedor sem lista nova segue no blob (trava 4), igual ao abrir.
  select coalesce(jsonb_agg(p), '[]'::jsonb)
    into v_antigos
    from public.calc_carga c, jsonb_array_elements(c.blob_proposto->'produtos') p
   where c.id = v_p.carga_id
     and not (p->>'f' = any(v_lidos));

  update public.calc_carga c
     set n_lidas    = (v_parse->>'n_lidas')::int,
         n_casou    = (v_parse->>'n_casou')::int,
         n_duvidoso = (v_parse->>'n_duvidoso')::int,
         n_descarte = (v_parse->>'n_descarte')::int,
         n_pendencia= (v_parse->>'n_pendencia')::int,
         blob_proposto = jsonb_set(c.blob_proposto, '{produtos}', v_novos || v_antigos),
         resumo = c.resumo
                  || jsonb_build_object('cobertura', v_parse->'cobertura',
                                        'cabecalhos', coalesce(v_parse->'cabecalhos','[]'::jsonb),
                                        'descartes',  coalesce(v_parse->'descartes','[]'::jsonb),
                                        -- Os quatro do v2. Sem refrescar aqui,
                                        -- `fornecedor_conferir` sobrevive ao `||`
                                        -- e passa a descrever uma leitura que nao
                                        -- e mais a do blob.
                                        'fornecedor_conferir', coalesce(v_parse->'fornecedor_conferir','[]'::jsonb),
                                        'n_do_cabecalho',  coalesce(v_parse->'n_do_cabecalho','0'::jsonb),
                                        'n_cor_vizinha',   coalesce(v_parse->'n_cor_vizinha','0'::jsonb),
                                        'n_cond_conflito', coalesce(v_parse->'n_cond_conflito','0'::jsonb),
                                        'n_cond_respondida', coalesce(v_parse->'n_cond_respondida','0'::jsonb))
   where c.id = v_p.carga_id;

  -- Pendencia nova que o reprocesso revelou entra; a que sumiu fica com a
  -- decisao registrada (historico e append-only, invariante 6).
  insert into public.calc_pendencia (tenant_id, carga_id, causa, tipo, texto, n_linhas, exemplo)
  select v_tenant, v_p.carga_id, p->>'causa', p->>'tipo', p->>'texto',
         (p->>'n_linhas')::int, p->>'exemplo'
    from jsonb_array_elements(coalesce(v_parse->'pendencias','[]'::jsonb)) p
  on conflict (carga_id, tipo, texto) do nothing;

  return jsonb_build_object('reprocessou', true,
                            'cobertura', v_parse->'cobertura',
                            'n_casou',   v_parse->'n_casou',
                            'n_lidas',   v_parse->'n_lidas',
                            'n_cond_respondida', v_parse->'n_cond_respondida');
end;
$fn$;

-- `create or replace` PRESERVA a ACL (CLAUDE.md, correcao de 11/09/2026). Refazer
-- e gratis e segue a regra.
revoke all on function public.calc_pendencia_resolver(uuid, text, text) from public, anon;
grant execute on function public.calc_pendencia_resolver(uuid, text, text) to authenticated;
