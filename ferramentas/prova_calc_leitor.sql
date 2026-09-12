-- prova_calc_leitor.sql — GERADO por ferramentas/gera_provas_calc.py. NAO EDITAR A MAO.
-- Fonte unica: ferramentas/prova_calc_parse.sql (md5 a5e5f3f1e851e68d8d696e77cba1b851).
-- Mudou a fonte, rode o gerador de novo: este arquivo e sobrescrito.
--
-- Secoes: H, A, B, E, F, P. Fixtures: A, B, C, G.
-- Assercoes escritas: 62 (um laco pode executar mais de uma vez; o numero
-- que conta e o da mensagem, e a soma dos tres gerados e o total da fonte).
--
-- COMO RODAR por MCP: enxugar e colar a saida numa chamada SO de execute_sql.
--   python ferramentas/enxuga_sql.py ferramentas/prova_calc_leitor.sql <saida.sql>
-- O bloco TERMINA EM `raise exception` de proposito: nada fica gravado.
-- **O resultado e a MENSAGEM (PASSOU / REPROVOU), nunca o exit code.**
-- Leia o cabecalho da fonte para o que cada secao cobre.

-- @@declare
do $prova$
declare
  v_tenant uuid := '00000000-0000-0000-0000-000000000001';
  v_ver    text;
  v_p      text;
  v_esp    int;
  v_txt    text;   -- fixture A, formato linha
  v_txb    text;   -- fixture B, formato bloco
  v_r      jsonb;  -- resultado da fixture A, da versao do laco
  v_b      jsonb;  -- resultado da fixture B pelo v2
  v_b1     jsonb;  -- resultado da fixture B pelo v1
  v_txc    text;   -- fixture C, fornecedor desconhecido no topo e linha sem condicao
  v_cc     jsonb;  -- resultado da fixture C pelo v2
  v_txd    text;   -- fixture D, a regra da condicao (D15)
  v_dd     jsonb;  -- resultado da fixture D pelo v2
  v_falhas int := 0;
  v_total  int := 0;
  v_log    text := '';
  -- secao G
  v_fxs    text[];
  v_cargas uuid[] := '{}';
  v_i      int;
  v_pd     record;
  v_dec    text;
  v_dest   text;
  v_res    jsonb;
  v_depois jsonb;
  v_casou0 int;
  v_msg    text;
  v_poco   uuid;
  v_cond   uuid;
  v_n_aceitas  int := 0;
  v_n_recusas  int := 0;
  v_aceitas    text := '';
  v_sem_ensinar text := '';
  v_inexist    text := '';
  v_perdeu     text := '';
  v_caiu       text := '';
  v_estranha   text := '';
  -- secao R
  v_fx     uuid;   -- a pendencia de fornecedor da carga C (TABELA XPTO IMPORTS)
  v_jnome  text;   -- o nome do fornecedor `junior`, como sai na coluna `f`
  v_nova   uuid;
  v_mix    uuid;
  v_mapa   jsonb;
  v_ok     boolean;
  v_sug    text;
  v_rc     int;    -- fixture C: casou depois de `junior` = Lacrado
  v_rd     int;    -- fixture D: casou com as cinco respondidas
  -- secao K (o verbo `criar`)
  v_txe    text;   -- fixture E, o dia 1 com fornecedor e modelo novos
  v_ee     jsonb;  -- resultado da fixture E pelo v2
  v_ke     uuid;   -- a carga da fixture E
  v_pf     uuid;   -- pendencia de fornecedor `XPTO CELL IMPORTS`
  v_pf2    uuid;   -- pendencia de fornecedor `Xpto  Cell  Imports*` (irma dela)
  v_pm     uuid;   -- pendencia de modelo `jbl flip 7 lacrado`
  v_pmp    uuid;   -- pendencia de fornecedor `TABELA MP DISTRIBUIDORA`
  v_cri    jsonb;  -- retorno do `calc_catalogo_criar`
  v_dono   uuid := 'fb2aad8e-b728-4e59-a198-71da2156449d';
  v_cats_f int;    -- categorias na lista do codigo
  v_cats_c int;    -- categorias no check `calc_modelo_categoria_ck`
  v_k13    int;    -- D17: casou depois de criar o 1o fornecedor da fixture E
  -- secao L (a D18: o descarte que descarta)
  v_txf    text;   -- fixture F, as quatro formas de cabecalho descartado
  v_kf     uuid;   -- a carga da fixture F
  v_alvo   text;   -- o cabecalho que esta sendo descartado na volta do laco
  v_preco  uuid;   -- uma pendencia de `preco` (fixture A), para a trava T5
  v_l      text;   -- rotulo do vetor, so para a mensagem de falha
  -- secao P (a bateria da primeira lista real, 12/09/2026)
  v_txg    text;   -- fixture G, o formato da MP: bateria e preco em linhas proprias
  v_gg     jsonb;  -- resultado da fixture G pelo v2
begin
  -- @@fixture A
  -- ══ FIXTURE A — formato linha ═══════════════════════════════════════════════
  v_txt :=
     E'[08/09/2026, 09:12:03] Vini: Junior recreio\n'
  || E'iPhone 16 128GB Preto Lacrado - 4.299\n'
  || E'iPhone 16 128GB Azul Lacrado - 4.299\n'
  || E'iPhone 15 Pro 256GB Preto lacrado importado cpo caixa branca 1 ano - 5.150\n'
  || E'iPhone 14 128GB Azul Seminovo R$ 3.100,00\n'
  || E'iPhone 15 Pro 128GB Preto Seminovo C/ tela nova e mensagem - 3.200\n'
  || E'iPhone 16 Pro 256GB Preto lacrado caixa aberta - 6.100\n'
  || E'iPhone 14 256GB PURPLE Seminovo - 3.450\n'
  || E'iPhone 13 128GB VERDE MENTA Seminovo - 2.700\n'
  || E'iPhone 13 256GB VERDE MENTA Seminovo - 2.900\n'
  || E'Poco F8 Pro 256GB Preto Lacrado - 2.400\n'
  || E'<Midia oculta>\n\n'
  || E'[08/09/2026, 10:04:11] Vini: MELHOR DE CAXIAS\n'
  || E'MacBook Air M4 16GB Memoria 256GB Armazenamento Midnight Lacrado - 9.800\n'
  || E'MacBook Air M4 15" 16/256GB Starlight Lacrado - 11.200\n'
  || E'iPhone 15 128GB Preto Lacrado - 4,850,00\n'
  || E'iPad 11 128GB Silver Lacrado - 2.570\n'
  || E'iPad 11 128GB Preto Lacrado - 5.100\n'
  || E'iPhone 16 256GB Preto Lacrado - 4.700 a vista\n\n'
  || E'[08/09/2026, 11:30:00] Vini: TABELA XPTO IMPORTS\n'
  || E'iPhone 17 256GB Preto Lacrado - 7.300\n'
  || E'iPhone 17 512GB Preto Lacrado - 8.100\n\n'
  || E'[08/09/2026, 12:00:00] Vini: Cristiano\n'
  || E'SEMINOVOS\n'
  || E'iPhone 12 128GB Preto - 2.150\n'
  || E'iPhone 12 256GB Branco - 2.390\n';

  -- @@fixture B
  -- ══ FIXTURE B — formato BLOCO ═══════════════════════════════════════════════
  -- Escrita no formato das listas reais: o nome do produto aparece SO no
  -- cabecalho, a condicao vem num banner, e a linha do preco nao repete nada.
  -- Emoji COLADO na palavra de proposito (o `*🎼JBL`), que e o defeito de 10/09.
  v_txb :=
     E'[10/09/2026, 08:00:00] Vini: ATACADO BR10\n'
  -- 1) cor NA LINHA do preco, com qualificador (CPO) entre parenteses
  || E'*🍎 iPhone 13 Pro – 128GB (CPO)*\n'
  || E'⚪️ Branco - 💵 *R$ 3.150,00*\n'
  || E'⚫️ Preto - 💵 *R$ 3.190,00*\n\n'
  -- 2) cor ANTES do preco, ALTERNADO: e o layout que devolvia preco errado ate
  --    10/09/2026. A cor do meio empata em distancia com os dois precos.
  || E'*🍎 iPhone 14 Pro – 256GB*\n'
  || E'🔒 Lacrado\n'
  || E'🟣 Roxo\n'
  || E'💵 *R$ 4.480,00*\n'
  || E'🟡 Gold\n'
  || E'💵 *R$ 4.520,00*\n\n'
  -- 3) cor DEPOIS do preco
  || E'*🍎 iPhone 15 Pro Max – 256GB*\n'
  || E'🔒 Lacrado\n'
  || E'💵 *R$ 6.250,00*\n'
  || E'⚪️ Natural\n'
  || E'💵 *R$ 6.310,00*\n'
  || E'⚫️ Black Titanium\n\n'
  -- 4) cor ANTES do preco, par simples (uma cor, um preco: sem empate)
  || E'*🍎 iPhone 16 Pro – 256GB*\n'
  || E'🔒 Lacrado\n'
  || E'🔵 Azul\n'
  || E'💵 *R$ 5.480,00*\n\n'
  -- 5) os dois AirPods, que so o apelido separa (a perda silenciosa de 09/09)
  || E'*🎧AIRPODS 4 - Sem cancelamento de ruído*\n'
  || E'🔒 Lacrado\n'
  || E'💵 *R$ 850,00*\n\n'
  || E'*🎧AIRPODS 4 - COM cancelamento de ruído*\n'
  || E'🔒 Lacrado\n'
  || E'💵 *R$ 1.250,00*\n\n'
  -- 6) emoji colado no nome (a perda silenciosa de 10/09)
  || E'*🎼JBL BOOMBOX 4*\n'
  || E'🔒 Lacrado\n'
  || E'💵 *R$ 2.200,00*\n\n'
  -- 7) linha ignorada NO MEIO do bloco: nao pode derrubar o fornecedor (D10),
  --    e nao pode acender suspeita (D13: `Irajá` e bairro, nao fornecedor)
  || E'📍 RETIRADA: Irajá\n'
  || E'*🍎 iPhone Air – 256GB (CPO)*\n'
  || E'💵 *R$ 5.900,00*\n\n'
  -- 8) cabecalho de modelo que o catalogo NAO conhece: tem que ZERAR a heranca
  || E'*🍎 iPhone Zeta – 256GB (CPO)*\n'
  || E'💵 *R$ 9.999,00*\n';

  -- @@fixture C
  -- ══ FIXTURE C — o dia 1 de um cliente, em miniatura ══════════════════════════
  -- Fornecedor que o catalogo NAO conhece no TOPO da lista (sem fornecedor
  -- anterior para herdar), e um fornecedor conhecido com linhas SEM condicao.
  -- Ate o `2.4a zero` as duas pendencias dela eram SENTINELAS (`(sem cabecalho
  -- antes da lista)` e `sem condicao declarada`): texto que e causa, nao grafia
  -- da lista, e nenhuma resposta ensinava nada. Agora a de fornecedor nomeia o
  -- cabecalho (`TABELA XPTO IMPORTS`) e a de condicao nomeia o fornecedor
  -- (`junior`). Assercoes Z1 e Z2.
  v_txc :=
     E'[08/09/2026, 11:30:00] Vini: TABELA XPTO IMPORTS\n'
  || E'iPhone 17 256GB Preto Lacrado - 7.300\n'
  || E'iPhone 17 512GB Preto Lacrado - 8.100\n\n'
  || E'[08/09/2026, 12:00:00] Vini: Junior recreio\n'
  || E'iPhone 16 128GB Preto - 4.299\n'
  || E'iPhone 16 128GB Azul - 4.299\n';

  -- @@fixture G
  -- ══ FIXTURE G — a bateria que virava preco (12/09/2026) ═════════════════════
  -- A PRIMEIRA lista real passada pela tela saiu com 35 de 35 produtos a R$ 90-100:
  -- a MP escreve `🔋94% à 100%` numa linha propria, antes do preco, e
  -- `calc_preco` pegava o 100. Pior: o outlier (1,6x o menor) EXPULSOU o preco
  -- verdadeiro como fora de faixa. Esta fixture copia o FORMATO, nao a lista:
  -- carimbo americano (`[9/12/26, 7:52:23 PM]`), garantia em dias, bateria em
  -- linha propria, uma com faixa e uma sem, e o preco em linha `R$`. Precos
  -- inventados (restricao global 8). Medido antes do conserto: os dois produtos a
  -- 100,00. Depois: 3.111,11 e 2.222,22, 2 de 2.
  v_txg :=
     E'[9/12/26, 7:52:23 PM] Vini: ATENÇÃO! NÃO TROCAMOS APARELHO SEM OS SELOS\n'
  || E'MP IMPORTS\n'
  || E'📱 IPHONES SEMINOVOS\n'
  || E'📌 GARANTIA 30 DIAS\n'
  || E'📲 IPHONE 16 128GB 🇺🇸\n'
  || E'🔋100%\n'
  || E'(Com garantia Apple 🍎 )\n'
  || E'R$3.111,11\n'
  || E'⚫️preto\n'
  || E'⚪️branco\n'
  || E'—————————————————\n'
  || E'📲 IPHONE 15 128GB 🇺🇸\n'
  || E'🔋88% à 100%\n'
  || E'R$2.222,22\n'
  || E'⚫️preto\n';

  -- @@preambulo
  -- O gerador leva cada linha daqui SO para o arquivo que le a variavel dela.
  v_b  := privado.calc_parse_v2(v_tenant, v_txb);
  v_b1 := privado.calc_parse(v_tenant, v_txb);
  v_cc := privado.calc_parse_v2(v_tenant, v_txc);
  v_gg := privado.calc_parse_v2(v_tenant, v_txg);

  -- Cada bloco abaixo soma 1 em v_total e, se falhar, soma 1 em v_falhas e
  -- anota o motivo. O relatorio sai inteiro, nao para no primeiro erro: parar
  -- no primeiro esconde os outros e custa uma rodada por defeito.

  -- @@secao H
  -- ══ H. HELPERS ══════════════════════════════════════════════════════════════
  -- Nao dependem de versao: `calc_parse` e `calc_parse_v2` chamam os MESMOS.
  -- Sao o caminho por onde uma mudanca de helper vaza para producao.

  -- H1. Preco: as tres formas (4.299 / R$ 3.100,00 / token malformado) leem certo.
  v_total := v_total + 1;
  if privado.calc_preco('iPhone 16 128GB Preto Lacrado - 4.299') <> 4299 then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [helper] preco 4.299 nao leu 4299';
  end if;
  v_total := v_total + 1;
  if privado.calc_preco('iPhone 14 128GB Azul Seminovo R$ 3.100,00') <> 3100 then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [helper] preco R$ 3.100,00 nao leu 3100';
  end if;

  -- H2. A capacidade NAO pode ser lida como preco, e o modelo NAO pode ser
  --     lido como polegada. Sao as duas armadilhas do `\y`.
  v_total := v_total + 1;
  if privado.calc_preco('iPhone 16 256GB') is not null then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [helper] linha sem preco devolveu preco (leu a capacidade como dinheiro)';
  end if;
  v_total := v_total + 1;
  if privado.calc_polegada_canon('iPhone 16 256GB') is not null then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [helper] o numero do modelo do iPhone 16 foi lido como polegada';
  end if;
  v_total := v_total + 1;
  if privado.calc_polegada_canon('MacBook Air M4 13" 16/256GB') <> 13 then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [helper] a polegada marcada do MacBook nao foi lida';
  end if;

  -- H3. EMOJI COLADO NAO COME O NOME. `calc_limpar` tem que separar o emoji da
  --     palavra, senao o token vira `🎼jbl` e o casamento por token nunca ve
  --     `jbl`. O produto entao simplesmente NAO EXISTE no blob, sem pendencia e
  --     sem queda de cobertura: e a terceira aparicao da PERDA SILENCIOSA.
  --     Quem tem apelido escapava (o apelido casa por position() sobre o texto
  --     inteiro, atravessando o emoji), e foi isso que mascarou o defeito.
  v_total := v_total + 1;
  if not ('jbl' = any(privado.calc_tokens(privado.calc_limpar('*🎼JBL BOOMBOX 4*')))) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [helper] emoji colado comeu o nome: sem token `jbl` em *🎼JBL BOOMBOX 4*';
  end if;
  v_total := v_total + 1;
  if not ('macbook' = any(privado.calc_tokens(privado.calc_limpar('*💻MACBOOK NEO 256GB/8RAM*'))))
     or not ('airpods' = any(privado.calc_tokens(privado.calc_limpar('*🎧AIRPODS 4 ANC*')))) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [helper] emoji colado comeu o nome em MACBOOK ou AIRPODS';
  end if;

  -- H4. E o conserto do H3 NAO pode quebrar acento. `calc_limpar` roda ANTES de
  --     `calc_norm`, com o texto ainda acentuado: separar "nao-ASCII" partiria
  --     `RELÓGIO` em `REL Ó GIO`. A classe usada deixa acento de fora porque em
  --     locale UTF-8 `Ó`, `Ê` e `ª` contam como alfanumericos.
  v_total := v_total + 1;
  if privado.calc_limpar('*⌚️RELÓGIO GARMIN FÊNIX 8*') not like '%RELÓGIO%'
     or privado.calc_limpar('*⌚️RELÓGIO GARMIN FÊNIX 8*') not like '%FÊNIX%' then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [helper] a separacao de emoji quebrou o acento (RELÓGIO / FÊNIX)';
  end if;
  v_total := v_total + 1;
  if privado.calc_limpar('AirPods Pro 3ª geração') <> 'AirPods Pro 3ª geração'
     or privado.calc_limpar('MacBook Air M4 13" 16/256GB') <> 'MacBook Air M4 13" 16/256GB' then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [helper] a separacao de emoji mexeu no ordinal (3ª) ou na polegada (13")';
  end if;

  -- @@secao A
  -- ══ A. FIXTURE A, nas DUAS versoes ══════════════════════════════════════════
  foreach v_ver in array array['calc_parse_v2'] loop
  execute format('select privado.%I($1,$2)', v_ver) into v_r using v_tenant, v_txt;
  v_p   := E'\n  FALHA  [' || v_ver || '] ';
  -- teto atingivel da fixture A, por versao. Ver A20.
  v_esp := 13;

  -- A1. O carimbo do WhatsApp nao vira cabecalho de fornecedor.
  --     Se `Vini` (o remetente) virasse fornecedor, todo preco seria dele.
  v_total := v_total + 1;
  if (v_r->'cabecalhos')::text ilike '%"fornecedor": "vini"%' then
    v_falhas := v_falhas + 1;
    v_log := v_log || v_p || 'o remetente do WhatsApp virou fornecedor';
  end if;

  -- A2. CPO ganha de Lacrado na MESMA linha (calc_regra.prioridade 10 x 20).
  --     Foi a inversao que gerou 341 produtos com zero CPO em 27/07/2026.
  v_total := v_total + 1;
  if not exists (
    select 1 from jsonb_array_elements(v_r->'produtos') p
     where p->>'n' = 'iPhone 15 Pro 256GB' and p->>'t' = 'CPO') then
    v_falhas := v_falhas + 1;
    v_log := v_log || v_p || 'linha com cpo E lacrado nao virou CPO';
  end if;

  -- A3. Descarte NAO vira preco e NAO vira pendencia: vira descarte contado.
  --     `caixa aberta` e o caso caro: ela nao impede o modelo de casar, entao
  --     sem a regra o aparelho entra como Lacrado e vira o MENOR custo.
  v_total := v_total + 1;
  if exists (
    select 1 from jsonb_array_elements(v_r->'produtos') p,
                  jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) c
     where (c->>'v')::numeric = 3200 or (c->>'v')::numeric = 6100) then
    v_falhas := v_falhas + 1;
    v_log := v_log || v_p || 'aparelho com mensagem ou caixa aberta virou preco';
  end if;

  v_total := v_total + 1;
  if (v_r->>'n_descarte')::int < 2 then
    v_falhas := v_falhas + 1;
    v_log := v_log || v_p || 'os dois descartes nao foram contados (obtido '
             || (v_r->>'n_descarte') || ')';
  end if;

  -- A4. Cor por apelido: PURPLE -> Lilas, com o hex do catalogo, nunca inventado.
  v_total := v_total + 1;
  if not exists (
    select 1 from jsonb_array_elements(v_r->'produtos') p,
                  jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) c
     where c->>'n' = 'Lilás' and c->>'h' = '#7b6b9e') then
    v_falhas := v_falhas + 1;
    v_log := v_log || v_p || 'o apelido de cor PURPLE nao virou Lilás com o hex do catalogo';
  end if;

  -- A5. Cor DECORADA vira UMA pendencia de COR, agrupada, nunca uma por linha.
  --     `VERDE MENTA` contem `verde` como palavra inteira: sem esta trava a cor
  --     desconhecida entrava com o hex de outra cor, calada, violando o
  --     "nunca inventar hex sem avisar". As duas linhas tem que dar n_linhas=2
  --     numa pendencia so, e o tipo tem que ser `cor` (nao `modelo`: o modelo
  --     casou, quem nao casou foi a cor).
  v_total := v_total + 1;
  if not exists (
    select 1 from jsonb_array_elements(v_r->'pendencias') p
     where p->>'tipo' = 'cor' and p->>'texto' = 'verde menta'
       and (p->>'n_linhas')::int = 2) then
    v_falhas := v_falhas + 1;
    v_log := v_log || v_p || 'cor decorada nao gerou UMA pendencia de cor com as 2 linhas';
  end if;

  -- A6. E a cor decorada NAO pode ter entrado no blob com o hex do Verde.
  v_total := v_total + 1;
  if exists (
    select 1 from jsonb_array_elements(v_r->'produtos') p
     where p->>'n' in ('iPhone 13 128GB','iPhone 13 256GB')) then
    v_falhas := v_falhas + 1;
    v_log := v_log || v_p || 'a cor decorada entrou no blob com hex de outra cor';
  end if;

  -- A7. Pendencia de modelo desconhecido agrupa SEM o preco na chave, senao
  --     cada preco vira uma decisao e o dia 1 fica inviavel.
  v_total := v_total + 1;
  if exists (
    select 1 from jsonb_array_elements(v_r->'pendencias') p
     where p->>'tipo' = 'modelo' and p->>'texto' ~ '[0-9][.,][0-9]{3}') then
    v_falhas := v_falhas + 1;
    v_log := v_log || v_p || 'a chave da pendencia de modelo ainda carrega o preco';
  end if;

  -- A8. Android com a regra DESLIGADA nao e descarte: e pendencia.
  --     O dono aceitou ~6 pendencias por carga para nao perder o aparelho.
  v_total := v_total + 1;
  if not exists (
    select 1 from jsonb_array_elements(v_r->'pendencias') p
     where p->>'exemplo' ilike '%Poco F8%') then
    v_falhas := v_falhas + 1;
    v_log := v_log || v_p || 'Android com regra desligada nao virou pendencia';
  end if;

  -- A9. Banner de condicao (SEMINOVOS) NAO troca o fornecedor do bloco.
  v_total := v_total + 1;
  if not exists (
    select 1 from jsonb_array_elements(v_r->'produtos') p
     where p->>'n' = 'iPhone 12 128GB' and p->>'t' = 'Seminovo'
       and p->>'f' = 'Cristiano') then
    v_falhas := v_falhas + 1;
    v_log := v_log || v_p || 'o banner SEMINOVOS quebrou o bloco do Cristiano ou nao deu a condicao';
  end if;

  -- A10. Mac por rotulo, sem polegada escrita: deducao Air = 13" (formato-dados 4b).
  v_total := v_total + 1;
  if not exists (
    select 1 from jsonb_array_elements(v_r->'produtos') p
     where p->>'n' = 'MacBook Air M4 13" 16/256GB') then
    v_falhas := v_falhas + 1;
    v_log := v_log || v_p || 'Air sem polegada escrita nao caiu em 13" (16GB Memoria / 256GB Armazenamento)';
  end if;

  -- A11. Mac COM polegada escrita respeita a polegada, nao cai na deducao.
  v_total := v_total + 1;
  if not exists (
    select 1 from jsonb_array_elements(v_r->'produtos') p
     where p->>'n' = 'MacBook Air M4 15" 16/256GB') then
    v_falhas := v_falhas + 1;
    v_log := v_log || v_p || 'Air 15" escrito nao casou com o canonico de 15"';
  end if;

  -- A12. Outlier: 5.100 contra menor 2.570 na mesma combinacao (fator 1.6).
  --      Pegou um iPad lido a 5.100 quando o menor real era 2.570.
  v_total := v_total + 1;
  if exists (
    select 1 from jsonb_array_elements(v_r->'produtos') p,
                  jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) c
     where p->>'n' = 'iPad 11 128GB' and (c->>'v')::numeric = 5100) then
    v_falhas := v_falhas + 1;
    v_log := v_log || v_p || 'o outlier de 5.100 entrou no blob';
  end if;

  -- A13. Condicao pendurada ("a vista") vira pendencia, nunca preco:
  --      a calc nao tem onde guardar condicao, e ignora-la e mentir sobre o preco.
  v_total := v_total + 1;
  if exists (
    select 1 from jsonb_array_elements(v_r->'produtos') p,
                  jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) c
     where (c->>'v')::numeric = 4700) then
    v_falhas := v_falhas + 1;
    v_log := v_log || v_p || 'preco com condicao pendurada entrou no blob';
  end if;

  -- A14. `novo` NAO pode casar dentro de `seminovo`. Sem fronteira de palavra
  --      a regra `lacrado|novo` (prioridade 20) engolia `seminovo` (30) e TODA
  --      linha de seminovo era gravada como Lacrado, misturando as duas
  --      tabelas. Mesma classe do CPO invertido de 27/07/2026.
  v_total := v_total + 1;
  if not exists (
    select 1 from jsonb_array_elements(v_r->'produtos') p
     where p->>'n' = 'iPhone 14 128GB' and p->>'t' = 'Seminovo') then
    v_falhas := v_falhas + 1;
    v_log := v_log || v_p || 'linha escrita "Seminovo" foi gravada como outra condicao';
  end if;

  -- A15. Preco com PONTO decimal (o que a regra de token 4,850,00 produz) nao
  --      pode sumir. Ele sumia inteiro: nao entrava no blob e nao virava
  --      pendencia. Linha que some e pior que linha que erra.
  v_total := v_total + 1;
  if not exists (
    select 1 from jsonb_array_elements(v_r->'produtos') p,
                  jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) c
     where p->>'n' = 'iPhone 15 128GB' and (c->>'v')::numeric = 4850) then
    v_falhas := v_falhas + 1;
    v_log := v_log || v_p || 'o preco com ponto decimal (4850.00) nao entrou no blob';
  end if;

  -- A16. Cobertura e MEDIDA, e o denominador e coerente.
  v_total := v_total + 1;
  if (v_r->>'n_lidas')::int = 0
     or (v_r->>'n_casou')::int > (v_r->>'n_lidas')::int then
    v_falhas := v_falhas + 1;
    v_log := v_log || v_p || 'cobertura incoerente: casou '
             || (v_r->>'n_casou') || ' de ' || (v_r->>'n_lidas');
  end if;

  -- A17. Todo produto do blob passa no que validarDados() exige, senao a carga
  --      derruba a calc INTEIRA, nao so aquela linha.
  v_total := v_total + 1;
  if exists (
    select 1 from jsonb_array_elements(v_r->'produtos') p
     where p->>'n' is null or p->>'c' is null or p->>'t' is null
        or p->>'f' is null or p->>'l' is null
        or not (
             (p ? 'v' and (p->>'v')::numeric > 0)
             or (p ? 'cs' and jsonb_array_length(p->'cs') > 0
                 and not exists (select 1 from jsonb_array_elements(p->'cs') c
                                  where c->>'n' is null or coalesce((c->>'v')::numeric,0) <= 0))
           )) then
    v_falhas := v_falhas + 1;
    v_log := v_log || v_p || 'produto proposto nao passa em validarDados()';
  end if;

  -- A18. Produto nunca tem `v` E `cs` ao mesmo tempo.
  v_total := v_total + 1;
  if exists (select 1 from jsonb_array_elements(v_r->'produtos') p
              where p ? 'v' and p ? 'cs') then
    v_falhas := v_falhas + 1;
    v_log := v_log || v_p || 'produto saiu com v e cs juntos';
  end if;

  -- ── D. O contrato do v2 no cabecalho desconhecido (D10, 09/09/2026) ──────────
  -- A regra antiga: "linha que eu nao reconheco = trocou de fornecedor". Numa
  -- lista de WhatsApp linha nao reconhecida e o caso COMUM, e ela derrubou 25,
  -- 14 e 28 linhas em tres rodadas de medicao contra lista real.
  -- A regra nova (v2): o fornecedor vale do cabecalho DELE ate o proximo
  -- cabecalho de fornecedor RECONHECIDO. A trava nao sumiu, MUDOU DE LUGAR:
  -- vai para `fornecedor_conferir`, que a tela tem que por na frente do dono
  -- antes do botao de aprovar.
  -- v2: o cabecalho desconhecido NAO derruba o bloco...
  v_total := v_total + 1;
  if not exists (
    select 1 from jsonb_array_elements(v_r->'produtos') p
     where p->>'n' = 'iPhone 17 256GB' and p->>'f' = 'Five Cell') then
    v_falhas := v_falhas + 1;
    v_log := v_log || v_p || 'o cabecalho desconhecido voltou a derrubar o bloco (o domino do D10)';
  end if;

  -- ...e por isso ele NAO e mais pendencia de fornecedor...
  v_total := v_total + 1;
  if exists (
    select 1 from jsonb_array_elements(v_r->'pendencias') p
     where p->>'tipo' = 'fornecedor') then
    v_falhas := v_falhas + 1;
    v_log := v_log || v_p || 'cabecalho desconhecido ainda vira pendencia de fornecedor no v2';
  end if;

  -- ...mas a trava TEM que aparecer em `fornecedor_conferir`, nomeando a linha
  -- ignorada, e com `suspeita_alta` ACESO: `XPTO IMPORTS` carrega `imports`,
  -- palavra que aparece em nome de fornecedor ja cadastrado. Sem isto a defesa
  -- que saiu do parser nao existe em lugar nenhum.
  v_total := v_total + 1;
  if not exists (
    select 1 from jsonb_array_elements(v_r->'fornecedor_conferir') f
     where f->>'cabecalho' = 'MELHOR DE CAXIAS'
       and (f->>'suspeita_alta')::boolean
       and (f->'ignoradas')::text ilike '%XPTO%') then
    v_falhas := v_falhas + 1;
    v_log := v_log || v_p || 'o cabecalho ignorado nao aparece em fornecedor_conferir com suspeita_alta';
  end if;

  -- A20. O TETO DA FIXTURE A. Esta lista e um circuito de armadilhas, nao uma
  --      carga representativa: das 18 linhas lidas, varias foram escritas para
  --      falhar de proposito (2 de cor decorada, 1 Android, 1 de condicao
  --      pendurada, 1 outlier, e no v1 tambem as 2 do cabecalho desconhecido).
  --      A cobertura daqui NAO diz nada sobre o portao do Bloco 2, que so a
  --      carga real do dono mede (D7). O que esta assercao cobra e casar TUDO
  --      o que era possivel casar naquela versao.
  v_total := v_total + 1;
  if (v_r->>'n_casou')::int <> v_esp then
    v_falhas := v_falhas + 1;
    v_log := v_log || v_p || 'casou ' || (v_r->>'n_casou')
             || ' das ' || v_esp || ' linhas atingiveis da fixture A';
  end if;

  end loop;

  -- @@secao B
  -- ══ B. FIXTURE B — formato BLOCO, so o v2 ═══════════════════════════════════

  -- B0. Por que o v2 existe, medido e nao herdado de documento: o v1 exige
  --     modelo E capacidade na MESMA linha do preco, e a lista real nao escreve
  --     assim. Se esta assercao cair, alguem "simplificou" o v2 de volta.
  v_total := v_total + 1;
  if (v_b1->>'n_casou')::int <> 0 then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [fixture B] o v1 casou ' || (v_b1->>'n_casou')
             || ' no formato bloco (o esperado e 0: e a razao de o v2 existir)';
  end if;

  -- B1. Formato 1 — cor NA LINHA do preco. E o qualificador entre parenteses
  --     do cabecalho vale como condicao do bloco (`(CPO)`), sem virar `Lacrado`
  --     por causa de banner de outro bloco.
  v_total := v_total + 1;
  if not exists (
    select 1 from jsonb_array_elements(v_b->'produtos') p,
                  jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) c
     where p->>'n' = 'iPhone 13 Pro 128GB' and p->>'t' = 'CPO'
       and c->>'n' = 'Branco' and (c->>'v')::numeric = 3150)
   or not exists (
    select 1 from jsonb_array_elements(v_b->'produtos') p,
                  jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) c
     where p->>'n' = 'iPhone 13 Pro 128GB' and p->>'t' = 'CPO'
       and c->>'n' = 'Preto' and (c->>'v')::numeric = 3190) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [fixture B] formato "cor na linha" nao deu Branco=3150 / Preto=3190 em CPO';
  end if;

  -- B2. Formato 2 — cor DEPOIS do preco. A cor solta se liga ao preco NU mais
  --     proximo do mesmo bloco de modelo.
  v_total := v_total + 1;
  if not exists (
    select 1 from jsonb_array_elements(v_b->'produtos') p,
                  jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) c
     where p->>'n' = 'iPhone 15 Pro Max 256GB' and p->>'t' = 'Lacrado'
       and c->>'n' = 'Natural' and (c->>'v')::numeric = 6250)
   or not exists (
    select 1 from jsonb_array_elements(v_b->'produtos') p,
                  jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) c
     where p->>'n' = 'iPhone 15 Pro Max 256GB' and p->>'t' = 'Lacrado'
       and c->>'n' = 'Black Titanium' and (c->>'v')::numeric = 6310) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [fixture B] formato "cor depois do preco" nao deu Natural=6250 / Black Titanium=6310';
  end if;

  -- B3. Formato 3 — cor ANTES do preco, ALTERNADO. E o defeito que esta prova
  --     achou (ver a nota do cabecalho): a cor do meio empata em distancia com
  --     os dois precos, e o desempate por linha entregava o de CIMA, que ja era
  --     da cor anterior. Gold saia com 4480, o preco do Roxo, e o 4.520 virava
  --     orfa. Consertado com o pareamento por ORDEM.
  --     Esta e a assercao que impede a volta, e ela cobra o PAR INTEIRO: so
  --     conferir o Roxo passaria verde com o defeito no lugar.
  v_total := v_total + 1;
  if not exists (
    select 1 from jsonb_array_elements(v_b->'produtos') p,
                  jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) c
     where p->>'n' = 'iPhone 14 Pro 256GB' and p->>'t' = 'Lacrado'
       and c->>'n' = 'Roxo' and (c->>'v')::numeric = 4480)
   or not exists (
    select 1 from jsonb_array_elements(v_b->'produtos') p,
                  jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) c
     where p->>'n' = 'iPhone 14 Pro 256GB' and p->>'t' = 'Lacrado'
       and c->>'n' = 'Gold' and (c->>'v')::numeric = 4520) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [fixture B] "cor antes do preco" alternado nao deu Roxo=4480 / Gold=4520 (o desempate voltou a pegar o preco de cima)';
  end if;

  -- B3b. E nenhuma cor pode ter ficado orfa neste bloco: se o pareamento errar,
  --      um dos dois precos sobra e vira pendencia "sem cor num grupo que tem
  --      cor". Duas cores entraram, duas tem que sair.
  v_total := v_total + 1;
  if (select count(*) from jsonb_array_elements(v_b->'produtos') p,
                           jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) c
       where p->>'n' = 'iPhone 14 Pro 256GB') <> 2 then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [fixture B] o bloco alternado nao saiu com as DUAS cores (um preco virou orfa)';
  end if;

  -- B3c. Formato 4 — cor ANTES do preco, par simples (sem empate possivel).
  v_total := v_total + 1;
  if not exists (
    select 1 from jsonb_array_elements(v_b->'produtos') p,
                  jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) c
     where p->>'n' = 'iPhone 16 Pro 256GB' and p->>'t' = 'Lacrado'
       and c->>'n' = 'Azul' and (c->>'v')::numeric = 5480) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [fixture B] formato "cor antes do preco" (par simples) nao deu Azul=5480';
  end if;

  -- B4. OS DOIS AIRPODS SAEM SEPARADOS. Perda silenciosa achada em 09/09/2026:
  --     a linha do ANC nao diz a sigla `anc`, entao o multiconjunto de tokens
  --     casava `AirPods 4` nos DOIS casos. Caiam no mesmo produto, mesmo
  --     fornecedor, sem cor, e o `min(preco)` ficava com 850: o ANC de 1250
  --     SUMIA do blob sem virar pendencia. Nada na tela indicaria a falta.
  --     So os apelidos os separam.
  v_total := v_total + 1;
  if not exists (
    select 1 from jsonb_array_elements(v_b->'produtos') p
     where p->>'n' = 'AirPods 4' and (p->>'v')::numeric = 850)
   or not exists (
    select 1 from jsonb_array_elements(v_b->'produtos') p
     where p->>'n' = 'AirPods 4 ANC' and (p->>'v')::numeric = 1250) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [fixture B] os dois AirPods nao sairam separados (850 sem ANC, 1250 com ANC)';
  end if;

  -- B5. E o par tem que ser exatamente DOIS produtos. Se virar um so, o outro
  --     preco foi engolido pelo min() em silencio.
  v_total := v_total + 1;
  if (select count(*) from jsonb_array_elements(v_b->'produtos') p
       where p->>'n' like 'AirPods 4%') <> 2 then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [fixture B] os dois AirPods colapsaram num produto so (o de maior preco sumiu no min())';
  end if;

  -- B6. Emoji colado, de ponta a ponta: o H3 prova o helper, este prova que o
  --     produto chega ao blob com a categoria certa. `JBL` e categoria propria
  --     (D11) porque a margem e POR CATEGORIA, e uma caixa de som de R$ 2.200
  --     nao divide regra com cabo de R$ 90.
  v_total := v_total + 1;
  if not exists (
    select 1 from jsonb_array_elements(v_b->'produtos') p
     where p->>'n' = 'JBL Boombox 4' and p->>'c' = 'JBL'
       and p->>'t' = 'Lacrado' and (p->>'v')::numeric = 2200) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [fixture B] *🎼JBL BOOMBOX 4* nao chegou ao blob como JBL Boombox 4 / JBL / 2200';
  end if;

  -- B7. O iPhone Air casa pelo APELIDO do catalogo e nao herda o modelo do
  --     bloco anterior. O bloco antes dele e o JBL: sem a heranca zerada, os
  --     R$ 5.900 do Air seriam gravados no nome da caixa de som.
  v_total := v_total + 1;
  if not exists (
    select 1 from jsonb_array_elements(v_b->'produtos') p
     where p->>'n' = 'iPhone 17 Air 256GB' and p->>'t' = 'CPO'
       and (p->>'v')::numeric = 5900) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [fixture B] o iPhone Air nao casou pelo apelido (esperado iPhone 17 Air 256GB / CPO / 5900)';
  end if;

  v_total := v_total + 1;
  if exists (
    select 1 from jsonb_array_elements(v_b->'produtos') p
     where p->>'n' = 'JBL Boombox 4' and (p->>'v')::numeric = 5900) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [fixture B] o preco do iPhone Air foi gravado no modelo do bloco anterior';
  end if;

  -- B8. A TRAVA QUE FICA E NAO SE MEXE: cabecalho de modelo que o catalogo nao
  --     conhece vira `modelo_desconhecido` e ZERA o modelo herdado. Sem isso o
  --     preco de um aparelho e gravado no nome de outro. Pendencia e barata;
  --     atribuicao errada, nao.
  v_total := v_total + 1;
  if exists (
    select 1 from jsonb_array_elements(v_b->'produtos') p
     where (p->>'v')::numeric = 9999)
   or exists (
    select 1 from jsonb_array_elements(v_b->'produtos') p,
                  jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) c
     where (c->>'v')::numeric = 9999) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [fixture B] o preco sob cabecalho desconhecido herdou o modelo anterior';
  end if;

  -- B9. E ele vira pendencia que NOMEIA O CABECALHO, nao a linha do preco.
  --     `iPhone Zeta 256GB` ensina qual apelido falta ao catalogo;
  --     `💵 *R$ 9.999,00*` nao ensina nada.
  v_total := v_total + 1;
  if not exists (
    select 1 from jsonb_array_elements(v_b->'pendencias') p
     where p->>'tipo' = 'modelo' and p->>'texto' ilike '%Zeta%') then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [fixture B] a pendencia de modelo nao nomeia o cabecalho que nao casou';
  end if;

  -- B10. D10 + D13, o par que anda junto. A linha ignorada NO MEIO do bloco nao
  --      derruba o fornecedor das linhas abaixo dela (o Air e o Zeta vem depois
  --      do `📍 RETIRADA:`), e ela aparece em `fornecedor_conferir`...
  v_total := v_total + 1;
  if not exists (
    select 1 from jsonb_array_elements(v_b->'produtos') p
     where p->>'n' = 'iPhone 17 Air 256GB' and p->>'f' = 'BR10') then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [fixture B] a linha ignorada no meio do bloco derrubou o fornecedor das de baixo';
  end if;

  -- ...com `suspeita_alta` APAGADO. Este e o lado caro do D13: `Irajá` e bairro,
  -- e nao ha heuristica que separe `Cristiano` (loja) de `Irajá` (bairro) sem
  -- falso positivo semanal. Falso positivo semanal treina a pessoa a clicar
  -- "ok" sem ler, que e PIOR do que nao avisar.
  v_total := v_total + 1;
  if not exists (
    select 1 from jsonb_array_elements(v_b->'fornecedor_conferir') f
     where f->>'fornecedor' = 'BR10'
       and (f->'ignoradas')::text ilike '%RETIRADA%'
       and not (f->>'suspeita_alta')::boolean) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [fixture B] a linha ignorada nao aparece em fornecedor_conferir, ou acendeu suspeita_alta em bairro';
  end if;

  -- B11. Os mesmos invariantes de blob da fixture A valem aqui.
  v_total := v_total + 1;
  if exists (
    select 1 from jsonb_array_elements(v_b->'produtos') p
     where p->>'n' is null or p->>'c' is null or p->>'t' is null
        or p->>'f' is null or p->>'l' is null
        or (p ? 'v' and p ? 'cs')
        or not (
             (p ? 'v' and (p->>'v')::numeric > 0)
             or (p ? 'cs' and jsonb_array_length(p->'cs') > 0
                 and not exists (select 1 from jsonb_array_elements(p->'cs') c
                                  where c->>'n' is null or coalesce((c->>'v')::numeric,0) <= 0))
           )) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [fixture B] produto proposto nao passa em validarDados()';
  end if;

  -- B12. O TETO DA FIXTURE B: 12 linhas com preco, e SO a do `iPhone Zeta` foi
  --      escrita para nao casar. Teto 11. Numero fixo de proposito: se cair para
  --      10, alguma das travas acima virou perda silenciosa; se subir para 12, a
  --      trava do modelo desconhecido caiu.
  v_total := v_total + 1;
  if (v_b->>'n_casou')::int <> 11 or (v_b->>'n_lidas')::int <> 12 then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [fixture B] casou ' || (v_b->>'n_casou')
             || ' de ' || (v_b->>'n_lidas') || ' (esperado 11 de 12)';
  end if;

  -- @@secao E
  -- == E. TODO CHAMADOR DO PARSER USA A MESMA VERSAO ==========================
  -- Esta secao nasceu de um defeito REAL, em 10/09/2026, e ela e o guarda contra
  -- a classe inteira, nao contra o caso.
  --
  -- A promocao do v2 trocou o parser de `calc_carga_abrir` e DEIXOU
  -- `calc_pendencia_resolver` para tras. Mas o resolver REPROCESSA a carga
  -- inteira a cada pendencia respondida. Efeito: a carga abria lida pelo v2 e,
  -- na PRIMEIRA resposta do dono, era reescrita pelo v1, que le menos. Na
  -- fixture B deste arquivo isso e `n_casou` caindo de 11 de 12 para 0 de 12: o
  -- dono resolve uma pendencia para MELHORAR a carga e a carga desaba, calado.
  --
  -- Nenhuma assercao de parse pegava isso, porque cada versao, sozinha, estava
  -- certa. O que estava errado era a COMBINACAO de chamadores, e combinacao nao
  -- se ve olhando funcao por funcao.
  --
  -- A regra e "todos no mesmo", nao "todos no v2": no dia em que nascer um v3,
  -- esta assercao continua cobrando a coerencia sem precisar ser reescrita, e
  -- reprova exatamente na janela perigosa, que e a de promocao pela metade.
  --
  -- DESDE 11/09/2026 (`2.4a`, o verbo `criar`) a releitura mora em
  -- `privado.calc_reprocessar`, chamada pelo resolver e pelo `criar`. Entao o
  -- chamador do parser no caminho de RESPONDER nao esta mais em `public`. Olhar
  -- so `public` deixaria esta assercao vendo um chamador so (`calc_carga_abrir`),
  -- e "todos no mesmo" com um so e verde por construcao. Foi a E2 que pegou isso
  -- na primeira rodada depois da extracao: exatamente o trabalho para o qual ela
  -- existe. O escopo passa a ser `public` MAIS o `calc_reprocessar`.
  v_total := v_total + 1;
  if (select count(distinct case when prosrc like '%calc_parse_v2%'
                                 then 'v2' else 'v1' end)
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where p.prosrc like '%calc_parse%'
         and (n.nspname = 'public'
              or (n.nspname = 'privado' and p.proname = 'calc_reprocessar'))) <> 1 then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'
  FALHA  [chamadores] os chamadores do parser nao usam todos a MESMA versao'
             || E' (promocao pela metade: a cobertura muda sozinha entre abrir e responder)'
             || E'
         ' || (
               select string_agg(n.nspname || '.' || p.proname || '=' ||
                      case when p.prosrc like '%calc_parse_v2%' then 'v2' else 'v1' end, ', '
                      order by p.proname)
                 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where p.prosrc like '%calc_parse%'
                  and (n.nspname = 'public'
                       or (n.nspname = 'privado' and p.proname = 'calc_reprocessar')));
  end if;

  -- E2. Os chamadores estao nomeados, para a assercao acima nao passar verde
  --     por nao encontrar ninguem. E a cadeia do caminho de RESPONDER esta
  --     inteira: os dois verbos que releem (`calc_pendencia_resolver` e
  --     `calc_catalogo_criar`) passam por `privado.calc_reprocessar` e NENHUM
  --     deles chama o parser direto. Um que voltasse a chamar seria a segunda
  --     copia da releitura renascendo, que e o que a extracao existe para impedir.
  v_total := v_total + 1;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where p.prosrc like '%calc_parse%'
         and ((n.nspname = 'public'  and p.proname = 'calc_carga_abrir')
           or (n.nspname = 'privado' and p.proname = 'calc_reprocessar'))) <> 2
     or (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'
            and p.proname in ('calc_pendencia_resolver','calc_catalogo_criar')
            and p.prosrc like '%privado.calc_reprocessar(%'
            and p.prosrc not like '%calc_parse%') <> 2 then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'
  FALHA  [chamadores] a cadeia de chamada do parser mudou: esperado calc_carga_abrir e privado.calc_reprocessar chamando o parser, e o resolver e o criar passando SO pelo calc_reprocessar';
  end if;

  -- E3. NENHUMA `calc_*` de `public` tem sobrecarga.
  --     Irma da E1, e a variante SILENCIOSA dela. `create or replace` que erra o
  --     TIPO de um parametro (`varchar` onde era `text`) nao e recusado: cria uma
  --     SOBRECARGA. Ficariam duas `calc_pendencia_resolver` convivendo, uma no v1
  --     e outra no v2, e qual o PostgREST chama depende dos nomes de argumento do
  --     POST. A E1 passaria verde, porque as duas existem e uma delas esta no v2.
  --     Medido em 10/09/2026: a mesma edicao que originou a E1 errou a assinatura
  --     (omitiu `default null`); ali o Postgres GRITOU (42P13). Se o erro tivesse
  --     sido de tipo, teria passado calado.
  v_total := v_total + 1;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like 'calc\_%'
     group by p.proname having count(*) > 1) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'
  FALHA  [chamadores] existe calc_* com SOBRECARGA em public: '
             || (select string_agg(x.proname || ' x' || x.n, ', ' order by x.proname)
                   from (select p.proname, count(*) as n
                           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                          where n.nspname = 'public' and p.proname like 'calc\_%'
                          group by p.proname having count(*) > 1) x)
             || ' (o PostgREST escolhe pelos nomes de argumento do POST)';
  end if;

  -- @@secao F
  -- ══ F. CONSERVACAO DE LINHAS ═══════════════════════════════════════════════
  -- Toda linha lida esta em ALGUMA pilha: `n_lidas = n_casou + n_duvidoso +
  -- n_nao_reconhecido` (o descarte sai de `n_lidas`, por desenho). Linha que
  -- nao esta em pilha nenhuma nao vira preco, nao vira pendencia e nao aparece
  -- em contador nenhum: e a PERDA SILENCIOSA, e em 11/09/2026 ela foi medida
  -- acontecendo via apelido para destino inexistente (lidas=3, casou=1,
  -- pendencias=0). As duas RPCs agora recusam isso em execucao (guarda G2 da
  -- migration); aqui a lei e cobrada direto no leitor, nas tres fixtures.
  v_total := v_total + 1;
  if (v_r->>'n_lidas')::int is distinct from
     (v_r->>'n_casou')::int + (v_r->>'n_duvidoso')::int + (v_r->>'n_nao_reconhecido')::int then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [conservacao] fixture A: lidas ' || (v_r->>'n_lidas')
             || ' <> casou ' || (v_r->>'n_casou') || ' + duvidoso ' || (v_r->>'n_duvidoso')
             || ' + nao reconhecido ' || (v_r->>'n_nao_reconhecido');
  end if;
  v_total := v_total + 1;
  if (v_b->>'n_lidas')::int is distinct from
     (v_b->>'n_casou')::int + (v_b->>'n_duvidoso')::int + (v_b->>'n_nao_reconhecido')::int then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [conservacao] fixture B: lidas ' || (v_b->>'n_lidas')
             || ' <> casou ' || (v_b->>'n_casou') || ' + duvidoso ' || (v_b->>'n_duvidoso')
             || ' + nao reconhecido ' || (v_b->>'n_nao_reconhecido');
  end if;
  v_total := v_total + 1;
  if (v_cc->>'n_lidas')::int is distinct from
     (v_cc->>'n_casou')::int + (v_cc->>'n_duvidoso')::int + (v_cc->>'n_nao_reconhecido')::int then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [conservacao] fixture C: lidas ' || (v_cc->>'n_lidas')
             || ' <> casou ' || (v_cc->>'n_casou') || ' + duvidoso ' || (v_cc->>'n_duvidoso')
             || ' + nao reconhecido ' || (v_cc->>'n_nao_reconhecido');
  end if;

  -- @@secao P
  -- ══ P. O QUE NUNCA E PRECO (12/09/2026) ════════════════════════════════════
  -- A primeira lista real. `calc_preco` pega o ULTIMO numero entre 20 e 200000 da
  -- linha, e porcentagem, horario e prazo passavam. Migration:
  -- supabase/migrations/20260912_calc_preco_nao_le_porcentagem.sql.

  -- P1. As tres armadilhas medidas na lista devolvem nulo.
  v_total := v_total + 1;
  if privado.calc_preco('🔋94% à 100%') is not null or privado.calc_preco('🔋100%') is not null then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [P1] a saude da bateria virou preco: 94% a 100% = '
             || coalesce(privado.calc_preco('🔋94% à 100%')::text,'null');
  end if;
  v_total := v_total + 1;
  if privado.calc_preco('ATENÇÃO 7:52:23 PM') is not null then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [P1] o horario da mensagem virou preco: ' || privado.calc_preco('ATENÇÃO 7:52:23 PM');
  end if;
  v_total := v_total + 1;
  if privado.calc_preco('📌 GARANTIA 30 DIAS') is not null or privado.calc_preco('garantia de 1 ano') is not null then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [P1] o prazo de garantia virou preco';
  end if;

  -- P2. E o conserto nao pode apagar o preco que divide a linha com uma
  --     porcentagem. Guarda nova se mede contra o que ja funcionava.
  v_total := v_total + 1;
  if privado.calc_preco('iPhone 13 128GB Seminovo 87% - 2.700') is distinct from 2700
     or privado.calc_preco('iPhone 16 128GB Preto Lacrado - 4.299 10% off') is distinct from 4299 then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [P2] a porcentagem apagou o preco da mesma linha: '
             || coalesce(privado.calc_preco('iPhone 13 128GB Seminovo 87% - 2.700')::text,'null') || ' / '
             || coalesce(privado.calc_preco('iPhone 16 128GB Preto Lacrado - 4.299 10% off')::text,'null');
  end if;

  -- P3. A fixture G inteira: as duas linhas `R$` entram, e so elas.
  v_total := v_total + 1;
  if (v_gg->>'n_lidas')::int <> 2 or (v_gg->>'n_casou')::int <> 2 or (v_gg->>'n_duvidoso')::int <> 0 then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [P3] fixture G: lidas ' || (v_gg->>'n_lidas') || ' casou ' || (v_gg->>'n_casou')
             || ' duvidoso ' || (v_gg->>'n_duvidoso') || ' (esperado 2, 2, 0: a bateria e a garantia contaram como linha de preco)';
  end if;

  -- P4. Nenhum preco da fixture G abaixo de R$ 500. E a assercao que teria
  --     pegado a lista real: 35 de 35 produtos entre 90 e 100.
  v_total := v_total + 1;
  if exists (select 1 from jsonb_array_elements(v_gg->'produtos') p
               left join lateral jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) c on true
              where coalesce((c->>'v')::numeric, (p->>'v')::numeric) < 500) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [P4] fixture G tem preco abaixo de R$ 500 (a bateria voltou a ser lida como preco): '
             || (v_gg->'produtos')::text;
  end if;

  -- P5. O preco CERTO em cada produto e cor: sem isso P4 passaria com o preco
  --     de outro produto no lugar.
  v_total := v_total + 1;
  if not exists (select 1 from jsonb_array_elements(v_gg->'produtos') p, jsonb_array_elements(p->'cs') c
                  where p->>'n' = 'iPhone 16 128GB' and c->>'n' = 'Preto' and (c->>'v')::numeric = 3111.11)
     or not exists (select 1 from jsonb_array_elements(v_gg->'produtos') p, jsonb_array_elements(p->'cs') c
                  where p->>'n' = 'iPhone 16 128GB' and c->>'n' = 'Branco' and (c->>'v')::numeric = 3111.11)
     or not exists (select 1 from jsonb_array_elements(v_gg->'produtos') p, jsonb_array_elements(p->'cs') c
                  where p->>'n' = 'iPhone 15 128GB' and c->>'n' = 'Preto' and (c->>'v')::numeric = 2222.22) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [P5] fixture G nao deu 16 128GB Preto/Branco 3111.11 e 15 128GB Preto 2222.22: '
             || (v_gg->'produtos')::text;
  end if;

  -- @@relatorio
  -- Cada linha de sumario pertence a UM arquivo gerado, pelo marcador acima
  -- dela. Juntas, as tres dizem o que este relatorio diz.
  raise exception E'%',
    case when v_falhas = 0
         then 'PASSOU: ' || v_total || ' assercoes, 0 falhas (prova_calc_leitor)'
  -- @@relatorio leitor
              || E'\n  fixture A (formato linha), v2: lidas=' || (v_r->>'n_lidas')
              || ' casou=' || (v_r->>'n_casou')
              || ' duvidoso=' || (v_r->>'n_duvidoso')
              || ' nao_reconhecido=' || (v_r->>'n_nao_reconhecido')
              || ' descarte=' || (v_r->>'n_descarte')
              || ' cobertura=' || (v_r->>'cobertura') || '%'
              || E'\n  fixture B (formato bloco), v2: lidas=' || (v_b->>'n_lidas')
              || ' casou=' || (v_b->>'n_casou')
              || ' duvidoso=' || (v_b->>'n_duvidoso')
              || ' nao_reconhecido=' || (v_b->>'n_nao_reconhecido')
              || ' cobertura=' || (v_b->>'cobertura') || '%'
              || E'\n  fixture B (formato bloco), v1: casou=' || (v_b1->>'n_casou')
              || ' de ' || (v_b1->>'n_lidas') || ' (o v1 nao le bloco, por desenho)'
              || E'\n  fixture C (dia 1), v2: lidas=' || (v_cc->>'n_lidas')
              || ' casou=' || (v_cc->>'n_casou')
              || ' pendencias=' || (select string_agg(q->>'tipo' || ' "' || (q->>'texto') || '"', ', ')
                                      from jsonb_array_elements(v_cc->'pendencias') q)
              || E'\n  fixture G (bateria da MP), v2: lidas=' || (v_gg->>'n_lidas')
              || ' casou=' || (v_gg->>'n_casou')
              || ' menor preco=' || coalesce((select min(coalesce((c->>'v')::numeric, (p->>'v')::numeric))::text
                                                from jsonb_array_elements(v_gg->'produtos') p
                                                left join lateral jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) c on true), '?')
  -- @@relatorio fim
         else 'REPROVOU: ' || v_falhas || ' de ' || v_total || ' assercoes falharam (prova_calc_leitor)' || v_log
    end;
end;
$prova$;
