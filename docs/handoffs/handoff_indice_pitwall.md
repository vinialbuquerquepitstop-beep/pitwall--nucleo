# Indice mestre de handoffs do Pit Wall

Aponta o TOPO (maior N) de cada linha de dominio. A Torre atualiza este arquivo ao
fim de todo processo. Estado conferido em 28/07/2026 com `git ls-files`, nao
copiado de documento: as fontes do time citavam `migracao v41` e `seguranca v1`, e
nenhuma das duas batia com o repo.

## Linha migracao (fio historico principal)

- topo: `handoff_migracao_pitwall_v56.md` (13/08/2026, **a atmosfera da aba
  Conteudo estava pronta, verde e INVISIVEL para a suite**. Bandeja tingida,
  cartao branco com sombra e azul nos rotulos de grupo estavam na copia de
  trabalho sem commit, com as seis suites em EXIT 0 — e elas dariam EXIT 0 com a
  mudanca inteira revertida, porque as 415 assercoes do harness nao olhavam para
  nenhum pixel da aba. Escritas **11 assercoes de cor computada** (426 no total),
  e elas acharam o defeito: **a justificativa medida falava do elemento errado**.
  O comentario do CSS e o da prova diziam que o cartao branco resgatava a barra de
  nivel de 2.83/2.85/2.85 para o alvo de 3:1, mas na aba Conteudo o bloco "a barra
  diz o TIPO" (`app.css:1269-1274`) sobrescreve as seis regras de nivel escritas
  antes, e a barra e sempre `--tp` — medido no Chrome, `rgb(91, 75, 168)` =
  `--tp-reels`. Os tokens de nivel como barra vivem em `.card`, na Fila, que ja era
  branco desde antes; e `--tp` mede 4.24 a 6.50 sobre a bandeja, ou seja passaria
  tingido tambem. O cartao branco continua certo por GRAMATICA (chao tingido +
  cartao que flutua, igual Hoje e Fila), nunca por contraste. Os dois textos
  corrigidos com a correcao nomeada, e a medida virou reexecutavel (bloco 2a da
  `prova_atmosfera.py`, que reprova se `--tp` cair de 3:1 sobre a bandeja). A
  assercao tambem pegou o cartao `nivel-vencido`, que tinge de proposito desde
  antes e ganhou assercao propria em vez de a mira mudar em silencio. Prova de
  mutacao em copia: 3 mutacoes, 3 reprovacoes nomeadas, EXIT 1 nas duas suites.
  `prova_atmosfera.py` versionada; `CLAUDE.md` corrigido de TRES provas / 133
  assercoes para os SEIS comandos / 426. Aberto: o "plano" citado na prova nao
  existe em disco, `.cont-card::before` 1151-1156 e CSS morto, `.gitattributes`
  segue faltando na quinta sessao, e a Fatia 2 do molde — urgencia na grade — nao
  comecou.)
- anterior: `handoff_migracao_pitwall_v55.md` (13/08/2026, **a Fatia B do Escopo
  estava construida e NAO PROVADA**. O grafico vertical de abandono mais o seletor
  de urgencia ja estavam escritos nos quatro arquivos, sem commit, e **nenhuma das
  24 assercoes do criterio de aceite tinha sido rodada**. Esta sessao nao construiu
  funcionalidade: rodou o criterio inteiro e achou duas coisas erradas. **(1)
  Regressao de mobile**: `.esc-acao` e flex SEM `flex-wrap`, e o `<select>` de
  urgencia (min-width 104px) empurrou o botao `×` de descartar 13px para fora da
  tela em 360px, ou seja **inalcancavel no celular**. Provado com `git worktree` do
  HEAD limpo (HEAD EXIT 0, copia de trabalho EXIT 1), nao deduzido. Corrigido com
  uma propriedade, no padrao que `.esc-form` ja usava. **(2) A cor NAO separa os
  dois degraus de cima**: `prova_grafico.py` nao tinha UMA linha sobre abandono
  (grep devolvia 0), e os tres tokens tinham sido escolhidos no olho. Medido com
  `validate_palette.js` da skill dataviz: morno x quente da **ΔE 10,6 em visao
  normal** (piso 15), **ΔE 2,1 em deutan** e **1,01 de luminancia** — a mesma cor.
  Tokens NAO trocados (sao identidade calibrada do projeto; trocar e decisao do
  dono); o que sustenta a leitura e a ALTURA, e na fronteira 29 x 30 dias quem
  separa e SO a marca `30+` e a linha de corte. As duas viraram **alivio exigido em
  codigo**, e a prova foi **mutada em copia** para provar que morde (EXIT 1 com as
  duas mensagens). Tambem corrigi um erro meu de diagnostico: **o `app.js` tem DUAS
  regioes minificadas**, o nucleo IIFE na linha 1 (24.625 chars) e o roteador `A()`
  na 2058 (22.729) — procurar `data-acao` na linha 1 conclui errado que o patch nao
  foi aplicado. Provas: **harness 394/0**, validar, trilho, grafico, `node --check`,
  **diag_mobile EXIT 0 nos cinco tamanhos**, e a prova SQL rodada pela primeira vez
  com **34 ok, 0 falhas** (inclusive a assercao 18, que sustenta o eixo: prioridade
  gera 0 evento e nao move `dias_parada`, com o contraste de que status ainda grava
  1). Integridade do minificado byte a byte contra o baseline. Pendencias: a cor
  dos degraus e decisao do dono; **CRLF pela QUARTA sessao seguida** e o
  `.gitattributes` segue sem existir; `diag_mobile` nao esta na suite padrao)
- anterior: `handoff_migracao_pitwall_v54.md` (12/08/2026, **o card de Insights ganhou
  memoria de tempo**. Pergunta do dono: "como fazer esse card seguir dando
  insights". A resposta nao era empilhar regra: as quatro do v53 olham so a janela
  atual e **se autodestroem** quando o dono age. Entraram **5 regras que comparam
  com a janela anterior**, a unica fonte que nao seca. **Zero banco** — reusa o
  `aAnt` que o `dvPainel` ja calculava para as setas dos KPIs e nunca passava para
  os insights. **O card tinha subido SEM PROVA NENHUMA**: o `harness.py` nao
  mencionava `.ins`, e as "352/0" do v53 nunca encostaram nele. Agora sao 14
  assercoes so ali, **366/0**, e nenhuma crava numero de agosto (cada expectativa
  e recalculada por fora do app, a partir do proprio fixture: a segunda conta).
  **A regra que da o tom: janela em curso NAO se compara pelo total** — no dia 12,
  agosto sempre "cai" contra julho inteiro. Volume vira ritmo por dia; taxa nao
  precisa. Medido: **bruto -63,4% contra ritmo -5,5%**. **A foto pegou de novo o
  que a suite verde nao pegava**: a faixa de KPI do topo marcava `−63,4%` enquanto
  o card ficava calado, duas contas do mesmo numero na mesma tela (a familia de
  defeito da conversao do v53). Nao mexi na faixa (formato aprovado pelo dono); o
  card passou a **declarar a divergencia**. `foto.py` ganhou 4o argumento
  (seletor clicado apos a aba), porque o estado que importa so existe depois de
  clicar `Mês` e era infotografavel. Pendencias: as duas regras de canal nao tem
  prova por limitacao do fixture (decisao consciente), e os sete cortes numericos
  seguem cravados no JS contra o espirito do invariante 11. **CRLF pela TERCEIRA
  sessao seguida**)
- anterior: `handoff_migracao_pitwall_v53.md` (12/08/2026, **a aba Dashboard ganhou um
  painel de Performance de Vendas** no formato de uma referencia externa que o dono
  trouxe depois de REPROVAR o primeiro mock: 12 cards (KPI com icone e variacao,
  rosca de canal, serie por mes, P&L, ranking, tabela de canal com conversao, rosca
  de status, margem por condicao, insights) e a coluna de valores da aba Vendas
  virou faixa de 5 cards. **Zero banco.** **A referencia estava com os numeros do
  dono e DOIS ROTULOS TROCADOS**: chamava de "Ticket Medio" o que era o LUCRO e de
  "Taxa de Conversao" o que era a MARGEM — conferir rotulo antes de copiar layout.
  Dos 13 paineis, 4 nao entraram e o motivo esta escrito DENTRO do card (trafego
  nao existe: o sistema nao tem analytics; devolucoes e impostos nao tem coluna;
  itens vendidos repetiria Vendas; linha diaria sobre 3 pontos e decoracao).
  **DUAS DECISOES DO DONO CONTRA A RECOMENDACAO**: a paleta da referencia entra ao
  pe da letra (quebra a regra dos 4 usos do azul da v3; mitigado com o prefixo
  `--d-` em todo hex novo) e mora nas duas telas. **A metrica errada desta vez foi
  a conversao**: venda/lead solto deu **133,3%**, e o KPI dizia 0,0% enquanto o
  rodape da tabela dizia 133,3% na MESMA tela — virou coorte. Cinco defeitos que so
  a FOTO pegou com a suite verde, e a armadilha nova: **`foto.py` so LE o HTML que
  o `harness.py` montou**, entao editar sem remontar produz foto IDENTICA e parece
  que a correcao falhou (agora ele ABORTA). Dois guard-rails do `diag_mobile`
  reescritos, nao calados — e foi o segundo que pegou um defeito real: documento a
  **361,06px** num viewport de 360, por `min-width:0` faltando. Harness **352/0 sem
  editar uma assercao**: os `data-cel` sobreviveram a troca de formato.
  Pendencia: **o drill-down do pedido original nao entrou**)
- anterior: `handoff_migracao_pitwall_v52.md` (12/08/2026, **a aba Vendas ganhou o
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
  mostrar R$ 24.750 onde o certo e R$ 16.350. **RESOLVIDA:** conferido na v_venda
  em 12/08/2026, a duplicata foi arquivada e a base bate em R$ 16.350 / 3 vendas)
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
