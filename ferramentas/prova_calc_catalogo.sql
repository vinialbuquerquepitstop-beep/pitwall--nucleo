-- prova_calc_catalogo.sql — GERADO por ferramentas/gera_provas_calc.py. NAO EDITAR A MAO.
-- Fonte unica: ferramentas/prova_calc_parse.sql (md5 59374c620bbba1c78a742f0b12ec4eaa).
-- Mudou a fonte, rode o gerador de novo: este arquivo e sobrescrito.
--
-- Secoes: K, L, Q. Fixtures: C, E, F, H.
-- Assercoes escritas: 26 (um laco pode executar mais de uma vez; o numero
-- que conta e o da mensagem, e a soma dos tres gerados e o total da fonte).
--
-- COMO RODAR por MCP: enxugar e colar a saida numa chamada SO de execute_sql.
--   python ferramentas/enxuga_sql.py ferramentas/prova_calc_catalogo.sql <saida.sql>
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
  -- secao Q (D20: o preco muito abaixo da tabela vira pergunta)
  v_txh    text;   -- fixture H: um preco errado de R$ 300 e o certo de R$ 4.100
  v_hh     jsonb;  -- leitura sem confirmacao
  v_hh2    jsonb;  -- leitura com o preco baixo confirmado
  v_hk     text;   -- a chave da pergunta `abaixo da tabela: ...`
  v_kf2    uuid;   -- a carga da lista com condicao pendurada
  v_qr     jsonb := '{}';  -- o que a secao Q mediu dentro da subtransacao
  v_qlog   text;   -- erro inesperado dentro dela
begin
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

  -- @@fixture E
  -- ══ FIXTURE E — o que o verbo `criar` tem que resolver ══════════════════════
  -- Tres coisas de uma vez, e as tres foram MEDIDAS no leitor vivo em
  -- 11/09/2026 antes de a prova ser escrita (lidas=5, casou=0, duvidoso=4,
  -- nao_reconhecido=1, 5 pendencias):
  --   1. `TABELA MP DISTRIBUIDORA` — fornecedor que o catalogo nao tem, mas cujo
  --      NUCLEO (`mp`) e o mesmo do `MP Imports` que ele ja tem. E o caso da
  --      memoria `fornecedores-mesma-pessoa`: criar sozinho aqui mistura o custo
  --      de duas pessoas, e e escrita SEM VOLTA enquanto a 2.4c nao existir.
  --   2. `XPTO CELL IMPORTS` em TRES grafias que normalizam para o mesmo texto
  --      (`XPTO CELL IMPORTS`, `*Xpto  Cell  Imports*`, `xpto cell imports`).
  --      Sao tres pendencias, e um clique so tem que virar um fornecedor e tres
  --      apelidos. E a prova 2 da secao 7 da spec.
  --   3. `JBL Flip 7` — modelo que nao esta no catalogo (o `JBL Boombox 4` esta;
  --      este nao). E o unico caso do fluxo inteiro com pergunta obrigatoria de
  --      lista fechada: a CATEGORIA, porque e ela que decide a margem.
  -- Lista sintetica, precos inventados (restricao global 8).
  v_txe :=
     E'[11/09/2026, 10:00:00] Vini: TABELA MP DISTRIBUIDORA\n'
  || E'iPhone 16 128GB Preto Lacrado - 4.400\n\n'
  || E'[11/09/2026, 10:05:00] Vini: XPTO CELL IMPORTS\n'
  || E'iPhone 16 128GB Preto Lacrado - 4.450\n'
  || E'JBL Flip 7 Lacrado - 650\n\n'
  || E'[11/09/2026, 10:10:00] Vini: *Xpto  Cell  Imports*\n'
  || E'iPhone 16 256GB Azul Lacrado - 4.900\n\n'
  || E'[11/09/2026, 10:15:00] Vini: xpto cell imports\n'
  || E'iPhone 15 128GB Preto Lacrado - 3.700\n';

  -- @@fixture F
  -- ══ FIXTURE F — o descarte que nao descartava (D18, 11/09/2026) ═════════════
  -- A `bandeira` reprovou a fatia do `criar` com as 106 assercoes verdes porque
  -- `descartar` um cabecalho de fornecedor nao tirava nada, e o que ele deveria
  -- tirar entrava no nome do fornecedor de CIMA. Classe PRECO ERRADO.
  --
  -- A fixture reproduz os quatro vetores medidos no codigo vivo em 11/09/2026,
  -- ANTES do conserto, e o que cada um devolvia:
  --   13  `Fábrica Zeta` (acento)        padrao `fábrica zeta`: descarte 0 e o
  --                                      3.100 no blob COMO SE FOSSE do Alfa
  --   15  `*Fabrica  Zeta*` (asterisco,  mesma coisa: o `*` e o espaco duplo
  --       espaco duplo)                  somem no `calc_norm` e nao no `lower`
  --   16  ASCII em formato BLOCO         o padrao casava, mas o cabecalho de
  --                                      modelo cortava o descarte: descarte 0
  --   17  `PROMO`, padrao curto sem      casava a linha `- 5.400 PROMO` do
  --       ancora                         ALFA e APAGAVA um preco que era dele
  --
  -- O primeiro cabecalho e criado (`Alfa Imports`) de proposito: e ele que da a
  -- um cabecalho desconhecido um fornecedor RECONHECIDO acima para ser engolido.
  -- Sem isso a G3 pega o defeito sozinha ("esta resposta nao ensina nada") e o
  -- preco errado nunca aparece: foi assim que ele viveu com a prova verde.
  -- Lista sintetica, precos inventados (restricao global 8).
  v_txf :=
     E'[11/09/2026, 11:00:00] Vini: ALFA IMPORTS\n'
  || E'iPhone 16 128GB Preto Lacrado - 4.200\n'
  || E'iPhone 16 Pro 256GB Preto Lacrado - 5.400 PROMO\n\n'
  || E'[11/09/2026, 11:05:00] Vini: Fábrica Zeta\n'
  || E'iPhone 16 256GB Preto Lacrado - 3.100\n\n'
  || E'[11/09/2026, 11:10:00] Vini: *Fabrica  Zeta*\n'
  || E'iPhone 15 128GB Azul Lacrado - 2.900\n\n'
  || E'[11/09/2026, 11:15:00] Vini: Fabrica Zeta\n'
  || E'*🍎 iPhone 13 Pro – 128GB (CPO)*\n'
  || E'💵 *R$ 3.150,00*\n\n'
  || E'[11/09/2026, 11:20:00] Vini: PROMO\n'
  || E'iPhone 16 128GB Preto Lacrado - 3.900\n';

  -- @@fixture H
  -- ══ FIXTURE H — o preco baixo que expulsava o certo (D20, 12/09/2026) ═══════
  -- Na primeira lista real um numero errado (a bateria, R$ 100) virou o menor da
  -- combinacao e o outlier expulsou os precos verdadeiros. Aqui o errado e R$ 300 e
  -- o certo R$ 4.100, no mesmo modelo e condicao. A secao Q troca a tabela gravada
  -- por uma SINTETICA (R$ 4.000) dentro de uma subtransacao, entao a assercao nao
  -- depende do preco real do dia. Precos inventados (restricao global 8).
  v_txh :=
     E'[12/09/2026, 10:00:00] Vini: Junior recreio\n'
  || E'iPhone 16 128GB Preto Lacrado - 300\n'
  || E'iPhone 16 128GB Azul Lacrado - 4.100\n';

  -- @@preambulo
  -- O gerador leva cada linha daqui SO para o arquivo que le a variavel dela.

  -- Cada bloco abaixo soma 1 em v_total e, se falhar, soma 1 em v_falhas e
  -- anota o motivo. O relatorio sai inteiro, nao para no primeiro erro: parar
  -- no primeiro esconde os outros e custa uma rodada por defeito.

  -- @@comum rpc
  -- A identidade do DONO, como a tela vai rodar. Morava dentro da secao G, e
  -- era uma dependencia que a medida por variavel nao ve: a K e a L chamam RPC
  -- com `set local role authenticated` e dependiam de a G ter rodado antes. O
  -- gerador poe este bloco em todo arquivo que troca de papel.
  perform set_config('request.jwt.claims',
    '{"sub":"fb2aad8e-b728-4e59-a198-71da2156449d","role":"authenticated"}', true);

  -- @@secao K
  -- ══ K. O VERBO `criar` (2.4a, 2.4a ter e 2.4a quater, 11/09/2026) ═══════════
  -- Ate esta fatia o dono so sabia dizer "isto e outro nome de uma coisa que ja
  -- existe" e "isto nunca e preco". Fornecedor novo e modelo novo so nasciam por
  -- migration, ou seja, so com o dono do PRODUTO do outro lado. No dia 1 de um
  -- cliente todo fornecedor e desconhecido, entao sem `criar` o produto nao
  -- existe: existe um servico.
  --
  -- As tres coisas que estas assercoes cobram, e cada uma nasceu de um risco
  -- medido, nao de simetria de API:
  --   a) um clique ensina TODAS as grafias provadamente iguais (K1), senao o
  --      dono responde a mesma pergunta tres vezes na mesma lista;
  --   b) fornecedor parecido NAO se cria sozinho (K2/K3): enquanto a 2.4c
  --      (desfazer) nao existir, criar e escrita sem volta, e unir duas grafias
  --      por conta propria mistura o custo de duas pessoas diferentes;
  --   c) tudo que se aprende carrega `origem`, `carga_id` e `criado_por`
  --      (K1/K7/K12), senao a linha com mais chance de estar errada e justamente
  --      a que ninguem acha depois.
  -- A carga da fixture E e aberta UMA vez, aqui fora; cada assercao mexe nela
  -- dentro da propria subtransacao, entao todas partem do mesmo estado.

  -- K0. A fixture E le como foi medido em 11/09/2026, antes de qualquer resposta.
  --     Se este numero mudar, as assercoes abaixo estao medindo outra coisa.
  v_total := v_total + 1;
  v_ee := privado.calc_parse_v2(v_tenant, v_txe);
  if (v_ee->>'n_lidas')::int <> 5 or (v_ee->>'n_casou')::int <> 0
     or (v_ee->>'n_duvidoso')::int <> 4 or (v_ee->>'n_nao_reconhecido')::int <> 1
     or (select count(*) from jsonb_array_elements(v_ee->'pendencias') q
          where q->>'tipo' = 'fornecedor') <> 4
     or (select count(*) from jsonb_array_elements(v_ee->'pendencias') q
          where q->>'tipo' = 'modelo' and q->>'texto' = 'jbl flip 7 lacrado') <> 1 then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [K0] fixture E nao leu como o medido (esperado lidas 5, casou 0, duvidoso 4, nao reconhecido 1, 4 pendencias de fornecedor e a do modelo jbl). Obtido: lidas '
             || coalesce(v_ee->>'n_lidas','?') || ' casou ' || coalesce(v_ee->>'n_casou','?')
             || ' duvidoso ' || coalesce(v_ee->>'n_duvidoso','?')
             || ' nao_reconhecido ' || coalesce(v_ee->>'n_nao_reconhecido','?');
  end if;

  execute 'set local role authenticated';
  v_ke := public.calc_carga_abrir(v_txe);
  execute 'reset role';
  select id into v_pf  from public.calc_pendencia
   where carga_id = v_ke and tipo = 'fornecedor' and texto = 'XPTO CELL IMPORTS';
  select id into v_pmp from public.calc_pendencia
   where carga_id = v_ke and tipo = 'fornecedor' and texto = 'TABELA MP DISTRIBUIDORA';
  select id into v_pf2 from public.calc_pendencia
   where carga_id = v_ke and tipo = 'fornecedor' and texto = 'Xpto  Cell  Imports*';
  select id into v_pm  from public.calc_pendencia
   where carga_id = v_ke and tipo = 'modelo' and texto = 'jbl flip 7 lacrado';

  -- K1. Um clique, um fornecedor, TRES apelidos. E a prova 2 da secao 7 da spec.
  --     Junto: o carimbo de origem (2.4a quater) nas duas escritas, e as tres
  --     pendencias irmas saindo da fila de uma vez.
  v_total := v_total + 1;
  v_msg := null; v_ok := null;
  begin
    execute 'set local role authenticated';
    v_cri := public.calc_catalogo_criar(v_pf, 'XPTO Cell Imports',
                                        '{"praca":"Centro — RJ"}'::jsonb);
    execute 'reset role';
    select v_cri->>'codigo' = 'xpto_cell_imports'
           and (v_cri->>'grafias')::int = 3
           and (v_cri->>'n_casou')::int = 3
           and c.n_casou = 3 and c.n_duvidoso = 1 and c.n_lidas = 5
           and exists (select 1 from public.calc_fornecedor f
                        where f.tenant_id = v_tenant and f.codigo = 'xpto_cell_imports'
                          and f.nome = 'XPTO Cell Imports' and f.praca = 'Centro — RJ'
                          and f.origem = 'aprendizado' and f.carga_id = v_ke
                          and f.criado_por = v_dono)
           and (select count(*) from public.calc_alias a
                 where a.tenant_id = v_tenant and a.tipo = 'fornecedor'
                   and a.aponta = 'xpto_cell_imports' and a.origem = 'aprendizado'
                   and a.carga_id = v_ke and a.criado_por = v_dono) = 3
           and (select count(*) from public.calc_pendencia q
                 where q.carga_id = v_ke and q.tipo = 'fornecedor'
                   and q.decisao = 'criar' and q.aponta = 'xpto_cell_imports') = 3
           and exists (select 1 from jsonb_array_elements(c.blob_proposto->'produtos') p
                        where p->>'f' = 'XPTO Cell Imports' and p->>'n' = 'iPhone 15 128GB')
      into v_ok
      from public.calc_carga c where c.id = v_ke;
    raise exception 'prova_rollback';
  exception when others then
    if sqlerrm <> 'prova_rollback' then v_msg := sqlerrm; end if;
  end;
  if not coalesce(v_ok, false) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [K1] criar o XPTO nao virou 1 fornecedor + 3 apelidos com origem, ou as 3 linhas dele nao entraram (esperado codigo xpto_cell_imports, grafias 3, casou 3). Obtido: '
             || coalesce(v_msg, coalesce(v_cri::text,'(nada)'));
  end if;

  -- K2. 2.4a ter. `TABELA MP DISTRIBUIDORA` tem o mesmo NUCLEO do `MP Imports`
  --     que ele ja tem. Nao cria, NAO une, e a recusa poe as duas grafias lado a
  --     lado e diz como seguir. "Nada gravado" NAO se mede aqui: ate 11/09 esta
  --     assercao contava os fornecedores DEPOIS do rollback da subtransacao, e
  --     isso passa por construcao (achado da `bandeira`). Quem garante que a
  --     recusa nao grava e o `raise` dentro da RPC, que desfaz a transacao dela.
  v_total := v_total + 1;
  v_msg := null;
  begin
    execute 'set local role authenticated';
    perform public.calc_catalogo_criar(v_pmp, 'MP Distribuidora',
                                       '{"praca":"Campo Grande — RJ"}'::jsonb);
    execute 'reset role';
    raise exception 'prova_rollback';
  exception when others then
    v_msg := sqlerrm;
  end;
  if v_msg is null or v_msg = 'prova_rollback'
     or v_msg not like '%MP Imports%' or v_msg not like '%confirmar_novo%'
     or v_msg not like '%apontar%' then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [2.4a ter] criar "MP Distribuidora" com "MP Imports" no catalogo nao devolveu a pergunta com as duas grafias, ou gravou assim mesmo. Erro: '
             || coalesce(v_msg, '(nenhum, e isso e a falha)');
  end if;

  -- K3. E quando ele diz que e outro fornecedor MESMO, cria, e a linha entra.
  --     So o que o `criar` promete: o fornecedor nasce e a linha DELE entra. O
  --     que acontece com os fornecedores de BAIXO e a K13, e e defeito.
  v_total := v_total + 1;
  v_msg := null; v_ok := null;
  begin
    execute 'set local role authenticated';
    v_cri := public.calc_catalogo_criar(v_pmp, 'MP Distribuidora',
               '{"praca":"Campo Grande — RJ","confirmar_novo":"sim"}'::jsonb);
    execute 'reset role';
    select v_cri->>'codigo' = 'mp_distribuidora'
           and (v_cri->>'grafias')::int = 1
           and exists (select 1 from public.calc_fornecedor f
                        where f.tenant_id = v_tenant and f.codigo = 'mp_distribuidora'
                          and f.origem = 'aprendizado')
           and exists (select 1 from jsonb_array_elements(c.blob_proposto->'produtos') p
                        left join lateral jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) x on true
                        where p->>'f' = 'MP Distribuidora' and p->>'n' = 'iPhone 16 128GB'
                          and coalesce((x->>'v')::numeric, (p->>'v')::numeric) = 4400)
      into v_ok
      from public.calc_carga c where c.id = v_ke;
    raise exception 'prova_rollback';
  exception when others then
    if sqlerrm <> 'prova_rollback' then v_msg := sqlerrm; end if;
  end;
  if not coalesce(v_ok, false) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [2.4a ter] confirmando que e outro fornecedor, criar o MP Distribuidora nao pos a linha dele (esperado codigo mp_distribuidora, iPhone 16 128GB a 4400). Obtido: '
             || coalesce(v_msg, coalesce(v_cri::text,'(nada)'));
  end if;

  -- K13. D17 (a), decidida pelo dono em 11/09/2026. A resposta a UMA pergunta
  --      de fornecedor nunca faz OUTRA pergunta aberta da mesma carga sumir.
  --
  --      O defeito, achado pela K3 na primeira rodada desta prova e medido de
  --      novo fora dela (classe PRECO ERRADO): no dia 1 cada cabecalho e
  --      pergunta (4 na fixture E), e criar o PRIMEIRO (`MP Distribuidora`, no
  --      topo) fazia a D10 engolir os tres de baixo. Casou ia de 1 para 4: o 16
  --      256GB a 4.900 e o 15 128GB a 3.700, do XPTO, entravam no nome do MP, e o
  --      16 128GB do XPTO a 4.450 sumia no `min()`. As tres perguntas que o dono
  --      ja tinha visto sumiam, e a cobertura SUBIA, entao nada reclamava.
  --
  --      Consertado em `20260911_calc_parse_pergunta_de_fornecedor_fica.sql`:
  --      cabecalho que ja e pergunta aberta vira `forn_aberto` e fecha o bloco.
  --      Esperado agora: casou 1 (so a linha do MP), 4 pendencias na leitura (as
  --      3 do XPTO de pe + a do modelo JBL), nenhum preco do XPTO no nome do MP,
  --      e o `fornecedor_conferir` do MP sem nada ignorado (os tres cabecalhos
  --      nao sao mais "ruido dentro do bloco do MP": sao outro fornecedor).
  v_total := v_total + 1;
  v_msg := null; v_ok := null; v_k13 := null;
  begin
    execute 'set local role authenticated';
    perform public.calc_catalogo_criar(v_pmp, 'MP Distribuidora',
              '{"praca":"Campo Grande — RJ","confirmar_novo":"sim"}'::jsonb);
    execute 'reset role';
    select c.n_casou,
           c.n_duvidoso = 3 and c.n_pendencia = 4 and c.n_lidas = 5
           and not exists (select 1 from jsonb_array_elements(c.blob_proposto->'produtos') p
                            where p->>'f' = 'MP Distribuidora'
                              and p->>'n' in ('iPhone 16 256GB','iPhone 15 128GB'))
           and not exists (select 1 from jsonb_array_elements(c.resumo->'fornecedor_conferir') f
                            where f->>'fornecedor' = 'MP Distribuidora'
                              and jsonb_array_length(f->'ignoradas') > 0)
      into v_k13, v_ok
      from public.calc_carga c where c.id = v_ke;
    raise exception 'prova_rollback';
  exception when others then
    if sqlerrm <> 'prova_rollback' then v_msg := sqlerrm; end if;
  end;
  if not coalesce(v_ok, false) or v_k13 is distinct from 1 then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [D17] criar o 1o fornecedor da lista engoliu os de baixo de novo (esperado casou 1, duvidoso 3, 4 pendencias, nenhum preco do XPTO no nome do MP). Obtido: casou '
             || coalesce(v_k13::text,'?') || '. Erro: ' || coalesce(v_msg,'(nenhum)');
  end if;

  -- K14. D17 (a) tambem para o `ignorar`. "Deixar estas linhas fora desta
  --      lista" tem que continuar fora depois de OUTRA resposta: se o XPTO
  --      ignorado pudesse ser engolido pelo MP criado em seguida, `ignorar`
  --      viraria "entra no nome do fornecedor de cima", que e o contrario do que
  --      o botao diz. So a grafia `XPTO CELL IMPORTS` e ignorada aqui, e as duas
  --      linhas dela (o 16 128GB a 4.450 e o JBL) seguem fora do MP.
  --      A prova e a CONTAGEM, nao o preco: engolido, o 4.450 some no `min()`
  --      contra o 4.400 do MP e nao aparece em lugar nenhum, entao procurar o
  --      4.450 no nome do MP passaria verde com o defeito vivo. Engolido, o
  --      16 128GB do XPTO conta como casou (2) e sai do duvidoso (2); de pe,
  --      casou 1 e duvidoso 3.
  v_total := v_total + 1;
  v_msg := null; v_ok := null;
  begin
    execute 'set local role authenticated';
    perform public.calc_pendencia_resolver(v_pf, 'ignorar', null);
    perform public.calc_catalogo_criar(v_pmp, 'MP Distribuidora',
              '{"praca":"Campo Grande — RJ","confirmar_novo":"sim"}'::jsonb);
    execute 'reset role';
    select c.n_casou = 1 and c.n_duvidoso = 3
           and (select q.decisao from public.calc_pendencia q where q.id = v_pf) = 'ignorar'
      into v_ok
      from public.calc_carga c where c.id = v_ke;
    raise exception 'prova_rollback';
  exception when others then
    if sqlerrm <> 'prova_rollback' then v_msg := sqlerrm; end if;
  end;
  if not coalesce(v_ok, false) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [D17] a pergunta IGNORADA do XPTO foi engolida pelo MP criado depois (esperado casou 1, duvidoso 3). Erro: '
             || coalesce(v_msg,'(nenhum)');
  end if;

  -- K15. D17 (a) contra um NOME reconhecido, e nao so contra o fornecedor de
  --      cima. Achado da `bandeira` com as 104 assercoes verdes, 11/09/2026,
  --      classe PRECO ERRADO: o dono ignora a mensagem `XPTO CELL IMPORTS` e
  --      cria o fornecedor pela grafia `*Xpto  Cell  Imports*`. O leitor
  --      reconhece fornecedor pelo NOME, e `XPTO CELL IMPORTS` contem
  --      `xpto cell imports`: a mensagem ignorada voltava como fornecedor
  --      reconhecido e o preco dela entrava. No vetor dela, com o mesmo modelo
  --      a 4.100 na ignorada e 4.900 na outra, o blob saia com 4.100.
  --      Aqui, a linha da ignorada e o 16 128GB (4.450), que so ela tem no
  --      XPTO: ela NAO pode aparecer no nome do XPTO. Engolida, casou 3; de pe,
  --      casou 2. E a irma ignorada NAO ganha apelido (grafias 2, nao 3).
  --      Consertado em `20260911_calc_d17_pergunta_ignorada_fica.sql`.
  v_total := v_total + 1;
  v_msg := null; v_ok := null; v_cri := null;
  begin
    execute 'set local role authenticated';
    perform public.calc_pendencia_resolver(v_pf, 'ignorar', null);
    v_cri := public.calc_catalogo_criar(v_pf2, 'XPTO Cell Imports',
                                        '{"praca":"Centro — RJ"}'::jsonb);
    execute 'reset role';
    select c.n_casou = 2 and (v_cri->>'grafias')::int = 2
           and (select q.decisao from public.calc_pendencia q where q.id = v_pf) = 'ignorar'
           and (select q.decisao from public.calc_pendencia q where q.id = v_pf2) = 'criar'
           and not exists (select 1 from public.calc_alias a
                            where a.tenant_id = v_tenant and a.tipo = 'fornecedor'
                              and a.texto = 'XPTO CELL IMPORTS')
           and not exists (select 1 from jsonb_array_elements(c.blob_proposto->'produtos') p
                            where p->>'f' = 'XPTO Cell Imports' and p->>'n' = 'iPhone 16 128GB')
      into v_ok
      from public.calc_carga c where c.id = v_ke;
    raise exception 'prova_rollback';
  exception when others then
    if sqlerrm <> 'prova_rollback' then v_msg := sqlerrm; end if;
  end;
  if not coalesce(v_ok, false) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [D17] a mensagem IGNORADA do XPTO voltou pelo NOME do fornecedor criado por outra grafia (esperado casou 2, grafias 2, o 16 128GB fora do XPTO, a ignorada ainda ignorar). Obtido: '
             || coalesce(v_msg, coalesce(v_cri::text,'(nada)'));
  end if;

  -- K16. `criar` sobre a PROPRIA pergunta que o dono tinha ignorado e resposta
  --      nova, e o historico tem que dizer isso (invariante 6). Ate o conserto,
  --      a pendencia seguia `ignorar` com o efeito de `criar`, e o `grafias`
  --      contava so as irmas (2). Esperado: ela vira `criar`, tres apelidos, e
  --      as tres linhas do XPTO entram.
  v_total := v_total + 1;
  v_msg := null; v_ok := null; v_cri := null;
  begin
    execute 'set local role authenticated';
    perform public.calc_pendencia_resolver(v_pf, 'ignorar', null);
    v_cri := public.calc_catalogo_criar(v_pf, 'XPTO Cell Imports',
                                        '{"praca":"Centro — RJ"}'::jsonb);
    execute 'reset role';
    select c.n_casou = 3 and (v_cri->>'grafias')::int = 3
           and (select q.decisao from public.calc_pendencia q where q.id = v_pf) = 'criar'
           and (select count(*) from public.calc_pendencia q
                 where q.carga_id = v_ke and q.tipo = 'fornecedor'
                   and q.decisao = 'criar' and q.aponta = 'xpto_cell_imports') = 3
      into v_ok
      from public.calc_carga c where c.id = v_ke;
    raise exception 'prova_rollback';
  exception when others then
    if sqlerrm <> 'prova_rollback' then v_msg := sqlerrm; end if;
  end;
  if not coalesce(v_ok, false) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [K16] criar sobre a pergunta ignorada nao a marcou como criar, ou nao contou as 3 grafias (esperado casou 3, grafias 3). Obtido: '
             || coalesce(v_msg, coalesce(v_cri::text,'(nada)'));
  end if;

  -- K4. Nome que JA esta no catalogo nao se cria de novo: isso e `apontar`.
  --     Sem esta guarda o catalogo ganha `MP Imports` duas vezes, com codigos
  --     diferentes, e metade dos apelidos aponta para cada um.
  v_total := v_total + 1;
  v_msg := null;
  begin
    execute 'set local role authenticated';
    perform public.calc_catalogo_criar(v_pmp, 'MP Imports',
                                       '{"praca":"Campo Grande — RJ"}'::jsonb);
    execute 'reset role';
    raise exception 'prova_rollback';
  exception when others then
    v_msg := sqlerrm;
  end;
  if v_msg is null or v_msg = 'prova_rollback' or v_msg not like '%use apontar%' then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [K4] criar um fornecedor que ja existe pelo nome nao mandou usar apontar. Erro: '
             || coalesce(v_msg, '(nenhum, e isso e a falha)');
  end if;

  -- K5. Modelo novo sem categoria e RECUSA, nao default. A categoria decide a
  --     margem: default silencioso aqui e preco errado com cara de certo.
  v_total := v_total + 1;
  v_msg := null;
  begin
    execute 'set local role authenticated';
    perform public.calc_catalogo_criar(v_pm, 'JBL Flip 7', '{}'::jsonb);
    execute 'reset role';
    raise exception 'prova_rollback';
  exception when others then
    v_msg := sqlerrm;
  end;
  if v_msg is null or v_msg = 'prova_rollback' or v_msg not like '%exige a categoria%'
     or v_msg not like '%margem%' then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [K5] criar modelo sem categoria foi aceito, ou a recusa nao disse por que. Erro: '
             || coalesce(v_msg, '(nenhum, e isso e a falha)');
  end if;

  -- K6. Categoria inventada tambem e recusa, e a recusa LISTA as validas.
  v_total := v_total + 1;
  v_msg := null;
  begin
    execute 'set local role authenticated';
    perform public.calc_catalogo_criar(v_pm, 'JBL Flip 7',
                                       '{"categoria":"Caixa de som"}'::jsonb);
    execute 'reset role';
    raise exception 'prova_rollback';
  exception when others then
    v_msg := sqlerrm;
  end;
  if v_msg is null or v_msg = 'prova_rollback' or v_msg not like '%Validas%'
     or v_msg not like '%iPhone%' then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [K6] categoria inventada foi aceita, ou a recusa nao listou as validas. Erro: '
             || coalesce(v_msg, '(nenhum, e isso e a falha)');
  end if;

  -- K7. Com a categoria, o modelo entra e o leitor PARA de nao reconhecer a
  --     linha. Ela vira duvidoso, nao preco: o fornecedor dela segue
  --     desconhecido nesta sequencia, e linha que nao se entende inteira nunca
  --     vira preco (restricao global do plano).
  v_total := v_total + 1;
  v_msg := null; v_ok := null;
  begin
    execute 'set local role authenticated';
    v_cri := public.calc_catalogo_criar(v_pm, 'JBL Flip 7', '{"categoria":"JBL"}'::jsonb);
    execute 'reset role';
    select v_cri->>'codigo' = 'jbl_flip_7'
           and (v_cri->>'grafias')::int = 1
           and c.n_lidas = 5 and c.n_duvidoso = 5 and c.n_casou = 0
           and exists (select 1 from public.calc_modelo m
                        where m.tenant_id = v_tenant and m.codigo = 'jbl_flip_7'
                          and m.nome = 'JBL Flip 7' and m.categoria = 'JBL'
                          and m.origem = 'aprendizado' and m.carga_id = v_ke
                          and m.criado_por = v_dono)
           and exists (select 1 from public.calc_alias a
                        where a.tenant_id = v_tenant and a.tipo = 'modelo'
                          and a.texto = 'jbl flip 7 lacrado' and a.aponta = 'jbl_flip_7'
                          and a.origem = 'aprendizado')
           and not exists (select 1 from public.calc_pendencia q
                            where q.carga_id = v_ke and q.tipo = 'modelo'
                              and q.decisao is null)
      into v_ok
      from public.calc_carga c where c.id = v_ke;
    raise exception 'prova_rollback';
  exception when others then
    if sqlerrm <> 'prova_rollback' then v_msg := sqlerrm; end if;
  end;
  if not coalesce(v_ok, false) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [K7] criar o modelo JBL Flip 7 nao ensinou o leitor (esperado codigo jbl_flip_7, nenhuma pendencia de modelo aberta, duvidoso 5). Obtido: '
             || coalesce(v_msg, coalesce(v_cri::text,'(nada)'));
  end if;

  -- K8. Condicao NAO se cria no catalogo. A resposta dela vale so para aquela
  --     lista (D14, verbo `definir`), e criar condicao seria transformar em
  --     regra permanente exatamente o que a D14 decidiu que nao vira.
  v_total := v_total + 1;
  v_msg := null;
  begin
    execute 'set local role authenticated';
    v_nova := public.calc_carga_abrir(v_txc);
    execute 'reset role';
    select id into v_cond from public.calc_pendencia
     where carga_id = v_nova and tipo = 'condicao' limit 1;
    execute 'set local role authenticated';
    perform public.calc_catalogo_criar(v_cond, 'Novo', '{}'::jsonb);
    execute 'reset role';
    raise exception 'prova_rollback';
  exception when others then
    v_msg := sqlerrm;
  end;
  if v_msg is null or v_msg = 'prova_rollback'
     or v_msg not like '%condicao nao se cria%' or v_msg not like '%definir%' then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [K8] criar condicao no catalogo foi aceito, ou a recusa nao mandou usar definir. Erro: '
             || coalesce(v_msg, '(nenhum, e isso e a falha)');
  end if;

  -- K9. T3 tambem vale para `criar`: sem a lista crua nao da para provar que a
  --     criacao ensina, entao nao se escreve no catalogo as cegas.
  v_total := v_total + 1;
  v_msg := null;
  begin
    execute 'set local role authenticated';
    perform public.calc_carga_descartar(v_ke);
    perform public.calc_catalogo_criar(v_pf, 'XPTO Cell Imports',
                                       '{"praca":"Centro — RJ"}'::jsonb);
    execute 'reset role';
    raise exception 'prova_rollback';
  exception when others then
    v_msg := sqlerrm;
  end;
  if v_msg is null or v_msg = 'prova_rollback' or v_msg not like '%nao esta mais em rascunho%' then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [K9] criar em carga fora de rascunho foi aceito. Erro: '
             || coalesce(v_msg, '(nenhum, e isso e a falha)');
  end if;

  -- K10. A lista de categorias do codigo e o check `calc_modelo_categoria_ck`
  --      sao DUAS copias do mesmo fato. Esta assercao existe para que a segunda
  --      copia nao envelheca calada: categoria nova no check e invisivel para o
  --      dono ate alguem lembrar de mexer na funcao.
  v_total := v_total + 1;
  select count(*) into v_cats_c
    from regexp_matches(
      (select pg_get_constraintdef(k.oid) from pg_constraint k
        where k.conname = 'calc_modelo_categoria_ck'),
      '''([^'']+)''::text', 'g') m;
  select count(*) into v_cats_f
    from regexp_matches(
      (select substring(pr.prosrc from 'v_cats\s+text\[\] := array\[(.*?)\];')
         from pg_proc pr join pg_namespace ns on ns.oid = pr.pronamespace
        where ns.nspname = 'public' and pr.proname = 'calc_catalogo_criar'),
      '''([^'']+)''', 'g') m;
  if coalesce(v_cats_c,0) <> 9 or coalesce(v_cats_f,0) <> v_cats_c
     or exists (
       select 1 from regexp_matches(
           (select pg_get_constraintdef(k.oid) from pg_constraint k
             where k.conname = 'calc_modelo_categoria_ck'),
           '''([^'']+)''::text', 'g') m
        where position(m[1] in (select pr.prosrc from pg_proc pr
                                  join pg_namespace ns on ns.oid = pr.pronamespace
                                 where ns.nspname = 'public'
                                   and pr.proname = 'calc_catalogo_criar')) = 0) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [K10] a lista de categorias de calc_catalogo_criar divergiu do check calc_modelo_categoria_ck (check '
             || coalesce(v_cats_c::text,'?') || ', codigo ' || coalesce(v_cats_f::text,'?') || ').';
  end if;

  -- K11. A RPC nova e publica para `authenticated` (a barreira de papel mora no
  --      CORPO dela); as duas de `privado` NAO recebem grant nenhum, senao
  --      existiria caminho que pula a barreira.
  v_total := v_total + 1;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'calc_catalogo_criar') <> 1
     or not exists (
       select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'calc_catalogo_criar'
          and pg_get_function_identity_arguments(p.oid) = 'p_pendencia uuid, p_nome text, p_extra jsonb'
          and p.prosecdef
          and p.proacl::text like '%authenticated=X%'
          and p.proacl::text not like '%anon=X%')
     or exists (
       select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'privado' and p.proname in ('calc_reprocessar','calc_nucleo')
          -- igualdade ESTRITA, como a R13: ACL nula NAO e segura, ela quer
          -- dizer EXECUTE para PUBLIC (achado da `bandeira`, 11/09/2026)
          and p.proacl::text is distinct from '{postgres=X/postgres}')
     or (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'privado' and p.proname in ('calc_reprocessar','calc_nucleo')) <> 2 then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [ACL] calc_catalogo_criar ou as funcoes de privado estao com grant errado: '
             || coalesce((select string_agg(n.nspname || '.' || p.proname || ' acl=' || coalesce(p.proacl::text,'null'), ' | ')
                   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where (n.nspname = 'public' and p.proname = 'calc_catalogo_criar')
                     or (n.nspname = 'privado' and p.proname in ('calc_reprocessar','calc_nucleo'))), '(nao existe)');
  end if;

  -- K12. 2.4a quater no OUTRO verbo: o que o `calc_pendencia_resolver` aprende
  --      tambem carrega origem. Sem isso metade do aprendizado seria rastreavel
  --      e a outra metade nao, que e pior do que nenhuma.
  v_total := v_total + 1;
  v_msg := null; v_ok := null;
  begin
    execute 'set local role authenticated';
    perform public.calc_pendencia_resolver(v_pmp, 'apontar', 'mp_imports');
    perform public.calc_pendencia_resolver(v_pm, 'descartar', null);
    execute 'reset role';
    select exists (select 1 from public.calc_alias a
                    where a.tenant_id = v_tenant and a.tipo = 'fornecedor'
                      and a.texto = 'TABELA MP DISTRIBUIDORA' and a.aponta = 'mp_imports'
                      and a.origem = 'aprendizado' and a.carga_id = v_ke
                      and a.criado_por = v_dono)
           -- D18: o padrao de uma pergunta de MODELO comeca a linha (o texto e a
           -- linha sem o preco do fim), entao ele entra ancorado so na frente.
           and exists (select 1 from public.calc_regra r
                        where r.tenant_id = v_tenant and r.tipo = 'descarte'
                          and r.padrao = '^jbl flip 7 lacrado'
                          and r.escopo = 'linha'
                          and r.origem = 'aprendizado' and r.carga_id = v_ke
                          and r.criado_por = v_dono)
      into v_ok;
    raise exception 'prova_rollback';
  exception when others then
    if sqlerrm <> 'prova_rollback' then v_msg := sqlerrm; end if;
  end;
  if not coalesce(v_ok, false) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [2.4a quater] o resolver nao carimbou origem/carga/autor no apelido ou na regra de descarte. Erro: '
             || coalesce(v_msg, '(nenhum)');
  end if;

  -- @@secao L
  -- ══ L. D18 — O DESCARTE QUE DESCARTA (11/09/2026) ══════════════════════════
  -- A causa era UMA: a regra era gravada com `lower(texto)` e o leitor casa o
  -- padrao contra `privado.calc_norm(linha)`. Padrao numa normalizacao, texto em
  -- outra: nunca casa, e falha CALADA. Mesma familia do `\b` que era backspace e
  -- do `calc()` com sinal colado. A regra que sai daqui vale para o projeto
  -- todo: **padrao gravado tem que estar na MESMA normalizacao do texto contra o
  -- qual ele casa.**
  --
  -- Cada volta do laco abre a fixture F do zero, cria o `Alfa Imports` e
  -- descarta UM dos quatro cabecalhos, dentro da propria subtransacao. Elas nao
  -- se contaminam, e nenhuma sobrevive ao `raise` do fim.
  --
  -- As tres coisas que o conserto tem que garantir, e que estas assercoes
  -- cobram JUNTAS em cada volta (uma propriedade sozinha nao basta):
  --   1. o padrao sai do texto normalizado e ancorado na linha inteira;
  --   2. o cabecalho descartado FECHA o bloco do fornecedor de cima;
  --   3. as linhas dele vao para `n_descarte` ate o proximo cabecalho de
  --      fornecedor, mesmo com cabecalho de modelo no meio.
  -- O `Alfa Imports` com EXATAMENTE dois produtos e o que prova as duas pontas
  -- do erro de preco: nada de outro fornecedor entra no nome dele (vetores 13,
  -- 15 e 16) e nada que e dele some (vetor 17).
  for v_i in 1..4 loop
    v_alvo := (array['Fábrica Zeta','Fabrica  Zeta*','Fabrica Zeta','PROMO'])[v_i];
    v_l    := (array['L13 acento','L15 asterisco e espaco duplo',
                     'L16 formato bloco','L17 padrao curto sem ancora'])[v_i];
    v_total := v_total + 1;
    v_msg := null; v_ok := null;
    begin
      execute 'set local role authenticated';
      v_kf := public.calc_carga_abrir(v_txf);
      perform public.calc_catalogo_criar(
        (select id from public.calc_pendencia
          where carga_id = v_kf and tipo = 'fornecedor' and texto = 'ALFA IMPORTS'),
        'Alfa Imports', '{"praca":"Centro — RJ"}'::jsonb);
      perform public.calc_pendencia_resolver(
        (select id from public.calc_pendencia
          where carga_id = v_kf and tipo = 'fornecedor' and texto = v_alvo),
        'descartar', null);
      execute 'reset role';
      select c.n_lidas    = (case when v_i = 4 then 5 else 3 end)
         and c.n_casou    = 2
         and c.n_duvidoso = (case when v_i = 4 then 3 else 1 end)
         and c.n_descarte = (case when v_i = 4 then 1 else 3 end)
         -- o Alfa tem os DOIS precos que sao dele, e nada alem deles
         and (select count(*) from jsonb_array_elements(c.blob_proposto->'produtos') p
               where p->>'f' = 'Alfa Imports') = 2
         and exists (select 1 from jsonb_array_elements(c.blob_proposto->'produtos') p
                       left join lateral jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) x on true
                      where p->>'f' = 'Alfa Imports' and p->>'n' = 'iPhone 16 128GB'
                        and coalesce((x->>'v')::numeric, (p->>'v')::numeric) = 4200)
         -- vetor 17: a linha `- 5.400 PROMO` e do ALFA e continua dele
         and exists (select 1 from jsonb_array_elements(c.blob_proposto->'produtos') p
                       left join lateral jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) x on true
                      where p->>'f' = 'Alfa Imports' and p->>'n' = 'iPhone 16 Pro 256GB'
                        and coalesce((x->>'v')::numeric, (p->>'v')::numeric) = 5400)
         -- a regra gravada: normalizada, ancorada na linha inteira, com escopo
         and exists (select 1 from public.calc_regra r
                      where r.tenant_id = v_tenant and r.tipo = 'descarte'
                        and r.origem = 'aprendizado' and r.escopo = 'fornecedor'
                        and r.ativo
                        and r.padrao = (case when v_i = 4 then '^promo$'
                                             else '^fabrica zeta$' end))
         -- vetor 16: o `n_linhas` do descarte INCLUI o preco que vive sob um
         -- cabecalho de modelo (3 nas tres primeiras voltas, 1 na do PROMO).
         -- Contar aqui vale mais do que procurar o valor no blob: o blob traz
         -- tambem os fornecedores que nao vieram nesta lista (trava 4), e um
         -- deles tem um preco igual ao da fixture. Assercao que casa por VALOR
         -- solto no blob prova o catalogo, nao a fixture.
         -- E o motivo diz QUEM foi descartado: `descartes` e o que a tela mostra.
         and exists (select 1 from jsonb_array_elements(c.resumo->'descartes') d
                      where d->>'motivo' like 'fornecedor descartado pelo dono em%'
                        and (d->>'n_linhas')::int = (case when v_i = 4 then 1 else 3 end))
        into v_ok
        from public.calc_carga c where c.id = v_kf;
      raise exception 'prova_rollback';
    exception when others then
      if sqlerrm <> 'prova_rollback' then v_msg := sqlerrm; end if;
    end;
    if not coalesce(v_ok, false) then
      v_falhas := v_falhas + 1;
      v_log := v_log || E'\n  FALHA  [' || v_l || '] descartar "' || v_alvo
               || '" nao tirou o bloco dele, ou mexeu no preco do Alfa Imports. Obtido: '
               || coalesce(v_msg,
                    coalesce((select 'lidas=' || c.n_lidas || ' casou=' || c.n_casou
                                     || ' duvidoso=' || c.n_duvidoso || ' descarte=' || c.n_descarte
                                from public.calc_carga c where c.id = v_kf), '(carga sumiu)'));
    end if;
  end loop;

  -- L18. As regras de SEMENTE com acento nunca casaram, e este defeito e do
  --      Bloco 1, nao desta fatia. `réplica` e `genérico` estao desligadas por
  --      DECISAO do dono (17/08/2026), entao o preco de replica entrar nao era
  --      so a normalizacao; as que estavam ATIVAS e falhavam calado sao
  --      `peça não genuína`, `somente para mídia` (dentro de uma regra ativa) e
  --      `à vista` / `só hoje` (na regra de pendencia). As cinco foram
  --      regravadas, inclusive as duas desligadas: senao o defeito volta no dia
  --      em que o dono ligar o interruptor, e ai ninguem lembra por que.
  v_total := v_total + 1;
  if exists (
       select 1
         from (values
           ('peca nao genuina', 'iPhone 16 256GB Preto peça não genuína - 1.900'),
           ('replica',          'iPhone 16 256GB Preto réplica - 900'),
           ('generico',         'iPhone 16 256GB Preto genérico - 950'),
           ('a vista|so hoje|unidades',
            'iPhone 16 256GB Preto - 4.700 à vista'),
           ('caixa aberta|lacre rompido|deslacrado|somente para midia|c/caixa',
            'iPhone 16 256GB Preto somente para mídia - 1.000')
         ) as v(p, l)
         left join public.calc_regra r
           on r.tenant_id = v_tenant and r.tipo = 'descarte' and r.padrao = v.p
        where r.id is null or not (privado.calc_norm(v.l) ~ r.padrao)) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [L18] regra de semente que nao casa a propria linha: '
             || coalesce((select string_agg(v.p, ' | ')
                            from (values
                              ('peca nao genuina', 'iPhone 16 256GB Preto peça não genuína - 1.900'),
                              ('replica',          'iPhone 16 256GB Preto réplica - 900'),
                              ('generico',         'iPhone 16 256GB Preto genérico - 950'),
                              ('a vista|so hoje|unidades',
                               'iPhone 16 256GB Preto - 4.700 à vista'),
                              ('caixa aberta|lacre rompido|deslacrado|somente para midia|c/caixa',
                               'iPhone 16 256GB Preto somente para mídia - 1.000')
                            ) as v(p, l)
                            left join public.calc_regra r
                              on r.tenant_id = v_tenant and r.tipo = 'descarte' and r.padrao = v.p
                           where r.id is null or not (privado.calc_norm(v.l) ~ r.padrao)),
                         '(nenhuma, e ainda assim falhou)');
  end if;

  -- L18b. A regra GERAL, e nao os cinco casos: nenhum padrao de descarte ou de
  --       condicao pode ter alternativa numa normalizacao diferente da do texto
  --       contra o qual ele casa. As alternativas que sao REGEX de verdade
  --       (`\$\s?[0-9]`, e as ancoradas do proprio `descartar`) ficam de fora,
  --       porque nelas `calc_norm` nao e a pergunta certa.
  v_total := v_total + 1;
  if exists (
       select 1 from (
         select unnest(string_to_array(g.padrao, '|')) as alt
           from public.calc_regra g
          where g.tipo in ('descarte','condicao')
       ) x
        where x.alt is distinct from privado.calc_norm(x.alt)
          and strpos(x.alt, chr(92)) = 0
          and strpos(x.alt, '^') = 0
          and strpos(x.alt, '$') = 0) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [L18b] padrao gravado fora da normalizacao do texto: '
             || coalesce((select string_agg(x.alt, ' | ') from (
                  select unnest(string_to_array(g.padrao, '|')) as alt
                    from public.calc_regra g
                   where g.tipo in ('descarte','condicao')) x
                 where x.alt is distinct from privado.calc_norm(x.alt)
                   and strpos(x.alt, chr(92)) = 0
                   and strpos(x.alt, '^') = 0
                   and strpos(x.alt, '$') = 0), '(nenhuma)');
  end if;

  -- L19. T5, e ela encolheu no mesmo dia em que nasceu. A primeira peca da D18
  --      recusava `descartar` em `cor` TAMBEM, e isso estava errado: o texto de
  --      uma pergunta de cor (`verde menta`) esta DENTRO da linha do preco, a
  --      regra casa essa linha e a resposta ensina de verdade. Quem pegou foi a
  --      G6 ("o que ensinava continua ensinando"), que e o unico motivo de ela
  --      existir. A ancora passou a sair da MEDIDA contra a lista (iguala ->
  --      `^...$`, comeca -> `^...`, aparece dentro -> `\y...\y`), e a T5 ficou
  --      so com `preco`, cujo texto e um MOTIVO por construcao
  --      (`preco com condicao pendurada: ...`), nunca um pedaco da lista.
  v_total := v_total + 1;
  v_msg := null; v_ok := null;
  --      Desde 12/09/2026 ela abre a PROPRIA carga. Ate ali lia as cargas
  --      abertas pela secao G, e isso amarrava o arquivo do catalogo ao do laco:
  --      assercao que depende do estado deixado por outra secao quebra quando a
  --      outra muda. A lista de duas linhas abaixo foi medida em 12/09/2026 e
  --      gera a pergunta `preco com condicao pendurada: a calc nao tem onde
  --      guardar condicao`. Tem que ser `preco`: `cor` agora e ACEITO, e de
  --      proposito.
  begin
    execute 'set local role authenticated';
    v_kf := public.calc_carga_abrir(
         E'[11/09/2026, 14:00:00] Vini: Junior recreio\n'
      || E'iPhone 16 128GB Preto Lacrado - 4.100 a vista\n');
    select id into v_preco from public.calc_pendencia
     where carga_id = v_kf and tipo = 'preco'
     order by texto limit 1;
    if v_preco is null then
      v_msg := 'nenhuma pergunta de preco nas fixtures: a assercao perdeu o alvo';
    else
      perform public.calc_pendencia_resolver(v_preco, 'descartar', null);
      v_msg := 'ACEITOU descartar uma pergunta de preco';
    end if;
    execute 'reset role';
    raise exception 'prova_rollback';
  exception when others then
    if sqlerrm <> 'prova_rollback' then v_msg := sqlerrm; end if;
  end;
  v_ok := v_msg is not null and v_msg like '%nao se descarta%' and v_msg like '%ignorar%';
  if not coalesce(v_ok, false) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [L19] pergunta de preco tinha que ser recusada com motivo e caminho (ignorar). Obtido: '
             || coalesce(v_msg, '(nenhuma mensagem)');
  end if;

  -- @@secao Q
  -- ══ Q. D20 — O PRECO MUITO ABAIXO DA TABELA VIRA PERGUNTA (12/09/2026) ═══════
  -- Decisao do dono: "sim, o preco muito abaixo vira pergunta". Preco que casou e
  -- ficou abaixo do menor da tabela gravada / fator do outlier vira pergunta de
  -- `preco` (`abaixo da tabela: ...`) e SAI do calculo do outlier. A resposta
  -- `confirmar` vale so para esta lista (como o `definir` da D14), e `ignorar`
  -- desfaz. Migration: supabase/migrations/20260912_calc_d20_preco_abaixo_da_tabela.sql.
  --
  -- Tudo numa subtransacao: a tabela gravada vira SINTETICA (iPhone 16 128GB
  -- Lacrado a R$ 4.000) so aqui dentro, e o `raise` desfaz. As medidas saem em
  -- `v_qr` e as assercoes rodam depois, fora dela.
  v_qlog := null;
  begin
    update public.calc_dados set dados = jsonb_set(dados, '{produtos}',
      '[{"n":"iPhone 16 128GB","c":"iPhone","t":"Lacrado","f":"Loja Prova","l":"x","v":4000}]'::jsonb)
     where tenant_id = v_tenant;
    v_hh := privado.calc_parse_v2(v_tenant, v_txh);
    select q->>'texto' into v_hk from jsonb_array_elements(v_hh->'pendencias') q
     where q->>'texto' like 'abaixo da tabela:%';
    v_hh2 := privado.calc_parse_v2(v_tenant, v_txh, '{}'::jsonb, '{}'::text[], array[v_hk]);

    execute 'set local role authenticated';
    v_kf := public.calc_carga_abrir(v_txh);
    execute 'reset role';
    select id into v_preco from public.calc_pendencia
     where carga_id = v_kf and texto like 'abaixo da tabela:%';
    execute 'set local role authenticated';
    perform public.calc_pendencia_resolver(v_preco, 'confirmar', null);
    execute 'reset role';
    select v_qr || jsonb_build_object(
             'conf_casou', k.n_casou,
             'conf_n', (k.resumo->>'n_preco_confirmado')::int,
             'conf_300', exists (select 1 from jsonb_array_elements(k.blob_proposto->'produtos') px,
                                               jsonb_array_elements(coalesce(px->'cs','[]'::jsonb)) cx
                                  where px->>'f' like 'J%' and (cx->>'v')::numeric = 300))
      into v_qr from public.calc_carga k where k.id = v_kf;

    execute 'set local role authenticated';
    perform public.calc_pendencia_resolver(v_preco, 'ignorar', null);
    execute 'reset role';
    select v_qr || jsonb_build_object(
             'ign_n', (k.resumo->>'n_preco_confirmado')::int,
             'ign_4100', exists (select 1 from jsonb_array_elements(k.blob_proposto->'produtos') px,
                                               jsonb_array_elements(coalesce(px->'cs','[]'::jsonb)) cx
                                  where px->>'f' like 'J%' and (cx->>'v')::numeric = 4100))
      into v_qr from public.calc_carga k where k.id = v_kf;

    begin
      execute 'set local role authenticated';
      perform public.calc_pendencia_resolver(v_preco, 'descartar', null);
      v_qr := v_qr || jsonb_build_object('descartar', 'ACEITOU descartar a pergunta abaixo da tabela');
    exception when others then
      v_qr := v_qr || jsonb_build_object('descartar', sqlerrm);
    end;
    execute 'reset role';

    execute 'set local role authenticated';
    v_kf2 := public.calc_carga_abrir(
         E'[12/09/2026, 10:00:00] Vini: Junior recreio\n'
      || E'iPhone 16 128GB Preto Lacrado - 4.100 a vista\n');
    execute 'reset role';
    begin
      execute 'set local role authenticated';
      perform public.calc_pendencia_resolver(
        (select id from public.calc_pendencia where carga_id = v_kf2 and tipo = 'preco' limit 1),
        'confirmar', null);
      v_qr := v_qr || jsonb_build_object('outra', 'ACEITOU confirmar a condicao pendurada');
    exception when others then
      v_qr := v_qr || jsonb_build_object('outra', sqlerrm);
    end;
    execute 'reset role';
    raise exception 'prova_rollback';
  exception when others then
    if sqlerrm <> 'prova_rollback' then v_qlog := sqlerrm; end if;
  end;
  execute 'reset role';

  -- Q1. Sem confirmacao: o R$ 300 vira pergunta e o R$ 4.100 ENTRA. Antes da D20 o
  --     300 era o menor e o 4.100 saia como outlier, o estrago da primeira lista real.
  v_total := v_total + 1;
  if v_qlog is not null
     or (v_hh->>'n_lidas')::int <> 2 or (v_hh->>'n_casou')::int <> 1 or (v_hh->>'n_duvidoso')::int <> 1
     or v_hk is null
     or not exists (select 1 from jsonb_array_elements(v_hh->'produtos') p, jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) c
                     where p->>'n' = 'iPhone 16 128GB' and (c->>'v')::numeric = 4100)
     or exists (select 1 from jsonb_array_elements(v_hh->'produtos') p
                  left join lateral jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) c on true
                 where coalesce((c->>'v')::numeric, (p->>'v')::numeric) = 300) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [Q1] D20: o preco abaixo da tabela nao virou pergunta, ou expulsou o preco certo. Leitura: lidas '
             || coalesce(v_hh->>'n_lidas','?') || ' casou ' || coalesce(v_hh->>'n_casou','?')
             || ' duvidoso ' || coalesce(v_hh->>'n_duvidoso','?') || ' chave ' || coalesce(v_hk,'(nenhuma)')
             || ' produtos ' || coalesce((v_hh->'produtos')::text,'?') || ' erro ' || coalesce(v_qlog,'(nenhum)');
  end if;

  -- Q2. Confirmado no leitor (`p_precos_ok`): o preco entra e o contador diz de onde.
  v_total := v_total + 1;
  if coalesce((v_hh2->>'n_preco_confirmado')::int, 0) <> 1
     or not exists (select 1 from jsonb_array_elements(v_hh2->'produtos') p
                      left join lateral jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) c on true
                     where coalesce((c->>'v')::numeric, (p->>'v')::numeric) = 300) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [Q2] D20: o preco confirmado nao entrou pelo leitor, ou n_preco_confirmado nao contou. Obtido: '
             || coalesce(v_hh2::text, '(nada)');
  end if;

  -- Q3. Pela RPC, com a identidade do dono: `confirmar` poe a linha e a releitura
  --     guarda a resposta.
  v_total := v_total + 1;
  if v_qlog is not null or coalesce((v_qr->>'conf_n')::int, 0) <> 1
     or not coalesce((v_qr->>'conf_300')::boolean, false) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [Q3] D20: confirmar pela RPC nao pos o preco na tabela desta lista. Medido: '
             || v_qr::text || ' erro ' || coalesce(v_qlog,'(nenhum)');
  end if;

  -- Q4. `ignorar` depois de `confirmar` desfaz: o contador volta a 0 e o preco certo
  --     volta a ser o da tabela.
  v_total := v_total + 1;
  if coalesce((v_qr->>'ign_n')::int, -1) <> 0 or not coalesce((v_qr->>'ign_4100')::boolean, false) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [Q4] D20: ignorar depois de confirmar nao desfez. Medido: ' || v_qr::text;
  end if;

  -- Q5. As travas: a pergunta abaixo da tabela nao se DESCARTA (T5 segue valendo), e
  --     `confirmar` nao vale para outra pergunta de preco (a de condicao pendurada).
  v_total := v_total + 1;
  if coalesce(v_qr->>'descartar','') not like '%nao se descarta%'
     or coalesce(v_qr->>'outra','') not like '%confirmar so vale para pergunta de preco abaixo da tabela%' then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [Q5] D20: descartar a pergunta abaixo da tabela, ou confirmar outra pergunta de preco, nao foi recusado. Medido: '
             || v_qr::text;
  end if;

  -- @@relatorio
  -- Cada linha de sumario pertence a UM arquivo gerado, pelo marcador acima
  -- dela. Juntas, as tres dizem o que este relatorio diz.
  raise exception E'%',
    case when v_falhas = 0
         then 'PASSOU: ' || v_total || ' assercoes, 0 falhas (prova_calc_catalogo)'
  -- @@relatorio catalogo
              || E'\n  fixture E (dia 1, criar), v2: lidas=' || (v_ee->>'n_lidas')
              || ' casou=' || (v_ee->>'n_casou')
              || ' pendencias=' || (v_ee->>'n_pendencia')
              || E'\n  verbo criar (2.4a): XPTO = 1 fornecedor + 3 apelidos num clique;'
              || ' MP Distribuidora recusado por quase-igual ao MP Imports;'
              || ' JBL Flip 7 so entra com a categoria; tudo com origem=aprendizado'
              || E'\n  D17 (a): criar o 1o fornecedor da fixture E fica em casou '
              || coalesce(v_k13::text,'?')
              || ' (era 4): as 3 perguntas do XPTO seguem de pe, e nenhum preco dele entra no nome do MP;'
              || ' a mensagem IGNORADA nao volta pelo nome do fornecedor criado por outra grafia'
              || E'\n  D18: descartar fornecedor tira o BLOCO nas quatro formas de cabecalho'
              || ' (acento, asterisco e espaco duplo, formato bloco, ASCII em linha),'
              || ' e o padrao ancorado nao come mais a linha `- 5.400 PROMO` do fornecedor de cima;'
              || ' as 5 regras de semente com acento foram regravadas na normalizacao do leitor'
              || E'\n  D20: R$ 300 contra a tabela de R$ 4.000 vira pergunta e o R$ 4.100 entra (antes era expulso);'
              || ' confirmado entra so nesta lista; ignorar desfaz'
  -- @@relatorio fim
         else 'REPROVOU: ' || v_falhas || ' de ' || v_total || ' assercoes falharam (prova_calc_catalogo)' || v_log
    end;
end;
$prova$;
