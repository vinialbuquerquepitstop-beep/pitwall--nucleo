# Indice mestre de handoffs do Pit Wall

Aponta o TOPO (maior N) de cada linha de dominio. A Torre atualiza este arquivo ao
fim de todo processo. Estado conferido em 28/07/2026 com `git ls-files`, nao
copiado de documento: as fontes do time citavam `migracao v41` e `seguranca v1`, e
nenhuma das duas batia com o repo.

## Linha migracao (fio historico principal)

- topo: `handoff_migracao_pitwall_v52.md` (12/08/2026, **a aba Vendas ganhou o
  dinheiro somado no topo**: graficos estreitos a esquerda, valores a direita,
  janela declarada. **Zero banco** — agrega as linhas que a tela ja carrega da
  `v_venda`, pela regra da secao 4 do v51, e trocar a janela custa zero chamada
  de rede. Levou TRES passadas do dono, e as duas correcoes dele valem mais que
  a obra: "graficos a esquerda e valores a direita, mais evidencia pra vazamento
  e margem" (que era problema de HIERARQUIA, nao de diagramacao: margem e
  vazamento viviam no pe da celula, a menor tipografia do bloco) e "graficos
  devem ser estreitos, use skill de frontend, esta desproporcional" (barras de
  **~289px** onde a cartilha manda no maximo 24 e diz que a sobra da faixa e ar).
  **O achado que vale mais que o painel**: por duas passadas eu argumentei com
  RAZAO DE CONTRASTE (WCAG) para decidir se duas fatias vizinhas se distinguem, e
  e a metrica errada — a certa e **ΔE em OKLab**, e o validador mostrou que a
  separacao para daltonismo PASSAVA o tempo todo. O que reprovava era cor lavada
  por opacidade, fora da banda de luminosidade. Isso forcou cortar **4 fatias
  para 3** (frete x taxas mediam ΔE 13.0, abaixo do piso de 15, e a cartilha diz
  que isso nao se resolve com codificacao secundaria). Dois bugs de layout que so
  a GEOMETRIA pegou: `grid-row` faltando (auto-placement sparse jogava os
  graficos para a linha de baixo) e media query nao acrescentando especificidade
  (`.vg-graf` perdia para `.vg-graf.g-vaza`, e no celular os dois graficos
  ficavam lado a lado). E um buraco de **200px** que so a FOTO pegou, com a suite
  verde. Harness **352/0**, prova nos dois sentidos reprovando 61x, e duas
  rodadas perdidas por assercao que ESTOUROU em vez de reprovar. `prova_grafico.py`
  nasceu. Pendencia herdada agora VISIVEL: a VENDA-0003 duplicada faz o painel
  mostrar R$ 24.750 onde o certo e R$ 16.350)
- anterior: `handoff_migracao_pitwall_v51.md` (11/08/2026, **clique de acao parou de
  recarregar a tela**. `q()` chamava `B()` (carga completa) no sucesso de
  qualquer acao: medido em fila de 25, **20 chamadas de rede por clique**, a
  lista piscando e **0 de 24 cards sobrevivendo**. Virou **2 chamadas**, sem
  piscar, **24 de 24** sobrevivendo, e o Historico aberto fica aberto. Quatro
  camadas: carga quieta, `aposAcao()` no lugar de `B()`, `trocarCard` relendo UMA
  linha por `.eq`, e o cache de sugestao sobrevivendo ao render. Achado do banco
  que definiu o desenho: `registrar_toque` grava `ultimo_toque_em`, entao o toque
  TIRA o lead da fila do dia. Harness **284/0**, e as 29 assercoes novas foram
  provadas nos dois sentidos: reprovam 12x no codigo antigo. Duas cegueiras do
  instrumento consertadas: o `.eq()` do stub nao filtrava, e nenhuma RPC de
  escrita de lead era stubada, entao o caminho de recarga nunca tinha sido
  testado. **No ar**: commit `9a6f7f8`, deploy conferido no worker por md5 dos
  tres arquivos. Armadilha nova anotada: `GET /index.html` no worker devolve 307,
  e comparar md5 desse caminho da hash de string vazia e parece divergencia)
- antes desse: `handoff_migracao_pitwall_v50.md` (11/08/2026, **a Fila SUBIU**: commit
  `87b65f9`, deploy conferido no worker por md5 e por diff de conteudo. A obra da
  v49 estava na arvore sem commit ha dois dias. Ganhou mais uma rodada de forma a
  pedido do dono: as duas fileiras de botao viraram UMA faixa, leitura na
  esquerda e escrita na direita. A separacao nao morreu, trocou de eixo, e o
  grupo `.acoes-escrita` mantem os dois botoes juntos na quebra. Medido nas duas
  versoes pelo mesmo script: **207px -> 170px** por card, 2 faixas -> 1, somando
  316 -> 170 com a v49. Harness **255/0** porque nasceu assercao nova, nao porque
  alguma afrouxou. Duas decisoes fora do pedido: as fotos de `docs/design/`
  carregam nome e telefone de cliente real e foram para o `.gitignore`, e o
  commit quase levou 5.313 linhas de ruido de CRLF pro repo)
- e antes: `handoff_migracao_pitwall_v49.md` (09/08/2026, a Fila virou linha de
  atendimento a partir de uma imagem de referencia do dono: avatar, nome +
  LEAD-code + telefone, colunas rotuladas PRODUTO e **ORIGEM** (que existia em
  19 dos 21 leads e nunca tinha aparecido na tela), e chip de estado a direita.
  O dono escolheu manter a operacao ABERTA embaixo da linha em vez do raio +
  kebab da imagem: 1px de filete em vez de um clique por lead. O chip de estado
  entrou depois de o dono corrigir a recusa inicial: o problema era a paleta
  (3 tons do mesmo azul, 2.08 entre si), nao o conceito. 4 estados, 4 matizes de
  token ja medido, tirados de coluna que a `v_lead` ja calculava. Numero
  inventado da imagem (LATENCY, LIVE_SYNC, Limpeza 100%) recusado de novo.
  254/0 no harness, 5 provas em EXIT 0. **Nao foi para o ar ainda.**
  Registra duas armadilhas do `foto.py`: ele reusa o HTML montado pelo harness,
  e mente em largura de celular)
- e antes ainda: `handoff_migracao_pitwall_v48.md` (08/08/2026, a forma do Stitch na Fila
  estava commitada ha dois dias e nunca tinha aparecido na tela: 16 regras de CSS
  penduradas num seletor que nao casava com nada, porque
  `patch_lista_data_aba.py` foi commitado e nunca rodado. As "8 falhas herdadas"
  que o v46 e o v47 dispensaram eram isso. 50 bytes + mover um botao levaram o
  harness de 239/8 para **247/0**, o primeiro zero em tres sessoes. Deploy
  conferido byte a byte no worker. Veredito item a item sobre o zip do Stitch:
  forma sim, paleta e numero inventado nao)
- e mais atras: `handoff_migracao_pitwall_v47.md` (08/08/2026, relatorio de entrega na
  aba Vendas + cadastro de motoboy com botao que despacha num toque. 6 migrations,
  1 tabela, 1 coluna, 43 assercoes novas que CLICAM. Os seis campos pedidos ja
  existiam na `venda`: a obra virou uma coluna e uma tela. Defeito da sessao: a
  suite travou calada por um `\n` mal escapado dentro da string Python do teste;
  nasce o watchdog do harness. **Cuidado ao ler:** ele trata as 8 vermelhas do
  harness como divida herdada, e o v48 provou que eram obra nao terminada)
- 49 arquivos na pasta. O de maior versao substitui todos os anteriores.

## Linha seguranca (pit-guard)

- topo: (vazio)
- NAO existe nenhum `handoff_seguranca_pitwall_vN.md` no repo. O
  `time_agentes_pitwall.md` afirmava que a v1 existia: nao existe aqui. O primeiro
  handoff desta linha nasce `v1`.

## Linha backend (base)

- topo: (vazio). Enquanto a migracao for o fio principal, o `base` pode seguir na
  linha migracao. Quando abrir esta linha, declarar no handoff qual escolheu.

## Linha frontend (vitrine)

- topo: (vazio)

## Linha qa (bandeira)

- topo: (vazio). A bandeira nao tem Write: ela entrega o texto e a Torre grava.

## Linhas ainda sem agente proprio

`dados` (modo Painel), `devops` (modo Box) e `produto` (modo Estrategista) rodam
como MODOS da Torre ate haver volume. Quando um modo virar agente, abrir a linha
aqui.

## Regra

Ao abrir sessao: ler este indice mais o topo da linha do dominio que a tarefa
toca. Nunca confiar so no que este arquivo diz: conferir a pasta. Esta linha ja
ficou desatualizada em todo documento deste projeto que tentou fixar uma versao.
