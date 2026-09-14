-- 20260913_calc_leitor_bandeira_iphone_linha.sql
--
-- TRES MUDANCAS NO LEITOR, todas medidas na lista de 17/08 (13/09/2026).
--
-- 1. A BANDEIRA E SEMINOVO. Decisao do dono: "modelos com us, eua, entram como
--    seminovos". Na lista a marca e o emoji 🇺🇸 (nenhuma linha escreve "US"): `11 64GB
--    🇺🇸`, `📲*14 128GB*🇺🇸 *A*`, `📲 IPHONE 17 256GB🇺🇸` (MP Imports, bloco IPHONES
--    SEMINOVOS), `📱 iPhone XR 64GB 🇺🇸🇺🇸`. MAS a mesma bandeira aparece em lacrado:
--    `⬇️ LACRADOS 🇺🇸 🇺🇸` (M Apple) e `Importado 🇺🇸 | eSIM` logo acima de `🔒 Lacrado`
--    (dezenas de blocos). Por isso a regra NAO vale quando a propria linha diz
--    lacrado, lacre, CPO, novo ou importado. Sem essa excecao, `LACRADOS 🇺🇸` virava
--    condicao mista (pergunta) e `Importado 🇺🇸` declarava Seminovo para o preco de
--    baixo sempre que o `🔒 Lacrado` faltasse. Regra de DADO (`calc_regra`), nao de
--    codigo: o leitor ja le toda condicao ativa da tabela.
--    `\y` e fronteira de palavra (o `\b` do Postgres e backspace). O lookahead `(?!`
--    foi medido no banco antes: `📲 15 128GB 🇺🇸 A+` casa, `⬇️ LACRADOS 🇺🇸 🇺🇸` e
--    `Importado 🇺🇸 | eSIM` nao.
--
-- 2. LINHA SEM A PALAVRA "iPhone" E iPhone. 78 das 109 perguntas de modelo (290
--    linhas) eram `📲 15 128GB 🇺🇸 A+`, `📱*16 PRO MAX 512GB*`, `📲 11 | 64gb - ⚪️ 950`:
--    o modelo do catalogo tem o token `iphone` e a linha nao. Decisao do dono: ler
--    como iPhone. A regra mora em `privado.calc_toks_iphone`, UMA copia, usada no
--    cabecalho (`base0`) e na linha de preco (`prod`): a linha ganha o token `iphone`
--    se tem capacidade, um token de 11 a 17 e NENHUMA familia. Familia e a 1a palavra
--    de todo modelo ativo do catalogo (`ipad`, `apple`, `macbook`, `airpods`,
--    `garmin`, `jbl`...) mais as marcas que nao sao Apple (`poco`, `xiaomi`, `redmi`,
--    `samsung`...). Medido: `Redmi Note 13 256GB`, `📱 15T Pro 256GB`, `iPad 11 128`
--    e `Wi Fi Tela 11 polegadas` NAO viram iPhone.
--    De brinde, `prod` para de recalcular tokens, capacidade e polegada de cada linha
--    de preco: `uteis` ja tinha calculado os tres, com o mesmo texto.
--
-- 3. A PENDENCIA DIZ A LINHA. Pedido do dono: "nas pendencias, mostre a linha de
--    mensagem para checar o contexto". Cada pergunta passa a sair com `linha`, o
--    numero da PRIMEIRA linha dela no texto, e `exemplo` passa a ser o texto dessa
--    mesma linha (era o `min()` alfabetico, que dava `✅ PRAZO PARA ANÁLISE ATÉ
--    72HORAS` como exemplo de `📱*16 PRO MAX 512GB*`). A numeracao e a do
--    `regexp_split_to_table(texto, '\r?\n') with ordinality`, a mesma que a tela usa
--    no `texto_bruto`. Coluna nova `calc_pendencia.linha`; `calc_carga_abrir` e
--    `calc_reprocessar` gravam. O `calc_reprocessar` tambem passa a devolver
--    `pendencias`, que a releitura em lote usa para a G3
--    (`20260913_calc_responder_em_lote.sql`, que vem DEPOIS desta).
--
-- COMO E FEITA: le o `prosrc` vivo, confere o md5, trocas exatas (as 24 medidas no
-- banco com 1 ocorrencia cada antes de escrever este arquivo), mesma assinatura.

begin;

create function pg_temp.troca(s text, a text, b text) returns text
language plpgsql as $f$
declare n int;
begin
  n := (length(s) - length(replace(s, a, ''))) / greatest(length(a), 1);
  if n <> 1 then
    raise exception 'leitor troca: esperado 1 ocorrencia, achou % para: %', n, left(a, 120);
  end if;
  return replace(s, a, b);
end $f$;

create function pg_temp.troca_n(s text, a text, b text, esperado int) returns text
language plpgsql as $f$
declare n int;
begin
  n := (length(s) - length(replace(s, a, ''))) / greatest(length(a), 1);
  if n <> esperado then
    raise exception 'leitor troca: esperado % ocorrencias, achou % para: %', esperado, n, left(a, 120);
  end if;
  return replace(s, a, b);
end $f$;

-- ── a coluna ──────────────────────────────────────────────────────────────────
alter table public.calc_pendencia add column if not exists linha int;
comment on column public.calc_pendencia.linha is
  'Primeira linha desta pergunta no texto da carga (1 = primeira), para a tela mostrar o trecho da mensagem. 13/09/2026.';

-- ── 1. a regra da bandeira ────────────────────────────────────────────────────
insert into public.calc_regra (tenant_id, tipo, padrao, acao, valor, prioridade,
                               motivo, ativo, origem, escopo)
values ('00000000-0000-0000-0000-000000000001', 'condicao',
        '^(?!.*(lacrad|lacre|\ycpo\y|importad|\ynovos?\y)).*(🇺🇸|\yus\y|\yeua\y)',
        'substituir', 'Seminovo', 30,
        'aparelho americano (bandeira dos EUA, US ou EUA) e seminovo, se a linha nao disser lacrado, CPO, novo ou importado: decisao do dono em 13/09/2026',
        true, 'manual', 'linha')
on conflict (tenant_id, tipo, padrao) do nothing;

-- ── 5. apelidos de fornecedor (decisao do dono em 13/09/2026) ─────────────────
-- `JT Telles` e o Joao Telles e `Raphael Barra` e o Rafael: as duas mensagens da
-- lista de 17/08 abriam com esses nomes. `APARELHOS AMERICANOS` -> Revel SAI: e frase
-- que qualquer fornecedor escreve, e na lista de 17/08 levou a mensagem de seminovos do
-- Junior (`TRABALHAMOS SOMENTE COM APARELHOS AMERICANOS`) para a Revel, +124 precos no
-- nome errado. A Revel segue reconhecida pelo nome (`Revel Charles`) e por
-- `Charles revel` e `REVEL IMPORTS`.
insert into public.calc_alias (tenant_id, tipo, texto, aponta, origem)
values ('00000000-0000-0000-0000-000000000001', 'fornecedor', 'JT Telles', 'joao_telles', 'manual'),
       ('00000000-0000-0000-0000-000000000001', 'fornecedor', 'Raphael Barra', 'rafael', 'manual')
on conflict (tenant_id, tipo, texto) do nothing;
delete from public.calc_alias
 where tenant_id = '00000000-0000-0000-0000-000000000001' and tipo = 'fornecedor'
   and texto = 'APARELHOS AMERICANOS' and aponta = 'revel';

-- ── 2. a regra do iPhone, uma copia so ────────────────────────────────────────
create or replace function privado.calc_toks_iphone(p_toks text[], p_cap text, p_familias text[])
returns text[]
language sql immutable
set search_path to ''
as $f$
  select case
           when coalesce(p_cap, '') <> ''
            and not (coalesce(p_toks, '{}'::text[]) && coalesce(p_familias, '{}'::text[]))
            and exists (select 1 from unnest(p_toks) as t where t ~ '^1[1-7]$')
           then p_toks || 'iphone'::text
           else p_toks
         end;
$f$;
revoke all on function privado.calc_toks_iphone(text[], text, text[]) from public;

do $m$
declare
  s text;
begin
  -- ── privado.calc_parse_v2 ───────────────────────────────────────────────────
  select p.prosrc into s from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'privado' and p.proname = 'calc_parse_v2';
  if md5(s) <> '36f1319e016154cd27d916aea44c620a' then
    raise exception 'leitor: calc_parse_v2 mudou desde a medida (md5 %). Nada foi aplicado.', md5(s);
  end if;

  s := pg_temp.troca(s,
$t$  mods as materialized ($t$,
$t$  -- 13/09/2026: as FAMILIAS (1a palavra de cada modelo ativo) e as marcas que nao
  -- sao Apple. Linha sem nenhuma delas, com 11 a 17 e capacidade, e iPhone.
  fam as materialized (
    select coalesce(array_agg(distinct s.w), '{}'::text[]) as a
      from (select split_part(privado.calc_norm(m.nome), ' ', 1) as w
              from public.calc_modelo m
             where m.tenant_id = p_tenant and m.ativo
            union
            select unnest(array['iphone','ipad','watch','poco','xiaomi','redmi',
                                'samsung','galaxy','motorola','realme','pixel'])) s
     where s.w is not null and s.w <> ''
  ),
  mods as materialized ($t$);

  -- 4. CICLO DE BATERIA NAO E PRECO. Achado pela pre-prova desta migration na lista
  --    de 17/08: com a regra do iPhone, o bloco do Fabio Souza passou a casar e
  --    `* 🔋85% (1281ciclos)` virou `iPhone 12 256GB` por R$ 1.281 (o preco certo, da
  --    linha de baixo, era `💰 1.650`); o mesmo com 1275, 1462 e 1680. Defeito do
  --    leitor que ja existia e so aparecia agora: a linha nao casava modelo nenhum.
  --    Mesmo lugar e mesma forma do corte de data que ja estava aqui.
  s := pg_temp.troca(s,
$t$             regexp_replace(u.txt, '\d{1,2}\s*/\s*\d{1,2}(\s*/\s*\d{2,4})?', ' ', 'g')$t$,
$t$             regexp_replace(regexp_replace(u.txt, '\d{1,2}\s*/\s*\d{1,2}(\s*/\s*\d{2,4})?', ' ', 'g'),
                            '\d[\d.,]*\s*ciclos?', ' ', 'gi')$t$);

  -- 6. A CERCA DO HORARIO (decisao do dono, D10 revista). Mensagem de horario
  --    DIFERENTE da anterior e sem fornecedor reconhecido nao herda o de cima: vira
  --    pergunta de fornecedor. Na lista de 17/08 a D10 dava +35 precos do `JT Telles`
  --    ao All imports (e 8 precos reais do All imports saiam) e +40 do `Raphael Barra`
  --    a Quality. As 4 mensagens de continuacao da mesma lista chegaram no MESMO
  --    segundo da anterior, e seguem herdando. Risco que sobra, declarado: dois
  --    fornecedores repassados no mesmo segundo ainda se misturam.
  s := pg_temp.troca(s,
$t$    select t.ord::int as ln, privado.calc_limpar(t.l) as txt,$t$,
$t$    select t.ord::int as ln, privado.calc_limpar(t.l) as txt,
           substring(t.l from '^\s*\[?(\d{1,2}/\d{1,2}/\d{2,4},?\s+\d{1,2}:\d{2}(:\d{2})?)') as ts,$t$);
  s := pg_temp.troca(s,
$t$  uteis as materialized ($t$,
$t$  -- 13/09/2026: onde o horario da mensagem muda, uma cerca (ver o `hdr_ln` de `linha`).
  cercas as materialized (
    select x.ln from (select l.ln, l.ts, lag(l.ts) over (order by l.ln) as ts0
                        from linhas l where l.inicio_msg) x
     where x.ts is distinct from x.ts0
  ),
  uteis as materialized ($t$);
  s := pg_temp.troca(s,
$t$             over (order by b.ln rows between unbounded preceding and current row) as hdr_ln,$t$,
$t$             over (order by b.ln rows between unbounded preceding and current row) as hdr_ln0,$t$);
  s := pg_temp.troca(s,
$t$      from marc m
$t$,
$t$      -- 13/09/2026: o fornecedor de cima vale so se nenhuma cerca de horario
      -- ficou entre o cabecalho dele e a linha. Depois da cerca o bloco comeca na
      -- cerca, e condicao, modelo e aviso de antes dela nao atravessam.
      from (select mm2.*,
                   case when mm2.cerca_ln > coalesce(mm2.hdr_ln0, 0) then null
                        else mm2.hdr_ln0 end as hdr_ln
              from (select mm.*, (select max(c.ln) from cercas c where c.ln <= mm.ln) as cerca_ln
                      from marc mm) mm2) m
$t$);
  --    A pergunta de uma linha cortada pela cerca leva a 1a linha da MENSAGEM da cerca,
  --    e a continuacao do mesmo segundo cai na mesma pergunta. Medido na pre-prova:
  --    sem isto, as duas mensagens do Junior viravam `🔋 85% pra cima` e `GARANTIA
  --    DIRETO COM A APPLE`, e responder "e o Junior" gravaria ESSAS frases como
  --    apelido. So vale quando havia fornecedor acima (a 1a mensagem da lista segue
  --    a 2.4a zero, como antes).
  s := pg_temp.troca(s,
$t$           case when m.hdr_ln is null then
             (select c.txt from cab2 c
               where c.papel = 'quebra'
                 and c.ln >= coalesce(m.msg_ln, 0) and c.ln <= m.ln
               order by c.ln limit 1)
           end as cand_txt,$t$,
$t$           case when m.hdr_ln is null then
             coalesce(
               (select nullif(btrim(c.txt), '') from cab2 c
                 where m.hdr_ln0 is not null and m.cerca_ln > m.hdr_ln0 and c.ln = m.cerca_ln),
               (select c.txt from cab2 c
                 where c.papel = 'quebra'
                   and c.ln >= coalesce(m.msg_ln, 0) and c.ln <= m.ln
                 order by c.ln limit 1))
           end as cand_txt,$t$);
  --    E o alarme `fornecedor_conferir` nao lista como "linha ignorada dentro do bloco"
  --    o que ficou do outro lado da cerca: aquilo ja e pergunta. Achado pela pre-prova
  --    (a D3 reprovou): sem isto a tela pedia "conferi, nao e outro fornecedor" sobre
  --    uma mensagem que o leitor ja tinha separado, e travava o aprovar por nada.
  s := pg_temp.troca(s,
$t$     where c.papel = 'quebra'
     group by f.hdr_ln, c.ln, c.txt$t$,
$t$     where c.papel = 'quebra'
       and not exists (select 1 from cercas cc where cc.ln > f.hdr_ln and cc.ln <= c.ln)
     group by f.hdr_ln, c.ln, c.txt$t$);
  s := pg_temp.troca_n(s, $t$coalesce(m.hdr_ln, 0)$t$, $t$coalesce(m.hdr_ln, m.cerca_ln, 0)$t$, 6);
  s := pg_temp.troca(s, $t$coalesce(m.hdr_ln,0))$t$, $t$coalesce(m.hdr_ln, m.cerca_ln, 0))$t$);

  -- 7. FORNECEDOR SE RECONHECE POR PALAVRA INTEIRA. `position()` achava `m apple`
  --    dentro de `garantia de 1 ano direto com apple`: o bloco do BR10 inteiro (101
  --    precos na lista de 17/08) saia no nome de M Apple. Isto ja estava no ar.
  s := pg_temp.troca(s,
$t$                 and position(privado.calc_norm(f.nome) in b.nz) > 0$t$,
$t$                 and position(privado.calc_norm(f.nome) in b.nz) > 0
                 and b.nz ~ ('(^|[^[:alnum:]])'
                             || regexp_replace(privado.calc_norm(f.nome), '([.^$*+?()\[\]{}|\\])', '\\\1', 'g')
                             || '($|[^[:alnum:]])')$t$);
  s := pg_temp.troca(s,
$t$               where a.tenant_id = p_tenant and a.tipo = 'fornecedor'
                 and position(privado.calc_norm(a.texto) in b.nz) > 0$t$,
$t$               where a.tenant_id = p_tenant and a.tipo = 'fornecedor'
                 and position(privado.calc_norm(a.texto) in b.nz) > 0
                 and b.nz ~ ('(^|[^[:alnum:]])'
                             || regexp_replace(privado.calc_norm(a.texto), '([.^$*+?()\[\]{}|\\])', '\\\1', 'g')
                             || '($|[^[:alnum:]])')$t$);

  s := pg_temp.troca(s,
$t$    select u.ln, u.txt, u.nz, u.nzq, u.inicio_msg, u.lcap, u.ltoks, u.lpol,$t$,
$t$    select u.ln, u.txt, u.nz, u.nzq, u.inicio_msg, u.lcap,
           privado.calc_toks_iphone(u.ltoks, u.lcap, (select a from fam)) as ltoks, u.lpol,$t$);

  s := pg_temp.troca(s,
$t$           privado.calc_tokens(l.txt)     as toks,
           privado.calc_capacidade(l.txt) as cap,
           privado.calc_polegada(l.txt)   as pol,$t$,
$t$           -- 13/09/2026: os tokens, a capacidade e a polegada que `uteis` ja
           -- calculou para esta linha, com a regra do iPhone.
           privado.calc_toks_iphone(u.ltoks, u.lcap, (select a from fam)) as toks,
           u.lcap as cap,
           u.lpol as pol,$t$);

  s := pg_temp.troca(s,
$t$      from linha l
     where l.preco is not null and l.descarte is null$t$,
$t$      from linha l
      join uteis u on u.ln = l.ln
     where l.preco is not null and l.descarte is null$t$);

  -- A linha de cada pergunta: cada ramo de `pend_bruta` leva o `ln`.
  s := pg_temp.troca(s,
$t$           f.txt as exemplo
      from final f where f.pilha = 'duvidoso' and f.hdr_forn is null$t$,
$t$           f.txt as exemplo, f.ln as ln
      from final f where f.pilha = 'duvidoso' and f.hdr_forn is null$t$);
  s := pg_temp.troca(s,
$t$           f.txt
      from final f where f.pilha = 'duvidoso' and f.hdr_forn is not null and f.cond is null$t$,
$t$           f.txt, f.ln
      from final f where f.pilha = 'duvidoso' and f.hdr_forn is not null and f.cond is null$t$);
  s := pg_temp.troca(s,
$t$           f.txt
      from final f where f.pilha = 'duvidoso' and f.pendura is not null$t$,
$t$           f.txt, f.ln
      from final f where f.pilha = 'duvidoso' and f.pendura is not null$t$);
  s := pg_temp.troca(s,
$t$           f.txt
      from final f
      left join cab2 md on md.ln = f.mod_ln$t$,
$t$           f.txt, f.ln
      from final f
      left join cab2 md on md.ln = f.mod_ln$t$);
  s := pg_temp.troca(s,
$t$           f.txt
      from final f where f.cor_suspeita$t$,
$t$           f.txt, f.ln
      from final f where f.cor_suspeita$t$);
  s := pg_temp.troca(s,
$t$           f.txt
      from final f where f.e_baixo$t$,
$t$           f.txt, f.ln
      from final f where f.e_baixo$t$);
  s := pg_temp.troca(s,
$t$           f.txt
      from final f where f.e_outlier$t$,
$t$           f.txt, f.ln
      from final f where f.e_outlier$t$);
  s := pg_temp.troca(s,
$t$           o.txt
      from orfas_sem_cor o$t$,
$t$           o.txt, o.ln
      from orfas_sem_cor o$t$);

  s := pg_temp.troca(s,
$t$min(exemplo) as exemplo
          from pend_bruta group by tipo, texto$t$,
$t$(array_agg(exemplo order by ln))[1] as exemplo,
               min(ln) as linha
          from pend_bruta group by tipo, texto$t$);

  s := pg_temp.troca(s,
$t$'n_linhas', n, 'exemplo', exemplo) order by n desc, tipo, texto) as arr,$t$,
$t$'n_linhas', n, 'exemplo', exemplo, 'linha', linha) order by n desc, tipo, texto) as arr,$t$);

  execute format(
    'create or replace function privado.calc_parse_v2(p_tenant uuid, p_texto text, '
    || 'p_condicoes jsonb default ''{}''::jsonb, p_forn_abertos text[] default ''{}''::text[], '
    || 'p_precos_ok text[] default ''{}''::text[]) returns jsonb language plpgsql stable '
    || 'set search_path to '''' as %L', s);
  revoke all on function privado.calc_parse_v2(uuid, text, jsonb, text[], text[]) from public;

  -- ── public.calc_carga_abrir ─────────────────────────────────────────────────
  select p.prosrc into s from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'calc_carga_abrir';
  if md5(s) <> '6a1176e94c4b5117e3bb0b3ca9ff3b76' then
    raise exception 'leitor: calc_carga_abrir mudou desde a medida (md5 %). Nada foi aplicado.', md5(s);
  end if;
  s := pg_temp.troca(s, $t$texto, n_linhas, exemplo)$t$, $t$texto, n_linhas, exemplo, linha)$t$);
  s := pg_temp.troca(s, $t$(p->>'n_linhas')::int, p->>'exemplo'$t$,
                        $t$(p->>'n_linhas')::int, p->>'exemplo', (p->>'linha')::int$t$);
  execute format(
    'create or replace function public.calc_carga_abrir(p_texto text) returns uuid '
    || 'language plpgsql security definer set search_path to '''' as %L', s);

  -- ── privado.calc_reprocessar ────────────────────────────────────────────────
  select p.prosrc into s from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'privado' and p.proname = 'calc_reprocessar';
  if md5(s) <> 'cadbd2e2ab7c18fe2e061873772c5d00' then
    raise exception 'leitor: calc_reprocessar mudou desde a medida (md5 %). Nada foi aplicado.', md5(s);
  end if;
  s := pg_temp.troca(s, $t$texto, n_linhas, exemplo)$t$, $t$texto, n_linhas, exemplo, linha)$t$);
  s := pg_temp.troca(s, $t$(p->>'n_linhas')::int, p->>'exemplo'$t$,
                        $t$(p->>'n_linhas')::int, p->>'exemplo', (p->>'linha')::int$t$);
  s := pg_temp.troca(s,
$t$'n_casou',   v_parse->'n_casou',$t$,
$t$'n_casou',   v_parse->'n_casou',
                            -- 13/09/2026: a releitura em lote cobra a G3 com esta lista.
                            'pendencias', coalesce(v_parse->'pendencias', '[]'::jsonb),$t$);
  execute format(
    'create or replace function privado.calc_reprocessar(p_tenant uuid, p_carga uuid, p_txt text, '
    || 'p_tipo text, p_texto text, p_ensinar boolean, p_quem text) returns jsonb '
    || 'language plpgsql security definer set search_path to '''' as %L', s);
end
$m$;

revoke all on function public.calc_carga_abrir(text) from public, anon;
grant execute on function public.calc_carga_abrir(text) to authenticated;
revoke all on function privado.calc_reprocessar(uuid, uuid, text, text, text, boolean, text) from public;

commit;
