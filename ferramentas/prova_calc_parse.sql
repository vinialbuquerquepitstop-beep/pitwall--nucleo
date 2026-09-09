-- prova_calc_parse.sql — assere o motor de leitura de lista de fornecedor
-- (privado.calc_parse), entregue no Bloco 2.2 do plano
-- docs/superpowers/plans/2026-09-05-calculadora-produto.md
--
-- COMO RODAR: cole no SQL Editor do Supabase, ou por MCP.
-- O bloco TERMINA EM `raise exception` de proposito: a transacao inteira volta
-- e nada e gravado em producao. Sucesso = a excecao final dizer PASSOU.
--
-- A lista usada e SINTETICA, escrita a mao para o teste. Restricao global 8 do
-- plano: nenhum export de fornecedor entra no repo, nem como corpus de teste.
-- Os nomes de modelo e fornecedor sao do catalogo do proprio tenant; os PRECOS
-- sao inventados e nao correspondem a tabela de ninguem.

do $prova$
declare
  v_tenant uuid := '00000000-0000-0000-0000-000000000001';
  v_txt    text;
  v_r      jsonb;
  v_falhas int := 0;
  v_total  int := 0;
  v_log    text := '';
begin
  -- ── a lista sintetica ─────────────────────────────────────────────────────
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

  v_r := privado.calc_parse(v_tenant, v_txt);

  -- ── helper de assercao, em linha (plpgsql nao tem funcao aninhada) ────────
  -- Cada bloco abaixo soma 1 em v_total e, se falhar, soma 1 em v_falhas e
  -- anota o motivo. O relatorio sai inteiro, nao para no primeiro erro: parar
  -- no primeiro esconde os outros e custa uma rodada por defeito.

  -- 1. O carimbo do WhatsApp nao vira cabecalho de fornecedor.
  --    Se `Vini` (o remetente) virasse fornecedor, todo preco seria dele.
  v_total := v_total + 1;
  if (v_r->'cabecalhos')::text ilike '%"fornecedor": "vini"%' then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  o remetente do WhatsApp virou fornecedor';
  end if;

  -- 2. CPO ganha de Lacrado na MESMA linha (calc_regra.prioridade 10 x 20).
  --    Foi a inversao que gerou 341 produtos com zero CPO em 27/07/2026.
  v_total := v_total + 1;
  if not exists (
    select 1 from jsonb_array_elements(v_r->'produtos') p
     where p->>'n' = 'iPhone 15 Pro 256GB' and p->>'t' = 'CPO') then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  linha com cpo E lacrado nao virou CPO';
  end if;

  -- 3. Descarte NAO vira preco e NAO vira pendencia: vira descarte contado.
  v_total := v_total + 1;
  if exists (
    select 1 from jsonb_array_elements(v_r->'produtos') p,
                  jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) c
     where (c->>'v')::numeric = 3200 or (c->>'v')::numeric = 6100) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  aparelho com mensagem ou caixa aberta virou preco';
  end if;

  v_total := v_total + 1;
  if (v_r->>'n_descarte')::int < 2 then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  os dois descartes nao foram contados (obtido '
             || (v_r->>'n_descarte') || ')';
  end if;

  -- 4. Cor por apelido: PURPLE -> Lilas, com o hex do catalogo, nunca inventado.
  v_total := v_total + 1;
  if not exists (
    select 1 from jsonb_array_elements(v_r->'produtos') p,
                  jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) c
     where c->>'n' = 'Lilás' and c->>'h' = '#7b6b9e') then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  o apelido de cor PURPLE nao virou Lilás com o hex do catalogo';
  end if;

  -- 5. Cor DECORADA vira UMA pendencia de COR, agrupada, nunca uma por linha.
  --    `VERDE MENTA` contem `verde` como palavra inteira: sem esta trava a cor
  --    desconhecida entrava com o hex de outra cor, calada, violando o
  --    "nunca inventar hex sem avisar". As duas linhas tem que dar n_linhas=2
  --    numa pendencia so, e o tipo tem que ser `cor` (nao `modelo`: o modelo
  --    casou, quem nao casou foi a cor).
  v_total := v_total + 1;
  if not exists (
    select 1 from jsonb_array_elements(v_r->'pendencias') p
     where p->>'tipo' = 'cor' and p->>'texto' = 'verde menta'
       and (p->>'n_linhas')::int = 2) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  cor decorada nao gerou UMA pendencia de cor com as 2 linhas';
  end if;

  -- 5b. E a cor decorada NAO pode ter entrado no blob com o hex do Verde.
  v_total := v_total + 1;
  if exists (
    select 1 from jsonb_array_elements(v_r->'produtos') p,
                  jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) c
     where p->>'n' in ('iPhone 13 128GB','iPhone 13 256GB')) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  a cor decorada entrou no blob com hex de outra cor';
  end if;

  -- 5c. Pendencia de modelo desconhecido agrupa SEM o preco na chave, senao
  --     cada preco vira uma decisao e o dia 1 fica inviavel.
  v_total := v_total + 1;
  if exists (
    select 1 from jsonb_array_elements(v_r->'pendencias') p
     where p->>'tipo' = 'modelo' and p->>'texto' ~ '[0-9][.,][0-9]{3}') then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  a chave da pendencia de modelo ainda carrega o preco';
  end if;

  -- 6. Android com a regra DESLIGADA nao e descarte: e pendencia.
  --    O dono aceitou ~6 pendencias por carga para nao perder o aparelho.
  v_total := v_total + 1;
  if not exists (
    select 1 from jsonb_array_elements(v_r->'pendencias') p
     where p->>'exemplo' ilike '%Poco F8%') then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  Android com regra desligada nao virou pendencia';
  end if;

  -- 7. Cabecalho desconhecido QUEBRA o bloco. As linhas dele nao podem sair
  --    com o nome do fornecedor anterior: preco certo no fornecedor errado
  --    passa no validador e so aparece quando alguem compra pelo custo de
  --    outra loja.
  v_total := v_total + 1;
  if exists (
    select 1 from jsonb_array_elements(v_r->'produtos') p
     where p->>'n' = 'iPhone 17 256GB') then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  linha de cabecalho desconhecido virou preco de outro fornecedor';
  end if;

  v_total := v_total + 1;
  if not exists (
    select 1 from jsonb_array_elements(v_r->'pendencias') p
     where p->>'tipo' = 'fornecedor' and p->>'texto' ilike '%XPTO%') then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  cabecalho desconhecido nao virou pendencia de fornecedor';
  end if;

  -- 8. Banner de condicao (SEMINOVOS) NAO troca o fornecedor do bloco.
  v_total := v_total + 1;
  if not exists (
    select 1 from jsonb_array_elements(v_r->'produtos') p
     where p->>'n' = 'iPhone 12 128GB' and p->>'t' = 'Seminovo'
       and p->>'f' = 'Cristiano') then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  o banner SEMINOVOS quebrou o bloco do Cristiano ou nao deu a condicao';
  end if;

  -- 9. Mac por rotulo, sem polegada escrita: deducao Air = 13" (formato-dados 4b).
  v_total := v_total + 1;
  if not exists (
    select 1 from jsonb_array_elements(v_r->'produtos') p
     where p->>'n' = 'MacBook Air M4 13" 16/256GB') then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  Air sem polegada escrita nao caiu em 13" (16GB Memoria / 256GB Armazenamento)';
  end if;

  -- 10. Mac COM polegada escrita respeita a polegada, nao cai na deducao.
  v_total := v_total + 1;
  if not exists (
    select 1 from jsonb_array_elements(v_r->'produtos') p
     where p->>'n' = 'MacBook Air M4 15" 16/256GB') then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  Air 15" escrito nao casou com o canonico de 15"';
  end if;

  -- 11. Outlier: 5.100 contra menor 2.570 na mesma combinacao (fator 1.6).
  --     Pegou um iPad lido a 5.100 quando o menor real era 2.570.
  v_total := v_total + 1;
  if exists (
    select 1 from jsonb_array_elements(v_r->'produtos') p,
                  jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) c
     where p->>'n' = 'iPad 11 128GB' and (c->>'v')::numeric = 5100) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  o outlier de 5.100 entrou no blob';
  end if;

  -- 12. Condicao pendurada ("a vista") vira pendencia, nunca preco:
  --     a calc nao tem onde guardar condicao, e ignora-la e mentir sobre o preco.
  v_total := v_total + 1;
  if exists (
    select 1 from jsonb_array_elements(v_r->'produtos') p,
                  jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) c
     where (c->>'v')::numeric = 4700) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  preco com condicao pendurada entrou no blob';
  end if;

  -- 13. Preco: as tres formas (4.299 / R$ 3.100,00 / token malformado) leem certo.
  v_total := v_total + 1;
  if privado.calc_preco('iPhone 16 128GB Preto Lacrado - 4.299') <> 4299 then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  preco 4.299 nao leu 4299';
  end if;
  v_total := v_total + 1;
  if privado.calc_preco('iPhone 14 128GB Azul Seminovo R$ 3.100,00') <> 3100 then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  preco R$ 3.100,00 nao leu 3100';
  end if;

  -- 14. A capacidade NAO pode ser lida como preco, e o modelo NAO pode ser
  --     lido como polegada. Sao as duas armadilhas do `\y`.
  v_total := v_total + 1;
  if privado.calc_preco('iPhone 16 256GB') is not null then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  linha sem preco devolveu preco (leu a capacidade como dinheiro)';
  end if;
  v_total := v_total + 1;
  if privado.calc_polegada_canon('iPhone 16 256GB') is not null then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  o numero do modelo do iPhone 16 foi lido como polegada';
  end if;
  v_total := v_total + 1;
  if privado.calc_polegada_canon('MacBook Air M4 13" 16/256GB') <> 13 then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  a polegada marcada do MacBook nao foi lida';
  end if;

  -- 14b. `novo` NAO pode casar dentro de `seminovo`. Sem fronteira de palavra
  --      a regra `lacrado|novo` (prioridade 20) engolia `seminovo` (30) e TODA
  --      linha de seminovo era gravada como Lacrado, misturando as duas
  --      tabelas. Mesma classe do CPO invertido de 27/07/2026.
  v_total := v_total + 1;
  if not exists (
    select 1 from jsonb_array_elements(v_r->'produtos') p
     where p->>'n' = 'iPhone 14 128GB' and p->>'t' = 'Seminovo') then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  linha escrita "Seminovo" foi gravada como outra condicao';
  end if;

  -- 14c. Preco com PONTO decimal (o que a regra de token 4,850,00 produz) nao
  --      pode sumir. Ele sumia inteiro: nao entrava no blob e nao virava
  --      pendencia. Linha que some e pior que linha que erra.
  v_total := v_total + 1;
  if not exists (
    select 1 from jsonb_array_elements(v_r->'produtos') p,
                  jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) c
     where p->>'n' = 'iPhone 15 128GB' and (c->>'v')::numeric = 4850) then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  o preco com ponto decimal (4850.00) nao entrou no blob';
  end if;

  -- 15. Cobertura e MEDIDA, e o denominador e coerente.
  v_total := v_total + 1;
  if (v_r->>'n_lidas')::int = 0
     or (v_r->>'n_casou')::int > (v_r->>'n_lidas')::int then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  cobertura incoerente: casou '
             || (v_r->>'n_casou') || ' de ' || (v_r->>'n_lidas');
  end if;

  -- 16. Todo produto do blob passa no que validarDados() exige, senao a carga
  --     derruba a calc INTEIRA, nao so aquela linha.
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
    v_log := v_log || E'\n  FALHA  produto proposto nao passa em validarDados()';
  end if;

  -- 17. Produto nunca tem `v` E `cs` ao mesmo tempo.
  v_total := v_total + 1;
  if exists (select 1 from jsonb_array_elements(v_r->'produtos') p
              where p ? 'v' and p ? 'cs') then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  produto saiu com v e cs juntos';
  end if;

  -- 18. O TETO DA FIXTURE. Esta lista e um circuito de armadilhas, nao uma
  --     carga representativa: das 18 linhas lidas, SETE foram escritas para
  --     falhar de proposito (2 de cor decorada, 1 Android, 2 de cabecalho
  --     desconhecido, 1 de condicao pendurada, 1 outlier). O teto atingivel e
  --     portanto 11, e a cobertura de 61,1% aqui NAO diz nada sobre o portao de
  --     89% do bloco, que so a carga real do dono mede.
  --     O que esta assercao cobra e casar TUDO o que era possivel casar.
  v_total := v_total + 1;
  if (v_r->>'n_casou')::int <> 11 then
    v_falhas := v_falhas + 1;
    v_log := v_log || E'\n  FALHA  casou ' || (v_r->>'n_casou')
             || ' das 11 linhas atingiveis desta fixture';
  end if;

  raise exception E'%',
    case when v_falhas = 0
         then 'PASSOU: ' || v_total || ' assercoes, 0 falhas'
              || E'\n  medido: lidas=' || (v_r->>'n_lidas')
              || ' casou=' || (v_r->>'n_casou')
              || ' duvidoso=' || (v_r->>'n_duvidoso')
              || ' nao_reconhecido=' || (v_r->>'n_nao_reconhecido')
              || ' descarte=' || (v_r->>'n_descarte')
              || ' cobertura=' || (v_r->>'cobertura') || '%'
         else 'REPROVOU: ' || v_falhas || ' de ' || v_total || ' assercoes falharam' || v_log
    end;
end;
$prova$;
