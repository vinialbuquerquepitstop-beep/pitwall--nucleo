-- Bloco 2.2 — o motor de parse. `privado.calc_parse`.
--
-- Deterministico: nao chama modelo de linguagem, nao chuta. Le a lista do
-- fornecedor contra o catalogo DO TENANT (calc_modelo, calc_cor, calc_alias,
-- calc_regra, calc_fornecedor) e devolve as quatro pilhas mais as pendencias
-- AGRUPADAS POR CAUSA.
--
-- Ordem de leitura, secao 5 de references/formato-dados.md e secao 2.2 do plano:
--   token malformado -> descarte -> preco -> modelo -> capacidade
--   -> condicao (CPO ANTES de Lacrado, por calc_regra.prioridade)
--   -> cor -> fornecedor pelo CABECALHO, nunca pelo remetente.
--
-- Nao escreve nada. Quem grava e calc_carga_abrir.

create or replace function privado.calc_parse(p_tenant uuid, p_texto text)
returns jsonb language plpgsql stable set search_path = '' as $fn$
declare
  v_txt   text;
  v_r     record;
  v_res   jsonb;
begin
  -- ── 1. Regras de token: numero malformado se corrige por tabela explicita,
  -- nunca por coerencia adivinhada. Substituicao literal, nao regex.
  v_txt := coalesce(p_texto, '');
  for v_r in
    select padrao, valor from public.calc_regra
     where tenant_id = p_tenant and tipo = 'token' and ativo and valor is not null
     order by prioridade, padrao
  loop
    v_txt := replace(v_txt, v_r.padrao, v_r.valor);
  end loop;

  with
  -- ── 2. Uma linha por linha, sem o carimbo do WhatsApp e sem ruido.
  linhas as (
    select t.ord::int as ln, privado.calc_limpar(t.l) as txt
      -- '\r?\n': export salvo no Windows traz CR, e o CR grudado no fim da
      -- linha entra no texto do cabecalho e no exemplo da pendencia.
      from regexp_split_to_table(v_txt, '\r?\n') with ordinality as t(l, ord)
  ),
  uteis as (
    select ln, txt, privado.calc_norm(txt) as nz
      from linhas
     where not privado.calc_e_ruido(txt)
  ),
  -- ── 3. Preco e descarte. O descarte roda ANTES de qualquer calculo de
  -- minimo (spec, regra 8): aparelho com aviso de peca nao genuina e paralelo
  -- saem agora, senao o item barato que a loja nao vende puxa a venda pra baixo.
  base as (
    select u.ln, u.txt, u.nz,
           privado.calc_preco(u.txt) as preco,
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
  -- ── 4. Cabecalho de fornecedor. Linha SEM preco e' candidata a cabecalho.
  -- Fornecedor vem daqui, NUNCA do remetente: o chat e um agregador de listas
  -- encaminhadas, e agrupar por remetente da "um fornecedor so" (27/07/2026).
  cab as (
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
           ) as forn
      from base b
     where b.preco is null and length(b.nz) between 2 and 80
  ),
  -- Uma linha sem preco faz UM de tres papeis, e confundi-los custa caro:
  --   `forn`   casou com fornecedor ou apelido -> abre bloco DAQUELE fornecedor
  --   `cond`   e' banner de condicao (SEMINOVOS, LACRADOS) -> NAO troca de
  --            fornecedor, so declara a condicao do trecho
  --   `quebra` nao casou com nada -> abre bloco SEM fornecedor
  --
  -- O papel `quebra` e' o que impede o erro caro: sem ele, um cabecalho
  -- desconhecido nao interrompia o bloco anterior e os precos do fornecedor
  -- nao identificado eram gravados com o NOME DO FORNECEDOR ANTERIOR. Preco
  -- certo no fornecedor errado passa no validador, passa no diff e so aparece
  -- quando alguem compra pelo custo de outra loja. Pendencia a mais e barata;
  -- atribuicao errada, nao.
  cab2 as (
    select c.*,
           case when c.forn is not null      then 'forn'
                when c.cond_linha is not null then 'cond'
                else 'quebra' end as papel
      from cab c
  ),
  -- Bloco = trecho que vai de um `forn`/`quebra` ate o proximo.
  marc as (
    select b.*,
           (select max(c.ln) from cab2 c
             where c.ln <= b.ln and c.papel in ('forn','quebra')) as hdr_ln
      from base b
  ),
  linha as (
    select m.*,
           c.forn as hdr_forn,
           c.txt  as hdr_txt,
           -- banner de condicao so vale DENTRO do bloco corrente, senao a
           -- condicao de um fornecedor vaza para o seguinte
           (select c2.cond_linha from cab2 c2
             where c2.papel = 'cond' and c2.ln <= m.ln
               and c2.ln >= coalesce(m.hdr_ln, 0)
             order by c2.ln desc limit 1) as hdr_cond
      from marc m
      left join cab2 c on c.ln = m.hdr_ln
  ),
  -- ── 5. So linha COM preco e' candidata a produto. E ela que entra em n_lidas,
  -- e portanto no denominador da cobertura.
  prod as (
    select l.*,
           privado.calc_tokens(l.txt)     as toks,
           privado.calc_capacidade(l.txt) as cap,
           privado.calc_polegada(l.txt)   as pol,
           -- condicao da propria linha, senao a do cabecalho do bloco
           coalesce(l.cond_linha, l.hdr_cond) as cond
      from linha l
     where l.preco is not null and l.descarte is null
  ),
  -- ── 6. Modelo. Primeiro o apelido explicito (aponta direto para o codigo),
  -- depois o casamento por multiconjunto de tokens + capacidade + polegada.
  por_alias as (
    select p.ln,
           (select a.aponta from public.calc_alias a
             where a.tenant_id = p_tenant and a.tipo = 'modelo'
               and position(privado.calc_norm(a.texto) in p.nz) > 0
             order by length(a.texto) desc limit 1) as codigo
      from prod p
  ),
  por_token as (
    select p.ln,
           (select m.codigo
              from public.calc_modelo m
             where m.tenant_id = p_tenant and m.ativo
               and privado.calc_capacidade(m.nome) = p.cap
               -- multiconjunto: todo token do canonico aparece na linha ao
               -- menos tantas vezes quanto no nome. `MacBook Pro M5 Pro` tem
               -- `pro` DUAS vezes, e e so isso que o separa de `MacBook Pro M5`.
               and not exists (
                 select 1 from unnest(privado.calc_tokens(m.nome)) as tk
                  group by tk
                 having count(*) > (select count(*) from unnest(p.toks) as lt where lt = tk)
               )
               and ( privado.calc_polegada_canon(m.nome) is null
                  or p.pol is null
                  or p.pol = privado.calc_polegada_canon(m.nome) )
             order by cardinality(privado.calc_tokens(m.nome)) desc,
                      -- Deducao documentada (formato-dados 4b): Air/Neo sem
                      -- polegada escrita e' 13", porque a 15" sempre vem escrita.
                      (case when privado.calc_polegada_canon(m.nome) = 13 then 0 else 1 end),
                      m.codigo
             limit 1) as codigo
      from prod p
  ),
  -- ── 6b. Cor, e a armadilha da COR DECORADA ────────────────────────────────
  -- Casar cor por fronteira de palavra e' necessario mas nao suficiente:
  -- `VERDE MENTA` contem `verde` como palavra inteira, entao a cor desconhecida
  -- entrava com o NOME e o HEX de outra cor, calada. Isso viola a regra
  -- explicita do catalogo ("cor desconhecida vira pendencia; nunca inventar hex
  -- sem avisar") e o dono nunca ficaria sabendo que existe uma cor nova.
  --
  -- O sinal deterministico: nessas listas a cor e' sempre seguida da CONDICAO
  -- ou do preco. Se logo depois da cor vem outra PALAVRA que nao e' condicao,
  -- entao a cor verdadeira e' o par (`verde menta`, `azul titanio`), nao a
  -- primeira metade. Nesse caso nao se escolhe: vira pendencia.
  cor_cand as (
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
  cor_res as (
    select cc.ln, cc.achado, cc.codigo,
           substring(cc.nz from ('\y' || cc.achado || '\y\s+([a-z]{3,})')) as prox
      from cor_cand cc
     where cc.achado is not null
  ),
  cor_ok as (
    select cr.ln, cr.achado, cr.codigo, cr.prox,
           (cr.prox is not null
            and not exists (
              select 1 from public.calc_regra r
               where r.tenant_id = p_tenant and r.tipo = 'condicao'
                 and r.ativo and cr.prox ~ r.padrao)) as suspeita
      from cor_res cr
  ),
  achou as (
    select p.*,
           coalesce(pa.codigo, pt.codigo) as mod_codigo,
           (select mm.nome      from public.calc_modelo mm
             where mm.tenant_id = p_tenant and mm.codigo = coalesce(pa.codigo, pt.codigo)) as mod_nome,
           (select mm.categoria from public.calc_modelo mm
             where mm.tenant_id = p_tenant and mm.codigo = coalesce(pa.codigo, pt.codigo)) as mod_cat,
           case when coalesce(co.suspeita, false) then null else co.codigo end as cor_codigo,
           coalesce(co.suspeita, false) as cor_suspeita,
           case when coalesce(co.suspeita, false)
                then co.achado || ' ' || co.prox end as cor_texto
      from prod p
      left join por_alias pa on pa.ln = p.ln
      left join por_token pt on pt.ln = p.ln
      left join cor_ok    co on co.ln = p.ln
  ),
  -- ── 7. Classificacao nas pilhas.
  pilha as (
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
  -- ── 8. Trava de outlier (formato-dados 4b): preco acima de 1.6x o menor da
  -- MESMA combinacao entre fornecedores e descarte. Pegou um iPad lido a 5.100
  -- quando o menor real era 2.570.
  fator as (
    select coalesce(max(nullif(valor,'')::numeric), 1.6) as f
      from public.calc_regra
     where tenant_id = p_tenant and tipo = 'outlier' and ativo
  ),
  minimo as (
    select mod_codigo, cond, min(preco) as menor
      from pilha where pilha = 'casou'
     group by mod_codigo, cond
  ),
  final as (
    select p.*,
           case when p.pilha = 'casou'
                 and p.preco > mi.menor * (select f from fator)
                then true else false end as e_outlier
      from pilha p
      left join minimo mi on mi.mod_codigo = p.mod_codigo and mi.cond is not distinct from p.cond
  ),
  -- ── 9. Produtos, no formato do blob: um por modelo x condicao x fornecedor.
  candidatos as (
    select * from final where pilha = 'casou' and not e_outlier
  ),
  -- Um produto do blob usa `cs` (com cor) OU `v` (sem cor), nunca os dois:
  -- e' o que validarDados() exige. Num grupo que tem cor, a linha SEM cor nao
  -- teria onde entrar e sumiria do blob em silencio, ainda contando como
  -- "casou" e inflando a cobertura. Ela vira pendencia, e a cobertura passa a
  -- contar so o que de fato entra no blob.
  grp_cor as (
    select mod_nome, mod_cat, cond, forn_nome,
           bool_or(cor_codigo is not null) as tem_cor
      from candidatos
     group by 1,2,3,4
  ),
  bons as (
    select c.* from candidatos c
      join grp_cor g
        on  g.mod_nome  = c.mod_nome
        and g.mod_cat   = c.mod_cat
        and g.cond is not distinct from c.cond
        and g.forn_nome = c.forn_nome
     where c.cor_codigo is not null or not g.tem_cor
  ),
  orfas_sem_cor as (
    select c.* from candidatos c
      join grp_cor g
        on  g.mod_nome  = c.mod_nome
        and g.mod_cat   = c.mod_cat
        and g.cond is not distinct from c.cond
        and g.forn_nome = c.forn_nome
     where c.cor_codigo is null and g.tem_cor
  ),
  grupo as (
    select mod_nome, mod_cat, cond, forn_nome, forn_praca,
           bool_or(cor_codigo is not null) as tem_cor,
           min(preco) as v_sem_cor
      from bons
     group by 1,2,3,4,5
  ),
  cores as (
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
  -- ── 10. Pendencias AGRUPADAS POR CAUSA, nunca por linha. Cem linhas de cor
  -- PURPLE sao UMA pendencia: e o que torna o dia 1 viavel (12 decisoes em vez
  -- de 100). `texto` e a chave do agrupamento e o que a resolucao vai ensinar
  -- ao catalogo.
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
    -- Agrupar por CAUSA tambem aqui: a linha inteira como chave nao agrupa
    -- nada, porque o preco muda de linha para linha e cada uma vira uma
    -- pendencia propria. Tirando o preco do fim, as varias linhas do mesmo
    -- modelo desconhecido colapsam numa decisao so, que e' o que torna o dia 1
    -- viavel (cerca de 12 decisoes em vez de 100).
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
  -- ── 11. Cabecalhos achados, para o passo 2 do wizard.
  cabs as (
    select jsonb_agg(jsonb_build_object(
             'texto', txt, 'fornecedor', forn, 'n_linhas', n) order by n desc, txt) as arr
      from (
        select c.txt, c.forn, count(f.ln)::int as n
          from cab2 c left join final f on f.hdr_ln = c.ln
         where c.papel in ('forn','quebra')
         group by c.txt, c.forn
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
    -- n_casou conta a linha que de fato ENTRA no blob, nao a que so casou:
    -- as duas divergem, e declarar a maior seria cobertura inflada.
    select (select count(*) from prod)              as n_lidas,
           (select count(*) from bons)              as n_casou,
           (select count(*) from final where pilha='duvidoso' or e_outlier)
             + (select count(*) from orfas_sem_cor) as n_duvidoso,
           (select count(*) from final where pilha='nao_reconhecido') as n_nao_rec
  )
  select jsonb_build_object(
           'n_lidas',     c.n_lidas,
           'n_casou',     c.n_casou,
           'n_duvidoso',  c.n_duvidoso,
           'n_nao_reconhecido', c.n_nao_rec,
           'n_descarte',  (select total from desc_agr),
           'n_pendencia', coalesce(jsonb_array_length((select arr from pend)), 0),
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
$fn$;

revoke all on function privado.calc_parse(uuid, text) from public, anon, authenticated;
