-- prova_calc_parse.sql — assere o motor de leitura de lista de fornecedor.
--
-- COBRE O PARSER VIVO (10/09/2026):
--   `privado.calc_parse_v2`  — promovido a caminho vivo neste mesmo dia:
--                              `calc_carga_abrir` chama ELE agora
--                              (supabase/migrations/20260910_calc_carga_abrir_promove_v2.sql).
-- O v1 (`privado.calc_parse`) SAIU do laco de versoes e o bloco `-- v1` da
-- secao D foi apagado, exatamente como o cabecalho anterior mandava fazer no
-- dia da promocao.
--
-- ATENCAO, e isto e divida declarada: o v1 continua EXISTINDO no banco, sem
-- chamador e agora quase sem prova. A UNICA assercao que ainda o executa e a
-- B0, que so cobra que ele casa 0 no formato bloco. Ele nao e rede de seguranca
-- de nada: o portao do Bloco 2 (D7) compara a tela contra o caminho MANUAL da
-- skill, nunca contra o v1. Codigo sem consumidor e sem prova e o que este
-- projeto ja pagou caro para aprender: DERRUBAR o v1 assim que o portao do
-- Bloco 2 fechar.
--
-- Os helpers (`calc_limpar`, `calc_norm`, `calc_tokens`, `calc_preco`) seguem
-- compartilhados, mas agora o caminho vivo e o v2, e e ele que esta provado.
--
-- DESDE 11/09/2026 COBRE TAMBEM O LACO DE APRENDIZADO (secoes F e G), com as
-- MESMAS fixtures, de proposito: duas copias de fixture ja divergiram uma vez
-- neste projeto e a prova reprovou por defeito dela, nao do motor.
--   F — conservacao de linhas: toda linha lida esta em alguma pilha.
--   G — `calc_pendencia_resolver` CHAMADA de verdade, com a identidade do dono
--       (`request.jwt.claims` + `set local role authenticated`), cada decisao
--       numa subtransacao. Ate 11/09 a RPC so tinha sido provada na estrutura.
--       Migration: supabase/migrations/20260911_calc_resolver_nada_calado.sql.
--   Z — o `2.4a zero` (11/09/2026): o cabecalho desconhecido chega a pendencia,
--       e a regra da condicao do dono (D14 revisada e D15), na fixture D.
--       Migration: supabase/migrations/20260911_calc_parse_condicao_e_cabecalho.sql.
--   R — as respostas de condicao (D14, 11/09/2026): o verbo `definir`, o leitor
--       recebendo o mapa `texto -> condicao`, e a resposta sobrevivendo a cada
--       releitura. E a D16 nomeada: `descartar` fornecedor tira o bloco inteiro.
--       Migration: supabase/migrations/20260911_calc_parse_respostas_de_condicao.sql.
--
-- COMO RODAR: cole no SQL Editor do Supabase, ou por MCP.
-- O bloco TERMINA EM `raise exception` de proposito: a transacao inteira volta
-- e nada e gravado em producao. Sucesso = a excecao final dizer PASSOU.
-- **O resultado e a MENSAGEM, nunca o exit code** (ao contrario dos onze
-- comandos de suite do CLAUDE.md, onde vale o exit code).
--
-- AS DUAS FIXTURES, e elas cobrem coisas diferentes:
--   A — "formato linha": modelo, capacidade, cor, condicao e preco na MESMA
--       linha. E o unico formato que o v1 sabe ler.
--   B — "formato BLOCO": modelo no cabecalho, condicao num banner, e o preco
--       numa linha que nao repete o nome do produto. E como as listas reais de
--       WhatsApp sao escritas, e a razao de o v2 existir: medido aqui, o v1
--       casa **0 de 12** na fixture B.
--
-- As duas listas sao SINTETICAS, escritas a mao para o teste. Restricao global 8
-- do plano: nenhum export de fornecedor entra no repo, nem como corpus de teste.
-- Os nomes de modelo, cor e fornecedor sao do catalogo do proprio tenant; os
-- PRECOS sao inventados e nao correspondem a tabela de ninguem.
--
-- ── O DEFEITO QUE ESTA PROVA ACHOU AO SER ESCRITA (10/09/2026) ─────────────────
-- O handoff v6 dava os tres formatos de cor como cobertos. Ao medir, o layout
-- "cor ANTES do preco" ALTERNADO (cor, preco, cor, preco) devolvia preco ERRADO:
--
--     🟣 Roxo / 💵 4.480 / 🟡 Gold / 💵 4.520
--     -> Roxo = 4480 (certo), Gold = 4480 (ERRADO), e o 4.520 virava orfa.
--
-- Causa: `cor_assoc` escolhia o preco nu com `order by abs(p.ln - cs.cor_ln),
-- p.ln`. Uma cor entre dois precos empata em distancia com os dois, e o `p.ln`
-- desempatava para CIMA, ou seja, para o preco que ja era da cor anterior. No
-- layout "cor DEPOIS do preco" o mesmo desempate acerta, e metade dos casos dar
-- certo foi o que segurou o defeito no ar.
--
-- Classe PRECO ERRADO (handoff v6, secao 4): a cobertura NAO cai, nenhuma
-- pendencia nasce, o produto aparece na tela com cara de certo. Nada denuncia.
-- Consertado em `supabase/migrations/20260910_calc_parse_cor_pareada.sql`, e a
-- assercao B3 abaixo e o que impede a volta.

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
begin
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

  -- ══ FIXTURE D — a regra da condicao (D14 revisada e D15, 11/09/2026) ════════
  -- Um fornecedor por regra. No v2 anterior esta lista casava os MESMOS 11 de 16
  -- de agora, mas com TRES precos errados calados (o misto do Cristiano e a
  -- linha da Raposa entravam como Lacrado) e as cinco linhas sem condicao numa
  -- pergunta so, Rafael e Dg misturados. A contagem nao denuncia: so o conteudo.
  v_txd :=
  -- regra 2: a condicao da LINHA passa para as de baixo, ate aparecer outra
     E'[11/09/2026, 09:00:00] Vini: Junior recreio\n'
  || E'iPhone 16 128GB Preto Lacrado - 4.299\n'
  || E'iPhone 16 256GB Preto - 4.899\n'
  || E'iPhone 14 128GB Azul Seminovo - 2.700\n'
  || E'iPhone 13 128GB Preto - 2.100\n\n'
  -- regra 2, decisao B do dono: `lacrado` dentro da secao SEMINOVOS vale para baixo
  || E'[11/09/2026, 09:05:00] Vini: ATACADO BR10\n'
  || E'SEMINOVOS\n'
  || E'iPhone 12 128GB Preto - 2.150\n'
  || E'iPhone 15 128GB Azul lacrado - 3.900\n'
  || E'iPhone 15 256GB Azul - 4.300\n\n'
  -- regra 3: titulo misto, sem heranca; so entra quem diz a propria condicao
  || E'[11/09/2026, 09:10:00] Vini: Cristiano\n'
  || E'LACRADOS E SEMINOVOS\n'
  || E'iPhone 16 Pro 256GB Preto Lacrado - 6.000\n'
  || E'iPhone 14 Pro 256GB Preto - 3.800\n'
  || E'iPhone 13 256GB Preto seminovo - 2.300\n'
  || E'iPhone 13 128GB Azul - 2.000\n\n'
  -- regra 5: duas condicoes que nao combinam na mesma linha
  || E'[11/09/2026, 09:15:00] Vini: ATACADO E REVENDA DA RAPOSA\n'
  || E'iPhone 15 128GB Preto seminovo, era lacrado - 3.000\n\n'
  -- regras 4 e 6: dois fornecedores sem condicao, DUAS perguntas, e a linha
  -- ambigua da Raposa logo acima NAO passa para eles
  || E'[11/09/2026, 09:20:00] Vini: Raphael barra da Tijuca\n'
  || E'iPhone 16 128GB Preto - 4.100\n\n'
  || E'[11/09/2026, 09:25:00] Vini: Dg JPA\n'
  || E'iPhone 16 128GB Azul - 4.150\n\n'
  -- regra 2 no formato bloco: o `(CPO)` do 1o cabecalho passa ao bloco seguinte
  || E'[11/09/2026, 09:30:00] Vini: Fábio Fmata\n'
  || E'*🍎 iPhone 13 Pro – 128GB (CPO)*\n'
  || E'💵 *R$ 3.150,00*\n\n'
  || E'*🍎 iPhone 14 Pro – 256GB*\n'
  || E'💵 *R$ 4.480,00*\n';

  v_b  := privado.calc_parse_v2(v_tenant, v_txb);
  v_b1 := privado.calc_parse(v_tenant, v_txb);
  v_cc := privado.calc_parse_v2(v_tenant, v_txc);
  v_dd := privado.calc_parse_v2(v_tenant, v_txd);

  -- Cada bloco abaixo soma 1 em v_total e, se falhar, soma 1 em v_falhas e
  -- anota o motivo. O relatorio sai inteiro, nao para no primeiro erro: parar
  -- no primeiro esconde os outros e custa uma rodada por defeito.

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
  v_total := v_total + 1;
  if (select count(distinct case when prosrc like '%calc_parse_v2%'
                                 then 'v2' else 'v1' end)
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prosrc like '%calc_parse%') <> 1 then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'
  FALHA  [chamadores] as RPCs de public nao chamam todas a MESMA versao do parser'
             || E' (promocao pela metade: a cobertura muda sozinha entre abrir e resolver)'
             || E'
         ' || (
               select string_agg(p.proname || '=' ||
                      case when p.prosrc like '%calc_parse_v2%' then 'v2' else 'v1' end, ', '
                      order by p.proname)
                 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public' and p.prosrc like '%calc_parse%');
  end if;

  -- E2. E os dois chamadores que existem hoje estao nomeados, para a assercao
  --     acima nao passar verde por nao encontrar ninguem.
  v_total := v_total + 1;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prosrc like '%calc_parse%'
         and p.proname in ('calc_carga_abrir','calc_pendencia_resolver')) <> 2 then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'
  FALHA  [chamadores] sumiu um dos dois consumidores conhecidos do parser';
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

  -- ══ G. O RESOLVER, CHAMADO DE VERDADE ══════════════════════════════════════
  -- A regra desta secao, e ela e a frase da spec de 10/09 em forma de teste:
  -- **toda resposta do dono ou ENSINA ou e RECUSADA com motivo. Nunca e aceita
  -- calada.** Medido em 11/09/2026, ANTES da migration: das 21 combinacoes
  -- pendencia x decisao das tres fixtures, 4 ensinavam e as outras eram aceitas,
  -- gravavam no catalogo e nao mudavam a leitura (e uma delas fazia linha
  -- evaporar). As assercoes abaixo nao listam quais combinacoes falham: cobram a
  -- regra. Se o leitor aprender a ler cor decorada amanha, elas passam sozinhas.
  --
  -- Tudo roda com a identidade do DONO, como a tela vai rodar. Cada decisao fica
  -- numa subtransacao (`begin ... exception`), entao uma nao contamina a outra,
  -- e o `raise` final desfaz as tres cargas junto com o resto.
  perform set_config('request.jwt.claims',
    '{"sub":"fb2aad8e-b728-4e59-a198-71da2156449d","role":"authenticated"}', true);

  -- Um modelo que so existe na SEMENTE. Pela D5 a semente e invisivel em
  -- execucao, entao apontar para ele tem que reprovar como se nao existisse.
  insert into public.calc_modelo (tenant_id, codigo, nome, categoria)
  values (null, 'so_na_semente_prova', 'Modelo de Prova 999GB', 'iPhone');

  v_fxs := array[v_txt, v_txb, v_txc];
  for v_i in 1..3 loop
    execute 'set local role authenticated';
    v_cargas := v_cargas || public.calc_carga_abrir(v_fxs[v_i]);
    execute 'reset role';
  end loop;

  -- A matriz: cada pendencia de cada carga, contra tres respostas.
  for v_i in 1..3 loop
    for v_pd in select * from public.calc_pendencia
                 where carga_id = v_cargas[v_i] order by tipo, texto loop
      foreach v_dec in array array['apontar_valido','apontar_inexistente','descartar'] loop
        v_dest := case when v_dec = 'descartar' then null
                       when v_dec = 'apontar_inexistente' then 'nao_existe_prova'
                       else case v_pd.tipo when 'modelo' then 'iphone_13_128gb'
                                           when 'cor' then 'verde'
                                           when 'fornecedor' then 'five_cell'
                                           when 'condicao' then 'CPO' end end;
        select n_casou into v_casou0 from public.calc_carga where id = v_cargas[v_i];
        begin
          execute 'set local role authenticated';
          v_res := public.calc_pendencia_resolver(v_pd.id,
                     case when v_dec = 'descartar' then 'descartar' else 'apontar' end, v_dest);
          execute 'reset role';
          -- ACEITA. Agora ela tem que ter ensinado, sem perder nada.
          v_n_aceitas := v_n_aceitas + 1;
          v_aceitas := v_aceitas || v_pd.tipo || ':' || v_pd.texto || '/' || v_dec || '; ';
          v_depois := privado.calc_parse_v2(v_tenant, v_fxs[v_i]);
          if exists (select 1 from jsonb_array_elements(v_depois->'pendencias') q
                      where q->>'tipo' = v_pd.tipo and q->>'texto' = v_pd.texto) then
            v_sem_ensinar := v_sem_ensinar || E'\n         ' || v_pd.tipo || ' "' || v_pd.texto || '" / ' || v_dec;
          end if;
          if v_dec = 'apontar_inexistente' then
            v_inexist := v_inexist || E'\n         ' || v_pd.tipo || ' "' || v_pd.texto || '"';
          end if;
          if (v_depois->>'n_lidas')::int is distinct from
             (v_depois->>'n_casou')::int + (v_depois->>'n_duvidoso')::int
               + (v_depois->>'n_nao_reconhecido')::int then
            v_perdeu := v_perdeu || E'\n         ' || v_pd.tipo || ' "' || v_pd.texto || '" / ' || v_dec;
          end if;
          if (v_res->>'n_casou')::int < v_casou0 then
            v_caiu := v_caiu || E'\n         ' || v_pd.tipo || ' "' || v_pd.texto || '" / ' || v_dec
                      || ': ' || v_casou0 || ' -> ' || (v_res->>'n_casou');
          end if;
          raise exception 'prova_rollback';
        exception when others then
          if sqlerrm <> 'prova_rollback' then
            v_n_recusas := v_n_recusas + 1;
            -- Recusa so vale se for por motivo DECLARADO. Um erro qualquer
            -- (null, cast, divisao) tambem "recusa", e passaria por guarda.
            if sqlerrm !~ '(nao existe no catalogo|nao ensina nada|condicao nao se ensina|apontar exige o destino|nao se ensina por apelido|condicao nao se descarta)' then
              v_estranha := v_estranha || E'\n         ' || v_pd.tipo || ' "' || v_pd.texto || '" / ' || v_dec || ': ' || sqlerrm;
            end if;
          end if;
        end;
      end loop;
    end loop;
  end loop;

  -- G1. Apelido para codigo INEXISTENTE reprova. E a prova 1 da secao 7 da
  --     spec de 10/09, e o primeiro buraco a fechar.
  v_total := v_total + 1;
  if v_inexist <> '' then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [resolver] apontar para codigo inexistente foi ACEITO:' || v_inexist;
  end if;

  -- G2. Resposta aceita tem que ter ensinado: a mesma pendencia nao volta.
  v_total := v_total + 1;
  if v_sem_ensinar <> '' then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [resolver] resposta ACEITA que nao ensinou (a pendencia volta ao reler):' || v_sem_ensinar;
  end if;

  -- G3. Resposta aceita nao pode tirar linha de todas as pilhas.
  v_total := v_total + 1;
  if v_perdeu <> '' then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [resolver] resposta aceita fez o leitor PERDER linhas:' || v_perdeu;
  end if;

  -- G4. Resposta aceita nunca derruba a cobertura. Ela pode SUBIR (e o ponto do
  --     laco) e pode ficar igual (descarte tira de `lidas`, nao de `casou`).
  v_total := v_total + 1;
  if v_caiu <> '' then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [resolver] resposta aceita DERRUBOU n_casou:' || v_caiu;
  end if;

  -- G5. Toda recusa e por motivo declarado, nunca por erro qualquer.
  v_total := v_total + 1;
  if v_estranha <> '' then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [resolver] recusa por erro NAO declarado (defeito, nao guarda):' || v_estranha;
  end if;

  -- G6. O QUE ENSINAVA CONTINUA ENSINANDO. As guardas nao podem ter fechado a
  --     porta que funcionava: as quatro combinacoes que ensinavam antes da
  --     migration seguem aceitas.
  v_total := v_total + 1;
  if position('modelo:poco f8 pro 256gb preto lacrado/apontar_valido;' in v_aceitas) = 0
     or position('modelo:poco f8 pro 256gb preto lacrado/descartar;' in v_aceitas) = 0
     or position('cor:verde menta/descartar;' in v_aceitas) = 0
     or v_aceitas !~ 'modelo:[^;]*Zeta[^;]*/apontar_valido;' then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [resolver] uma resposta que ENSINAVA passou a ser recusada. Aceitas: ' || v_aceitas;
  end if;

  select id into v_poco from public.calc_pendencia
   where carga_id = v_cargas[1] and tipo = 'modelo' and texto like 'poco f8%';
  select id into v_cond from public.calc_pendencia
   where carga_id = v_cargas[3] and tipo = 'condicao';

  -- G7. D5: modelo que so existe na SEMENTE conta como inexistente.
  v_total := v_total + 1;
  v_msg := null;
  begin
    execute 'set local role authenticated';
    perform public.calc_pendencia_resolver(v_poco, 'apontar', 'so_na_semente_prova');
    raise exception 'prova_rollback';
  exception when others then v_msg := sqlerrm;
  end;
  if coalesce(v_msg,'') !~ 'nao existe no catalogo' then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [resolver] apontar para modelo que so existe na SEMENTE nao reprovou (D5). Obtido: ' || coalesce(v_msg,'(nada)');
  end if;

  -- G8. Condicao nao se ensina por apelido: o leitor nao le apelido de
  --     condicao (medido: nem o v1 nem o v2 consultam `calc_alias` com esse
  --     tipo). Aceitar seria gravar dado morto.
  v_total := v_total + 1;
  v_msg := null;
  begin
    execute 'set local role authenticated';
    perform public.calc_pendencia_resolver(v_cond, 'apontar', 'CPO');
    raise exception 'prova_rollback';
  exception when others then v_msg := sqlerrm;
  end;
  if coalesce(v_msg,'') !~ 'condicao nao se ensina' then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [resolver] apontar condicao nao foi recusado pela trava T1. Obtido: ' || coalesce(v_msg,'(nada)');
  end if;

  -- G9. Pendencia ja respondida nao se responde de novo (T2): o segundo
  --     `descartar` duplicava a regra; o segundo `apontar` estourava a unique.
  v_total := v_total + 1;
  v_msg := null;
  begin
    execute 'set local role authenticated';
    perform public.calc_pendencia_resolver(v_poco, 'apontar', 'iphone_13_128gb');
    perform public.calc_pendencia_resolver(v_poco, 'descartar', null);
    raise exception 'prova_rollback';
  exception when others then v_msg := sqlerrm;
  end;
  if coalesce(v_msg,'') !~ 'ja foi respondida' then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [resolver] a mesma pendencia foi respondida duas vezes (T2). Obtido: ' || coalesce(v_msg,'(nada)');
  end if;

  -- G10. Fora de rascunho nao se ensina (T3): sem a lista nao ha como provar
  --      que a resposta ensina. E `ignorar` segue aceito, sem reprocessar.
  v_total := v_total + 1;
  v_msg := null;
  begin
    execute 'reset role';
    update public.calc_carga set status = 'descartada', texto_bruto = null where id = v_cargas[1];
    execute 'set local role authenticated';
    perform public.calc_pendencia_resolver(v_poco, 'apontar', 'iphone_13_128gb');
    raise exception 'prova_rollback';
  exception when others then v_msg := sqlerrm;
  end;
  v_res := null;
  begin
    execute 'reset role';
    update public.calc_carga set status = 'descartada', texto_bruto = null where id = v_cargas[1];
    execute 'set local role authenticated';
    v_res := public.calc_pendencia_resolver(v_poco, 'ignorar', null);
    raise exception 'prova_rollback';
  exception when others then null;
  end;
  if coalesce(v_msg,'') !~ 'nao esta mais em rascunho'
     or coalesce((v_res->>'reprocessou')::boolean, true) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [resolver] carga fora de rascunho: apontar nao reprovou, ou ignorar nao foi aceito sem reprocessar (T3). Obtido: '
             || coalesce(v_msg,'(nada)') || ' / ignorar=' || coalesce(v_res::text,'(nada)');
  end if;

  -- G11. A conservacao vale tambem ao ABRIR. O apelido orfao aqui e plantado
  --      direto na tabela, que e exatamente o formato do defeito medido: a
  --      linha do Poco casa com um codigo que nao existe e evapora. Abrir tem
  --      que recusar, nao gravar carga com linha a menos.
  v_total := v_total + 1;
  v_msg := null;
  begin
    execute 'reset role';
    insert into public.calc_alias (tenant_id, tipo, texto, aponta)
    values (v_tenant, 'modelo', 'poco f8 pro 256gb preto lacrado', 'nao_existe_prova');
    execute 'set local role authenticated';
    perform public.calc_carga_abrir(v_txt);
    raise exception 'prova_rollback';
  exception when others then v_msg := sqlerrm;
  end;
  if coalesce(v_msg,'') !~ 'perdeu linhas' then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [abrir] o leitor perdeu linha e calc_carga_abrir gravou a carga mesmo assim (G2). Obtido: ' || coalesce(v_msg,'(nada)');
  end if;
  execute 'reset role';

  -- ══ Z. O `2.4a zero`: o cabecalho chega a pendencia, e a regra da condicao ══
  -- Z1. Lista que ABRE com fornecedor fora do catalogo: a pendencia nomeia o
  --     cabecalho, nao a sentinela. Sem isto o `criar` fornecedor nao tinha o
  --     que criar, e no dia 1 de um cliente todo fornecedor e desconhecido.
  v_total := v_total + 1;
  if not exists (select 1 from jsonb_array_elements(v_cc->'pendencias') q
                  where q->>'tipo' = 'fornecedor' and q->>'texto' = 'TABELA XPTO IMPORTS')
     or exists (select 1 from jsonb_array_elements(v_cc->'pendencias') q
                  where q->>'texto' in ('(sem cabecalho antes da lista)', 'sem condicao declarada')) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [2.4a zero] fixture C: a pendencia nao nomeia o cabecalho TABELA XPTO IMPORTS, ou uma sentinela voltou: '
             || coalesce((select string_agg(q->>'tipo' || ' "' || (q->>'texto') || '"', ', ')
                            from jsonb_array_elements(v_cc->'pendencias') q), '(nenhuma)');
  end if;

  -- Z2. E agora ENSINAR esse fornecedor funciona: na matriz da secao G,
  --     apontar o cabecalho para um fornecedor existente foi aceito e a pendencia
  --     sumiu. Antes do `2.4a zero` a mesma resposta era recusada pela G3 da
  --     migration (a sentinela voltava). E o caminho que o `criar` vai usar.
  v_total := v_total + 1;
  if position('fornecedor:TABELA XPTO IMPORTS/apontar_valido;' in v_aceitas) = 0 then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [2.4a zero] apontar o cabecalho desconhecido para um fornecedor nao ensinou. Aceitas: ' || v_aceitas;
  end if;

  -- Z3. Regra 2: a condicao escrita na LINHA passa para as de baixo, ate outra.
  v_total := v_total + 1;
  if not exists (select 1 from jsonb_array_elements(v_dd->'produtos') p
                   left join lateral jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) c on true
                  where p->>'n' = 'iPhone 16 256GB' and p->>'t' = 'Lacrado'
                    and coalesce((c->>'v')::numeric, (p->>'v')::numeric) = 4899)
     or not exists (select 1 from jsonb_array_elements(v_dd->'produtos') p
                   left join lateral jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) c on true
                  where p->>'n' = 'iPhone 13 128GB' and p->>'t' = 'Seminovo'
                    and coalesce((c->>'v')::numeric, (p->>'v')::numeric) = 2100) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [D15] a condicao da linha nao passou para as de baixo (Junior: 16 256GB Lacrado 4899 / 13 128GB Seminovo 2100)';
  end if;

  -- Z4. Regra 2, decisao B do dono: `lacrado` escrito dentro da secao SEMINOVOS
  --     vale para a linha de baixo. E o banner segue valendo antes dele.
  v_total := v_total + 1;
  if not exists (select 1 from jsonb_array_elements(v_dd->'produtos') p
                   left join lateral jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) c on true
                  where p->>'n' = 'iPhone 15 256GB' and p->>'t' = 'Lacrado'
                    and coalesce((c->>'v')::numeric, (p->>'v')::numeric) = 4300)
     or not exists (select 1 from jsonb_array_elements(v_dd->'produtos') p
                   left join lateral jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) c on true
                  where p->>'n' = 'iPhone 12 128GB' and p->>'t' = 'Seminovo'
                    and coalesce((c->>'v')::numeric, (p->>'v')::numeric) = 2150) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [D15] decisao B: dentro de SEMINOVOS, a linha abaixo de `lacrado` nao virou Lacrado (15 256GB 4300), ou o banner parou de valer (12 128GB Seminovo 2150)';
  end if;

  -- Z5. Regra 2 no formato bloco: o `(CPO)` do 1o cabecalho passa ao bloco
  --     seguinte, que nao declara nada.
  v_total := v_total + 1;
  if not exists (select 1 from jsonb_array_elements(v_dd->'produtos') p
                  where p->>'n' = 'iPhone 14 Pro 256GB' and p->>'t' = 'CPO'
                    and (p->>'v')::numeric = 4480) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [D15] o (CPO) do 1o cabecalho de bloco nao passou ao bloco seguinte (14 Pro 256GB CPO 4480)';
  end if;

  -- Z6. Regra 3: titulo misto. Quem diz a propria condicao entra; quem nao diz
  --     vira pergunta, uma por linha. No v2 anterior as duas de baixo entravam
  --     como Lacrado, caladas, e o seminovo virava o menor custo de lacrado.
  v_total := v_total + 1;
  if not exists (select 1 from jsonb_array_elements(v_dd->'produtos') p
                   left join lateral jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) c on true
                  where p->>'n' = 'iPhone 16 Pro 256GB' and p->>'t' = 'Lacrado'
                    and coalesce((c->>'v')::numeric, (p->>'v')::numeric) = 6000)
     or not exists (select 1 from jsonb_array_elements(v_dd->'produtos') p
                   left join lateral jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) c on true
                  where p->>'n' = 'iPhone 13 256GB' and p->>'t' = 'Seminovo'
                    and coalesce((c->>'v')::numeric, (p->>'v')::numeric) = 2300)
     or exists (select 1 from jsonb_array_elements(v_dd->'produtos') p
                   left join lateral jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) c on true
                  where coalesce((c->>'v')::numeric, (p->>'v')::numeric) in (3800, 2000))
     or (select count(*) from jsonb_array_elements(v_dd->'pendencias') q
          where q->>'tipo' = 'condicao' and q->>'causa' like 'A condicao declarada acima e mista%') <> 2 then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [D15] titulo misto: esperado 16 Pro Lacrado 6000 e 13 256GB Seminovo 2300 no blob, 3800 e 2000 FORA, e 2 perguntas por linha. Pendencias: '
             || coalesce((select string_agg(q->>'tipo' || ' "' || (q->>'texto') || '"', ', ')
                            from jsonb_array_elements(v_dd->'pendencias') q), '(nenhuma)');
  end if;

  -- Z7. Regra 5: `seminovo, era lacrado` e pergunta, nao Lacrado calado.
  v_total := v_total + 1;
  if exists (select 1 from jsonb_array_elements(v_dd->'produtos') p
                left join lateral jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) c on true
               where coalesce((c->>'v')::numeric, (p->>'v')::numeric) = 3000)
     or (select count(*) from jsonb_array_elements(v_dd->'pendencias') q
          where q->>'tipo' = 'condicao' and q->>'causa' like 'A linha traz duas condicoes%') <> 1 then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [D15] a linha com duas condicoes que nao combinam entrou no blob ou nao virou UMA pergunta';
  end if;

  -- Z8. Regras 4 e 6: dois fornecedores sem condicao sao DUAS perguntas, uma por
  --     fornecedor, pelo `codigo`. E a linha ambigua da Raposa, logo acima, nao
  --     passa para eles. No v2 anterior era UMA pergunta para a carga inteira.
  v_total := v_total + 1;
  if not exists (select 1 from jsonb_array_elements(v_dd->'pendencias') q
                  where q->>'tipo' = 'condicao' and q->>'texto' = 'rafael' and (q->>'n_linhas')::int = 1)
     or not exists (select 1 from jsonb_array_elements(v_dd->'pendencias') q
                  where q->>'tipo' = 'condicao' and q->>'texto' = 'dg_jacarepagua' and (q->>'n_linhas')::int = 1) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [D14] a pergunta de condicao nao saiu uma por fornecedor (rafael, dg_jacarepagua). Pendencias: '
             || coalesce((select string_agg(q->>'tipo' || ' "' || (q->>'texto') || '" x' || (q->>'n_linhas'), ', ')
                            from jsonb_array_elements(v_dd->'pendencias') q), '(nenhuma)');
  end if;

  -- Z9. O teto da fixture D, e a conservacao. 16 linhas; entram 11 (Junior 4,
  --     BR10 3, Cristiano 2, Fmata 2); 5 viram pergunta. O numero e o MESMO do
  --     v2 anterior, e por isso ele sozinho nao prova nada: Z3 a Z8 provam o
  --     conteudo, este cobra que nada sumiu nem sobrou.
  v_total := v_total + 1;
  if (v_dd->>'n_lidas')::int <> 16 or (v_dd->>'n_casou')::int <> 11
     or (v_dd->>'n_lidas')::int is distinct from
        (v_dd->>'n_casou')::int + (v_dd->>'n_duvidoso')::int + (v_dd->>'n_nao_reconhecido')::int then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [D15] fixture D: casou ' || (v_dd->>'n_casou') || ' de ' || (v_dd->>'n_lidas')
             || ' (esperado 11 de 16), duvidoso ' || (v_dd->>'n_duvidoso')
             || ', nao reconhecido ' || (v_dd->>'n_nao_reconhecido');
  end if;

  -- ══ R. AS RESPOSTAS DE CONDICAO (D14 revisada), 11/09/2026 ═══════════════════
  -- A pergunta de condicao ganhou resposta: `definir`. Ela vale para UMA lista
  -- (nao escreve no catalogo), o leitor a recebe como mapa `texto -> condicao`,
  -- e o resolver passa TODAS as da carga a cada releitura, de qualquer resposta.
  -- Carga C (v_cargas[3]): `junior` sem condicao (2 linhas, pendencia v_cond) e o
  -- cabecalho desconhecido `TABELA XPTO IMPORTS` (2 linhas, pendencia v_fx).
  -- Cada caso numa subtransacao desfeita: um nao contamina o outro.
  select id into v_fx from public.calc_pendencia
   where carga_id = v_cargas[3] and tipo = 'fornecedor';
  select nome into v_jnome from public.calc_fornecedor
   where tenant_id = v_tenant and codigo = 'junior';

  -- R1. A resposta PEGA: `junior` = Lacrado poe as 2 linhas dele na tabela, com
  --     a condicao respondida e o preco da lista. Antes da resposta: 0 de 4.
  v_total := v_total + 1;
  v_msg := null; v_ok := null; v_res := null;
  begin
    execute 'set local role authenticated';
    v_res := public.calc_pendencia_resolver(v_cond, 'definir', 'Lacrado');
    execute 'reset role';
    select c.n_casou = 2 and (c.resumo->>'n_cond_respondida')::int = 2
           and exists (select 1 from jsonb_array_elements(c.blob_proposto->'produtos') p
                         left join lateral jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) x on true
                        where p->>'f' = v_jnome and p->>'n' = 'iPhone 16 128GB' and p->>'t' = 'Lacrado'
                          and coalesce((x->>'v')::numeric, (p->>'v')::numeric) = 4299),
           c.n_casou
      into v_ok, v_rc
      from public.calc_carga c where c.id = v_cargas[3];
    raise exception 'prova_rollback';
  exception when others then
    if sqlerrm <> 'prova_rollback' then v_msg := sqlerrm; end if;
  end;
  if not coalesce(v_ok, false) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [D14] definir "junior" = Lacrado nao pos as 2 linhas do Junior na tabela como Lacrado 4299 (esperado n_casou 2, n_cond_respondida 2). Obtido: '
             || coalesce(v_msg, v_res::text, '(nada)');
  end if;

  -- R2. A ARMADILHA DA FATIA: a resposta sobrevive a resposta SEGUINTE, de
  --     outro tipo. O resolver rele a lista inteira a cada resposta; se relesse
  --     so com a do momento, ensinar o fornecedor XPTO devolvia as linhas do
  --     Junior para duvidoso, caladas.
  v_total := v_total + 1;
  v_msg := null; v_ok := null; v_res := null;
  begin
    execute 'set local role authenticated';
    perform public.calc_pendencia_resolver(v_cond, 'definir', 'Lacrado');
    v_res := public.calc_pendencia_resolver(v_fx, 'apontar', 'five_cell');
    execute 'reset role';
    select (c.resumo->>'n_cond_respondida')::int = 2 and c.n_casou >= 2
      into v_ok
      from public.calc_carga c where c.id = v_cargas[3];
    raise exception 'prova_rollback';
  exception when others then
    if sqlerrm <> 'prova_rollback' then v_msg := sqlerrm; end if;
  end;
  if not coalesce(v_ok, false) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [D14] a resposta de condicao se PERDEU na releitura da resposta seguinte (apontar o fornecedor XPTO): esperado n_cond_respondida 2. Obtido: '
             || coalesce(v_msg, v_res::text, '(nada)');
  end if;

  -- R3. Trocar a resposta: Lacrado, depois Seminovo. Fica so a ultima, e nada
  --     de Lacrado sobra para o Junior nesse modelo.
  v_total := v_total + 1;
  v_msg := null; v_ok := null;
  begin
    execute 'set local role authenticated';
    perform public.calc_pendencia_resolver(v_cond, 'definir', 'Lacrado');
    perform public.calc_pendencia_resolver(v_cond, 'definir', 'Seminovo');
    execute 'reset role';
    select exists (select 1 from jsonb_array_elements(c.blob_proposto->'produtos') p
                    where p->>'f' = v_jnome and p->>'n' = 'iPhone 16 128GB' and p->>'t' = 'Seminovo')
           and not exists (select 1 from jsonb_array_elements(c.blob_proposto->'produtos') p
                    where p->>'f' = v_jnome and p->>'n' = 'iPhone 16 128GB' and p->>'t' = 'Lacrado')
           and (select q.aponta from public.calc_pendencia q where q.id = v_cond) = 'Seminovo'
      into v_ok
      from public.calc_carga c where c.id = v_cargas[3];
    raise exception 'prova_rollback';
  exception when others then
    if sqlerrm <> 'prova_rollback' then v_msg := sqlerrm; end if;
  end;
  if not coalesce(v_ok, false) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [D14] trocar a resposta (Lacrado -> Seminovo) nao deixou so a ultima no blob. Obtido: ' || coalesce(v_msg, '(nada)');
  end if;

  -- R4. `ignorar` depois de `definir` desfaz: as linhas voltam para fora.
  v_total := v_total + 1;
  v_msg := null; v_ok := null;
  begin
    execute 'set local role authenticated';
    perform public.calc_pendencia_resolver(v_cond, 'definir', 'Lacrado');
    perform public.calc_pendencia_resolver(v_cond, 'ignorar', null);
    execute 'reset role';
    select c.n_casou = 0 and (c.resumo->>'n_cond_respondida')::int = 0
           and (select q.decisao from public.calc_pendencia q where q.id = v_cond) = 'ignorar'
      into v_ok
      from public.calc_carga c where c.id = v_cargas[3];
    raise exception 'prova_rollback';
  exception when others then
    if sqlerrm <> 'prova_rollback' then v_msg := sqlerrm; end if;
  end;
  if not coalesce(v_ok, false) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [D14] ignorar depois de definir nao tirou as linhas do Junior da tabela (esperado n_casou 0). Obtido: ' || coalesce(v_msg, '(nada)');
  end if;

  -- R5. Condicao que o tenant nao tem e recusada, com a grafia exata: `lacrado`
  --     minusculo e vazio. E o valor que iria para o `t` do blob.
  v_total := v_total + 1;
  v_msg := null; v_sug := null;
  begin
    execute 'set local role authenticated';
    perform public.calc_pendencia_resolver(v_cond, 'definir', 'lacrado');
    raise exception 'prova_rollback';
  exception when others then v_msg := sqlerrm;
  end;
  begin
    execute 'set local role authenticated';
    perform public.calc_pendencia_resolver(v_cond, 'definir', null);
    raise exception 'prova_rollback';
  exception when others then v_sug := sqlerrm;
  end;
  if coalesce(v_msg,'') !~ 'nao existe neste tenant' or coalesce(v_sug,'') !~ 'nao existe neste tenant' then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [D14] definir com condicao inexistente nao foi recusado. lacrado: '
             || coalesce(v_msg,'(nada)') || ' / vazio: ' || coalesce(v_sug,'(nada)');
  end if;

  -- R6. `definir` so vale para pergunta de condicao.
  v_total := v_total + 1;
  v_msg := null;
  begin
    execute 'set local role authenticated';
    perform public.calc_pendencia_resolver(v_fx, 'definir', 'Lacrado');
    raise exception 'prova_rollback';
  exception when others then v_msg := sqlerrm;
  end;
  if coalesce(v_msg,'') !~ 'definir so vale para pergunta de condicao' then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [D14] definir numa pendencia de fornecedor nao foi recusado. Obtido: ' || coalesce(v_msg,'(nada)');
  end if;

  -- R7. Trava T4: condicao nao se descarta. Era recusado por ACASO; descartar
  --     `junior` gravaria regra de descarte com o nome do fornecedor.
  v_total := v_total + 1;
  v_msg := null;
  begin
    execute 'set local role authenticated';
    perform public.calc_pendencia_resolver(v_cond, 'descartar', null);
    raise exception 'prova_rollback';
  exception when others then v_msg := sqlerrm;
  end;
  if coalesce(v_msg,'') !~ 'condicao nao se descarta' then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [T4] descartar pergunta de condicao nao foi recusado pela trava. Obtido: ' || coalesce(v_msg,'(nada)');
  end if;

  -- R8. Fora de rascunho nao se define (T3): sem a lista, nao ha releitura.
  v_total := v_total + 1;
  v_msg := null;
  begin
    execute 'reset role';
    update public.calc_carga set status = 'descartada', texto_bruto = null where id = v_cargas[3];
    execute 'set local role authenticated';
    perform public.calc_pendencia_resolver(v_cond, 'definir', 'Lacrado');
    raise exception 'prova_rollback';
  exception when others then v_msg := sqlerrm;
  end;
  if coalesce(v_msg,'') !~ 'nao esta mais em rascunho' then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [T3] definir numa carga fora de rascunho nao foi recusado. Obtido: ' || coalesce(v_msg,'(nada)');
  end if;

  -- R9. A LISTA SEGUINTE PERGUNTA DE NOVO (D14: toda lista), e a resposta da
  --     anterior fica disponivel como SUGESTAO, lida da tabela, nunca aplicada.
  --     A consulta abaixo e a que a tela vai usar para pre-selecionar.
  v_total := v_total + 1;
  v_msg := null; v_ok := null; v_sug := null;
  begin
    execute 'set local role authenticated';
    perform public.calc_pendencia_resolver(v_cond, 'definir', 'Lacrado');
    v_nova := public.calc_carga_abrir(v_txc);
    execute 'reset role';
    select q.aponta into v_sug
      from public.calc_pendencia q
     where q.tenant_id = v_tenant and q.tipo = 'condicao' and q.texto = 'junior'
       and q.decisao = 'definir' and q.carga_id <> v_nova
     order by q.decidido_em desc limit 1;
    select c.n_casou = 0
           and exists (select 1 from public.calc_pendencia q
                        where q.carga_id = v_nova and q.tipo = 'condicao'
                          and q.texto = 'junior' and q.decisao is null)
      into v_ok
      from public.calc_carga c where c.id = v_nova;
    raise exception 'prova_rollback';
  exception when others then
    if sqlerrm <> 'prova_rollback' then v_msg := sqlerrm; end if;
  end;
  if not coalesce(v_ok, false) or v_sug is distinct from 'Lacrado' then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [D14] a lista seguinte nao perguntou de novo (a resposta foi aplicada sozinha), ou a sugestao nao voltou Lacrado. Sugestao: '
             || coalesce(v_sug,'(nada)') || '. Erro: ' || coalesce(v_msg,'(nenhum)');
  end if;

  -- R10. Linha mista: a pergunta e POR LINHA, entao uma resposta poe UMA linha.
  --      Cristiano, titulo `LACRADOS E SEMINOVOS`: o 14 Pro 256GB = Seminovo
  --      entra; o 13 128GB, que tambem nao disse, segue fora.
  v_total := v_total + 1;
  v_msg := null; v_ok := null;
  begin
    execute 'set local role authenticated';
    v_nova := public.calc_carga_abrir(v_txd);
    execute 'reset role';
    select id into v_mix from public.calc_pendencia
     where carga_id = v_nova and tipo = 'condicao' and texto like 'iPhone 14 Pro 256GB / %';
    execute 'set local role authenticated';
    perform public.calc_pendencia_resolver(v_mix, 'definir', 'Seminovo');
    execute 'reset role';
    select c.n_casou = 12 and (c.resumo->>'n_cond_respondida')::int = 1
           and exists (select 1 from jsonb_array_elements(c.blob_proposto->'produtos') p
                         left join lateral jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) x on true
                        where p->>'f' = 'Cristiano' and p->>'n' = 'iPhone 14 Pro 256GB' and p->>'t' = 'Seminovo'
                          and coalesce((x->>'v')::numeric, (p->>'v')::numeric) = 3800)
      into v_ok
      from public.calc_carga c where c.id = v_nova;
    raise exception 'prova_rollback';
  exception when others then
    if sqlerrm <> 'prova_rollback' then v_msg := sqlerrm; end if;
  end;
  if not coalesce(v_ok, false) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [D14] linha mista: definir o 14 Pro 256GB do Cristiano nao pos UMA linha (esperado n_casou 12, n_cond_respondida 1, Seminovo 3800). Obtido: '
             || coalesce(v_msg, '(nada)');
  end if;

  -- R11. O teto da fixture D com as cinco respondidas, direto no leitor: 16 de
  --      16, nenhuma pergunta de condicao sobrando, e as cinco contadas como
  --      vindas do dono. As chaves saem das PROPRIAS pendencias do leitor.
  v_total := v_total + 1;
  select jsonb_object_agg(q->>'texto',
           case when q->>'causa' like 'Nenhuma%' then 'Lacrado' else 'Seminovo' end)
    into v_mapa
    from jsonb_array_elements(v_dd->'pendencias') q where q->>'tipo' = 'condicao';
  v_depois := privado.calc_parse_v2(v_tenant, v_txd, v_mapa);
  v_rd := (v_depois->>'n_casou')::int;
  if v_rd <> 16 or (v_depois->>'n_lidas')::int <> 16
     or (v_depois->>'n_cond_respondida')::int <> 5
     or exists (select 1 from jsonb_array_elements(v_depois->'pendencias') q where q->>'tipo' = 'condicao')
     or not exists (select 1 from jsonb_array_elements(v_depois->'produtos') p
                      left join lateral jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) x on true
                     where p->>'n' = 'iPhone 15 128GB' and p->>'t' = 'Seminovo'
                       and coalesce((x->>'v')::numeric, (p->>'v')::numeric) = 3000)
     or not exists (select 1 from jsonb_array_elements(v_depois->'produtos') p
                      left join lateral jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) x on true
                     where p->>'n' = 'iPhone 16 128GB' and p->>'t' = 'Lacrado'
                       and coalesce((x->>'v')::numeric, (p->>'v')::numeric) = 4100) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [D14] fixture D com as 5 respondidas: casou ' || coalesce(v_rd::text,'?')
             || ' de ' || coalesce(v_depois->>'n_lidas','?') || ' (esperado 16 de 16), respondidas '
             || coalesce(v_depois->>'n_cond_respondida','?') || ' (esperado 5). Mapa: ' || coalesce(v_mapa::text,'(vazio)');
  end if;

  -- R12. O leitor nao confia em quem o chama: condicao que o tenant nao tem,
  --      passada DIRETO, nao vira preco, e a pergunta volta.
  v_total := v_total + 1;
  v_depois := privado.calc_parse_v2(v_tenant, v_txc, '{"junior":"Novo"}'::jsonb);
  if (v_depois->>'n_casou')::int <> 0 or (v_depois->>'n_cond_respondida')::int <> 0
     or not exists (select 1 from jsonb_array_elements(v_depois->'pendencias') q
                     where q->>'tipo' = 'condicao' and q->>'texto' = 'junior') then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [D14] o leitor aceitou "Novo" como condicao do junior: casou '
             || (v_depois->>'n_casou') || ', respondidas ' || coalesce(v_depois->>'n_cond_respondida','?');
  end if;

  -- R13. O leitor mudou de assinatura por DROP e CREATE, que leva a ACL junto.
  --      Um so `calc_parse_v2` em `privado` (sem sobrecarga, que a E3 nao ve:
  --      ela so olha `public`), com o argumento novo, e ninguem alem do dono
  --      executa (desenho: a barreira de papel mora nas RPCs).
  v_total := v_total + 1;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'privado' and p.proname = 'calc_parse_v2') <> 1
     or not exists (
       select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'privado' and p.proname = 'calc_parse_v2'
          and pg_get_function_identity_arguments(p.oid) = 'p_tenant uuid, p_texto text, p_condicoes jsonb'
          and p.proacl::text = '{postgres=X/postgres}') then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [ACL] privado.calc_parse_v2: sobrecarga, assinatura errada ou grant alem do dono: '
             || (select string_agg(pg_get_function_identity_arguments(p.oid) || ' acl=' || coalesce(p.proacl::text,'null'), ' | ')
                   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'privado' and p.proname = 'calc_parse_v2');
  end if;

  -- R14. A D16, NOMEADA (decisao do dono em 11/09/2026: manter). `descartar`
  --      numa pergunta de fornecedor e aceito e tira o BLOCO INTEIRO dele desta
  --      e de toda lista futura: as 2 linhas do XPTO vao para `n_descarte`,
  --      contadas, e a proxima carga com a mesma lista ja nao pergunta. Se um dia
  --      virar recusa, e ESTA assercao que tem que mudar, nao so um numero.
  v_total := v_total + 1;
  v_msg := null; v_ok := null;
  begin
    execute 'set local role authenticated';
    perform public.calc_pendencia_resolver(v_fx, 'descartar', null);
    v_nova := public.calc_carga_abrir(v_txc);
    execute 'reset role';
    v_depois := privado.calc_parse_v2(v_tenant, v_txc);
    select (v_depois->>'n_lidas')::int = 2 and (v_depois->>'n_descarte')::int = 2
           and not exists (select 1 from jsonb_array_elements(v_depois->'pendencias') q
                            where q->>'tipo' = 'fornecedor')
           and c.n_lidas = 2 and c.n_descarte = 2
           and not exists (select 1 from public.calc_pendencia q
                            where q.carga_id = v_nova and q.tipo = 'fornecedor')
           and exists (select 1 from public.calc_regra r
                        where r.tenant_id = v_tenant and r.tipo = 'descarte'
                          and r.padrao = 'tabela xpto imports')
      into v_ok
      from public.calc_carga c where c.id = v_nova;
    raise exception 'prova_rollback';
  exception when others then
    if sqlerrm <> 'prova_rollback' then v_msg := sqlerrm; end if;
  end;
  if not coalesce(v_ok, false) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [D16] descartar o fornecedor XPTO nao tirou o bloco dele desta e da proxima lista (esperado lidas 2, descarte 2, sem pergunta de fornecedor). Obtido: '
             || coalesce(v_msg, 'lidas ' || coalesce(v_depois->>'n_lidas','?') || ', descarte ' || coalesce(v_depois->>'n_descarte','?'));
  end if;

  raise exception E'%',
    case when v_falhas = 0
         then 'PASSOU: ' || v_total || ' assercoes, 0 falhas'
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
              || E'\n  fixture D (condicao), v2: lidas=' || (v_dd->>'n_lidas')
              || ' casou=' || (v_dd->>'n_casou')
              || ' perguntas de condicao=' || (select count(*) from jsonb_array_elements(v_dd->'pendencias') q
                                                where q->>'tipo' = 'condicao')
              || E'\n  resolver: ' || v_n_aceitas || ' respostas aceitas (todas ensinaram), '
              || v_n_recusas || ' recusadas com motivo declarado, 0 aceitas caladas'
              || E'\n  respostas de condicao (D14): fixture C casou 0 -> ' || coalesce(v_rc::text,'?')
              || ' com "junior" = Lacrado; fixture D 11 -> ' || coalesce(v_rd::text,'?')
              || ' de 16 com as 5 respondidas'
         else 'REPROVOU: ' || v_falhas || ' de ' || v_total || ' assercoes falharam' || v_log
    end;
end;
$prova$;
