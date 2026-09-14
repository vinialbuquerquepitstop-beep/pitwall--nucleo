-- prova_calc_laco.sql — GERADO por ferramentas/gera_provas_calc.py. NAO EDITAR A MAO.
-- Fonte unica: ferramentas/prova_calc_parse.sql (md5 bfcd798e1b31c88368179de4c391db57).
-- Mudou a fonte, rode o gerador de novo: este arquivo e sobrescrito.
--
-- Secoes: G, Z, R, U. Fixtures: A, B, C, D.
-- Assercoes escritas: 39 (um laco pode executar mais de uma vez; o numero
-- que conta e o da mensagem, e a soma dos tres gerados e o total da fonte).
--
-- COMO RODAR por MCP: enxugar e colar a saida numa chamada SO de execute_sql.
--   python ferramentas/enxuga_sql.py ferramentas/prova_calc_laco.sql <saida.sql>
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
  v_txi    text;   -- fixture I: a orfa sem cor (13/09/2026)
  v_ii     jsonb;  -- a leitura dela
  v_ki     uuid;   -- a carga aberta com ela (secao O, revertida)
  -- secao S (13/09/2026: bandeira, iPhone sem nome, ciclo, cerca, com Apple, linha)
  v_txj    text;   -- fixture J
  v_jj     jsonb;  -- a leitura dela
  v_jnm    text;   -- o nome do fornecedor `junior`, como sai na coluna `f`
  -- secao U (13/09/2026: responder em lote)
  v_ku     uuid;   -- a carga da fixture A, aberta so dentro da secao
  v_pu1    uuid;   -- pergunta de fornecedor `TABELA XPTO IMPORTS`
  v_pu2    uuid;   -- pergunta de modelo do Poco
  v_pu3    uuid;   -- pergunta de cor `verde menta`
  v_un     int;    -- casou ao abrir
  v_ur     jsonb := '{}';  -- o que a secao U mediu dentro da subtransacao
  v_ulog   text;   -- erro inesperado dentro dela
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

  -- @@fixture D
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

  -- @@preambulo
  -- O gerador leva cada linha daqui SO para o arquivo que le a variavel dela.
  v_cc := privado.calc_parse_v2(v_tenant, v_txc);
  v_dd := privado.calc_parse_v2(v_tenant, v_txd);

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

  -- @@secao G
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
  -- e o `raise` final desfaz as tres cargas junto com o resto. O `set_config`
  -- da identidade saiu daqui para o bloco `@@comum rpc` (12/09/2026).

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
            -- D18 acrescentou tres motivos declarados, e eles entram aqui pelo
            -- mesmo criterio dos outros: recusa so vale se for por motivo que o
            -- codigo DECLARA. `nao se descarta` cobre condicao (T4) e preco
            -- (T5); `nao aparece em nenhuma linha` e a guarda de medida da
            -- ancora; `nao tirou linha nenhuma` e a G4.
            if sqlerrm !~ '(nao existe no catalogo|nao ensina nada|condicao nao se ensina|apontar exige o destino|nao se ensina por apelido|nao se descarta|nao aparece em nenhuma linha|nao tirou linha nenhuma|nao sobra texto nenhum)' then
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

  -- @@secao Z
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

  -- @@secao R
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
          -- D20 (12/09/2026): o argumento `p_precos_ok` entrou, por DROP + CREATE.
          and pg_get_function_identity_arguments(p.oid) = 'p_tenant uuid, p_texto text, p_condicoes jsonb, p_forn_abertos text[], p_precos_ok text[]'
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
           -- D18: o padrao agora sai do texto NORMALIZADO e ancorado na linha
           -- inteira, e o descarte de FORNECEDOR fecha o bloco (escopo). Este
           -- e o vetor 14, o controle: ASCII em formato linha, o unico que ja
           -- funcionava, e por isso esta assercao passava sozinha.
           and exists (select 1 from public.calc_regra r
                        where r.tenant_id = v_tenant and r.tipo = 'descarte'
                          and r.padrao = '^tabela xpto imports$'
                          and r.escopo = 'fornecedor'
                          and r.origem = 'aprendizado')
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

  -- @@secao U
  -- ══ U. RESPONDER EM LOTE (13/09/2026) ═══════════════════════════════════════
  -- Migration: supabase/migrations/20260913_calc_responder_em_lote.sql. A lista de
  -- 17/08 levava 30 s por releitura, cada resposta relia tudo, e a primeira morreu
  -- no limite do banco. Agora a resposta e ANOTADA (conferida pelas travas de sempre,
  -- nao aplicada) e o lote aplica numa releitura so, tudo ou nada. Fixture A, com a
  -- carga aberta DENTRO de uma subtransacao desfeita no fim.
  begin
    execute 'set local role authenticated';
    v_ku := public.calc_carga_abrir(v_txt);
    execute 'reset role';
    select id into v_pu1 from public.calc_pendencia
     where carga_id = v_ku and tipo = 'fornecedor' and texto = 'TABELA XPTO IMPORTS';
    select id into v_pu2 from public.calc_pendencia
     where carga_id = v_ku and tipo = 'modelo' and texto like 'poco f8%';
    select id into v_pu3 from public.calc_pendencia
     where carga_id = v_ku and tipo = 'cor' and texto = 'verde menta';
    select n_casou into v_un from public.calc_carga where id = v_ku;

    -- (1) anotar confere e guarda, sem escrever no catalogo
    execute 'set local role authenticated';
    v_res := public.calc_pendencia_anotar(v_pu1, 'apontar', 'five_cell', null);
    execute 'reset role';
    v_ur := v_ur || jsonb_build_object('u1', v_res,
      'u1_alias', (select count(*) from public.calc_alias
                    where tenant_id = v_tenant and tipo = 'fornecedor' and texto = 'TABELA XPTO IMPORTS'),
      'u1_dec', (select decisao from public.calc_pendencia where id = v_pu1),
      'u1_rasc', (select rascunho->>'decisao' from public.calc_pendencia where id = v_pu1));

    -- (2) a trava de sempre recusa NA HORA
    begin
      execute 'set local role authenticated';
      perform public.calc_pendencia_anotar(v_pu2, 'apontar', 'nao_existe_prova', null);
      execute 'reset role';
      v_ur := v_ur || jsonb_build_object('u2', 'aceitou');
    exception when others then
      v_ur := v_ur || jsonb_build_object('u2', sqlerrm);
    end;
    execute 'reset role';

    -- (3) ignorar em pergunta aberta vale na hora, sem releitura
    execute 'set local role authenticated';
    v_res := public.calc_pendencia_anotar(v_pu3, 'ignorar', null, null);
    execute 'reset role';
    v_ur := v_ur || jsonb_build_object('u3', v_res,
      'u3_dec', (select decisao from public.calc_pendencia where id = v_pu3),
      'u3_casou', (select n_casou from public.calc_carga where id = v_ku));

    -- (4) uma culpada no lote (plantada direto: `confirmar` numa pergunta de modelo)
    update public.calc_pendencia set rascunho = '{"decisao":"confirmar"}'::jsonb where id = v_pu2;
    execute 'set local role authenticated';
    v_res := public.calc_carga_reler(v_ku);
    execute 'reset role';
    v_ur := v_ur || jsonb_build_object('u4_ok', v_res->'ok',
      'u4_alias', (select count(*) from public.calc_alias
                    where tenant_id = v_tenant and tipo = 'fornecedor' and texto = 'TABELA XPTO IMPORTS'),
      'u4_erro', (select rascunho_erro from public.calc_pendencia where id = v_pu2),
      'u4_rasc1', (select rascunho is not null from public.calc_pendencia where id = v_pu1));

    -- (5) sem a culpada, o lote aplica numa releitura
    execute 'set local role authenticated';
    perform public.calc_pendencia_anotar(v_pu2, null, null, null);
    v_res := public.calc_carga_reler(v_ku);
    execute 'reset role';
    v_ur := v_ur || jsonb_build_object('u5_ok', v_res->'ok', 'u5_aplicadas', v_res->'aplicadas',
      'u5_pend', v_res ? 'pendencias',
      'u5_alias', (select count(*) from public.calc_alias
                    where tenant_id = v_tenant and tipo = 'fornecedor' and texto = 'TABELA XPTO IMPORTS'),
      'u5_dec', (select decisao from public.calc_pendencia where id = v_pu1),
      'u5_rasc', (select rascunho is null from public.calc_pendencia where id = v_pu1),
      'u5_casou', (select n_casou from public.calc_carga where id = v_ku));
    raise exception 'prova_rollback';
  exception when others then
    if sqlerrm <> 'prova_rollback' then v_ulog := sqlerrm; end if;
  end;
  execute 'reset role';

  -- U1. Anotar guarda a resposta e nao escreve no catalogo.
  v_total := v_total + 1;
  if v_ulog is not null or not coalesce((v_ur->'u1'->>'anotada')::boolean, false)
     or coalesce((v_ur->>'u1_alias')::int, -1) <> 0 or v_ur->>'u1_dec' is not null
     or coalesce(v_ur->>'u1_rasc', '') <> 'apontar' then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [U1] lote: anotar escreveu no catalogo ou nao guardou a resposta. Medido: '
             || v_ur::text || ' erro ' || coalesce(v_ulog, '(nenhum)');
  end if;

  -- U2. Anotar recusa na hora com a trava do resolver.
  v_total := v_total + 1;
  if coalesce(v_ur->>'u2', '') not like '%nao existe no catalogo%' then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [U2] lote: anotar apontar para codigo inexistente nao foi recusado na hora. Obtido: '
             || coalesce(v_ur->>'u2', '(nada)');
  end if;

  -- U3. Ignorar em pergunta aberta vale na hora e nao muda a leitura.
  v_total := v_total + 1;
  if not coalesce((v_ur->'u3'->>'aplicada')::boolean, false) or coalesce(v_ur->>'u3_dec', '') <> 'ignorar'
     or (v_ur->>'u3_casou')::int is distinct from v_un then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [U3] lote: ignorar nao valeu na hora, ou mudou o casou. Medido: ' || v_ur::text;
  end if;

  -- U4. Uma culpada volta o lote inteiro: nada grava e ela fica marcada.
  v_total := v_total + 1;
  if coalesce(v_ur->>'u4_ok', '') <> 'false' or coalesce((v_ur->>'u4_alias')::int, -1) <> 0
     or coalesce(v_ur->>'u4_erro', '') not like '%confirmar so vale%'
     or not coalesce((v_ur->>'u4_rasc1')::boolean, false) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [U4] lote: com uma resposta recusada, algo gravou ou a culpada nao ficou marcada. Medido: '
             || v_ur::text;
  end if;

  -- U5. O lote bom aplica numa releitura, limpa a anotada e ensina (as 2 linhas do XPTO casam).
  v_total := v_total + 1;
  if coalesce(v_ur->>'u5_ok', '') <> 'true' or coalesce((v_ur->>'u5_aplicadas')::int, 0) <> 1
     or coalesce((v_ur->>'u5_alias')::int, 0) <> 1 or coalesce(v_ur->>'u5_dec', '') <> 'apontar'
     or not coalesce((v_ur->>'u5_rasc')::boolean, false)
     or (v_ur->>'u5_casou')::int is distinct from v_un + 2
     or coalesce((v_ur->>'u5_pend')::boolean, true) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  [U5] lote: a releitura em lote nao aplicou a resposta boa (esperado ok, 1 aplicada, apelido gravado, casou +2). Medido: '
             || v_ur::text || ' casou ao abrir ' || coalesce(v_un::text, '?');
  end if;

  -- @@relatorio
  -- Cada linha de sumario pertence a UM arquivo gerado, pelo marcador acima
  -- dela. Juntas, as tres dizem o que este relatorio diz.
  raise exception E'%',
    case when v_falhas = 0
         then 'PASSOU: ' || v_total || ' assercoes, 0 falhas (prova_calc_laco)'
  -- @@relatorio laco
              || E'\n  fixture D (condicao), v2: lidas=' || (v_dd->>'n_lidas')
              || ' casou=' || (v_dd->>'n_casou')
              || ' perguntas de condicao=' || (select count(*) from jsonb_array_elements(v_dd->'pendencias') q
                                                where q->>'tipo' = 'condicao')
              || E'\n  resolver: ' || v_n_aceitas || ' respostas aceitas (todas ensinaram), '
              || v_n_recusas || ' recusadas com motivo declarado, 0 aceitas caladas'
              || E'\n  respostas de condicao (D14): fixture C casou 0 -> ' || coalesce(v_rc::text,'?')
              || ' com "junior" = Lacrado; fixture D 11 -> ' || coalesce(v_rd::text,'?')
              || ' de 16 com as 5 respondidas'
              || E'\n  lote (U): anotar confere sem gravar, ignorar vale na hora, uma culpada volta o lote inteiro,'
              || ' e o lote bom aplica numa releitura so (casou ' || coalesce(v_un::text,'?') || ' -> '
              || coalesce(v_ur->>'u5_casou','?') || ')'
  -- @@relatorio fim
         else 'REPROVOU: ' || v_falhas || ' de ' || v_total || ' assercoes falharam (prova_calc_laco)' || v_log
    end;
end;
$prova$;
