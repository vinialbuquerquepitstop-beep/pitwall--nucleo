# Indice mestre de handoffs do Pit Wall

Aponta o TOPO (maior N) de cada linha de dominio. A Torre atualiza este arquivo ao
fim de todo processo. Estado conferido em 28/07/2026 com `git ls-files`, nao
copiado de documento: as fontes do time citavam `migracao v41` e `seguranca v1`, e
nenhuma das duas batia com o repo.

## Linha migracao (fio historico principal)

- topo: `handoff_migracao_pitwall_v68.md` (26/08/2026, **a Fatia 2 do modulo
  Financeiro: regras de classificacao automatica, 6 migrations e a quarta sub-view**).
  Sessao de retomada, disparada por "retorne o processo de financas, app caiu". O
  arranque achou DUAS linhas do v67 ja vencidas: a Fatia 1 estava commitada E publicada
  (`78be994` em `origin/main`), e a base **nao** estava vazia. O dono tinha importado um
  **OFX REAL** as 10:14 de 26/08: `181 lidas, 181 novas, 0 duplicadas`, janela 28/07 a
  26/08, soma liquida -R$ 29,06. Isso fechou a ressalva numero 1 do v67 sem uma linha de
  codigo. Os 181 estavam **100% sem classificar**, e a Fatia 2 nasceu 12 minutos depois
  da importacao: **as regras foram desenhadas contra o extrato de verdade**. Banco:
  tabela `fin_regra` (com `check` que recusa regra que nao classifica nada e indice
  unico sobre o padrao NORMALIZADO), 3 helpers privadas, 5 RPCs e **um motor unico**
  (`privado.fn_fin_aplicar_regras`) que serve o botao E a importacao, para as duas nunca
  divergirem. Sem `unaccent` de proposito (a extensao nao esta instalada; `fn_fin_norm`
  faz o servico com `translate`, e `IMMUTABLE` e serve no indice). Decisoes que valem
  registro: **a regra nasce de um lancamento real, nunca de formulario vazio**; o
  extrator pega o segmento imediatamente ANTES do CPF/CNPJ (pegar o segundo devolveria
  `Transferencia enviada pelo Pix` e **casaria metade do extrato**); `fin_regra_sugerir`
  **nao sugere categoria nem dominio**, porque inferir seria adivinhar (invariante 18);
  alcance default `nao_classificados` e sobrescrever exige confirmacao **com o numero**;
  previa obrigatoria que EXPIRA se a regra mudar; padrao que casa mais de 60% da base e
  recusado com o numero na cara e so passa com `forcar`; **nunca DELETE** (pausar e
  arquivar). **885 assercoes, 0 falhas** (piso 829, medido no commit `9649124`), os 6
  comandos e as 5 larguras em
  EXIT 0, rodados pela Torre na retomada. Isolamento PROVADO, nao so lido: o vendedor
  Brendon ve **0 linhas** em `fin_regra` e `fin_movimento` e leva `Financeiro e restrito
  ao dono.` nas 5 RPCs. **Commitado e publicado.** O que fica aberto: `fin_regra` tem
  **0 linhas**, entao a Fatia 2 ainda e capacidade e nao resultado, e a proxima acao e
  do dono (criar a primeira regra a partir de uma linha de UBER, que sozinho e 22 dos
  181). Segue aberto tambem o `LEDGERBAL` guardado e **nunca conferido** contra a soma
  dos movimentos, que e a checagem que pega importacao incompleta.
- anterior: `handoff_migracao_pitwall_v67.md` (25 e 26/08/2026, **a Fatia 1 do modulo
  Financeiro: 6 migrations e a aba na tela**). Disparado pelo pedido do dono de "um
  sistema financeiro completo", que era CINCO subsistemas e foi cortado em 6 fatias.
  Decisao central: **caixa e resultado sao verdades separadas e nunca se somam** (`venda`
  diz o resultado, `fin_movimento` diz o caixa; somar os dois dobraria o faturamento no
  dia em que o PIX do cliente virasse lancamento). Como o dono tem UMA conta bancaria com
  dinheiro da loja e pessoal misturados, nasceu o **invariante 18**: movimento sem
  `dominio` nao entra em total nenhum, e `dominio` nunca tem default silencioso. Banco: 4
  tabelas (`fin_conta`, `fin_categoria`, `fin_movimento`, `fin_importacao`), 33 categorias
  em 9 grupos, bucket privado `extrato`, 6 RPCs, 14 cenarios de prova com RLS valendo e
  desfeitos por exception (vendedor Brendon ve **0** nas 4 tabelas e leva recusa nas 6
  RPCs). Tela: aba `Financeiro` com Visao, Movimentos e Importar, parser de OFX no
  navegador com previa obrigatoria. **829 assercoes, 0 falhas** (piso 713), os 6 comandos
  e as 5 larguras em EXIT 0, conferidos pela Torre rodando a suite e nao lendo relatorio.
  Dois achados que valem mais que a entrega: o `base` **recusou a especificacao da Torre
  e estava certo** (o `hash_dedupe` como foi pedido engoliria o segundo de dois Uber de
  R$ 20 no mesmo dia, apagando dinheiro real em silencio; virou hash com **ocorrencia**),
  e a `vitrine` achou o **`diag_mobile.py` dando verde vazio** porque a lista `abasIds` e
  chumbada e nao continha a aba nova, entao a tela nunca era desenhada na medicao.
  Fechou dizendo **"nada commitado, nada publicado"** e **"nenhum OFX real foi
  testado, base com ZERO movimentos"**: as tres afirmacoes cairam no mesmo dia, e a
  correcao esta no v68. Detalhe do frontend na linha `vitrine` v1.
- anterior: `handoff_migracao_pitwall_v66.md` (19/08/2026, **a Fatia 2 inteira: a mesma
  pessoa parava de ser a mesma quando o telefone mudava de formato, e quem comprava
  nunca entrava na regua de pos-venda**). Disparado por um bug reportado em uma frase
  pelo dono. Nao era falta de trava: o `UNIQUE (tenant_id, whatsapp_digitos)` existia e
  **nunca chegou a ser consultado**, porque das TRES portas que escrevem telefone so
  duas canonicalizavam o DDI 55, e `editar_lead` nao. A trava virou indice por SUFIXO
  (`right(whatsapp_digitos, 11)`), parcial em `arquivado_em is null`, entao formato nao
  abre mais brecha e lead arquivado devolve o numero. Aretusa fundida sem perder a
  consulta do iPhone 14 512GB que so existia na duplicata. Ao medir o banco para
  responder qual seria a proxima fatia, apareceu o furo MAIOR: **`registrar_venda` nunca
  chamava `fn_cadencia_trocar_perfil`**, entao a Aretusa fechou R$ 4.300 e seguia em
  `avaliando R2 · D3` vencendo 20/08 (o sistema ia cobrar venda de quem ja comprou), e o
  motor de pos-venda **nunca recebia ninguem novo** — os 6 clientes travados no `P1`, o
  mais antigo ha 33 dias. Corrigido, com decisao registrada de que venda nova REINICIA o
  pos-venda no P1, e a recusa deliberada de usar trigger em `lead.perfil` (dispararia
  dentro de `fn_regua_varredura`). 5 migrations, **frontend intocado** (a suite de tela
  nao se aplica e nao foi rodada; o numero valido segue o da v65). 6 provas de dedupe e
  1 de ponta a ponta do pos-venda, todas como o dono autenticado com RLS valendo e
  desfeitas por exception. Licao da secao 7: **mudar o alcance de uma trava muda o
  significado de toda mensagem que fala sobre ela** — a prova pegou, a leitura do codigo
  nao teria pego. Commits `3fa53f8` e `9b17b52`. Em 20/08 a **Fatia 3
  tambem entrou** (`c80fdaa`), e metade dela ja existia: o botao de um clique no
  Pitscare estava no ar desde o `7d5f3f9`, e `sugerir_mensagem` ja atendia o perfil
  `comprou` com P1 a P6 — o v65 listou esse item como pendente por engano e ele NAO foi
  reconstruido. O furo real, visivel so lendo os nove textos, era que indicacao so era
  pedida no **P4 (D90)** e o **P3 (D30) nao pedia NADA**, justamente onde o cliente esta
  mais satisfeito. As tres variantes do P3 foram reescritas com o cuidado antes do
  pedido. Sobra a **Fatia 4** (repescagem por evento).
- anterior: `handoff_migracao_pitwall_v65.md` (19/08/2026, **auditoria do CRM contra o
  banco vivo, e a Fatia 1: a Fila deixou de ser lista e virou decisao**). Oito furos
  medidos, ranqueados por dinheiro perdido: mediana de **118h ate o primeiro toque**
  com ZERO leads tocados em menos de 24h; **0 toques de pos-venda na historia do
  sistema** com 6 clientes entregues parados em `P1 · D1`; a fila ordenando por data e
  desempatando por ordem ALFABETICA. Construida a Fatia 1: `v_lead` ganhou 7 colunas
  DERIVADAS na leitura (`toques`, `respostas`, `toques_sem_resposta`, `valor_em_jogo`,
  `duplicata_de`, `veredito`, `veredito_ordem`, `veredito_motivo`) e a fila passou a
  ordenar por veredito, depois por dinheiro, depois por data. Nenhuma coluna nova em
  tabela, nenhuma escrita nova, nenhuma mudanca de fetch (o app ja lia `select("*")`).
  Suite de **691 para 713 assercoes**, 0 falhas, as 22 novas provadas por MUTACAO.
  Duas licoes caras registradas na secao 3: a regra de `pare` que usava `dias_silencio`
  era INALCANCAVEL (o silencio reinicia a cada toque do proprio operador, entao passou
  a contar pelo primeiro toque); e a classe `vd` COLIDIU com o bloco de Detalhes da
  venda da v61 (`display:none`), o chip sumiu da tela e **a suite ficou VERDE**, porque
  `getComputedStyle` devolve a cor certa de elemento `display:none` — quem pegou foi a
  foto. Ha agora assercao de CAIXA, nao so de cor. Fatias 2 (dedupe e re-ancora de
  perfil), 3 (pos-venda de um clique + pedido de indicacao) e 4 (repescagem por evento)
  estao especificadas e NAO construidas.
- anterior: `handoff_migracao_pitwall_v64.md` (19/08/2026, **a aba Hoje refeita sobre
  a referencia visual do Stitch, e as pendencias que estavam escondidas em cinco
  abas**. Frontend puro: zero migration, zero RPC nova. O layout saiu de duas colunas
  verticais fixas (~600px de branco medidos, grafico espremido em 1/3) para a grade de
  4 unidades do Dashboard. O placar de 4 celulas saiu por ordem do dono e o progresso
  da rotina herdou o lugar no cabecalho da secao, com `hojePlacarAtualiza()` religada
  nele. Entrou a secao **Pendencias**, sete contagens derivadas na leitura com botao
  que leva a aba onde se resolve. O que o mock pedia sem lastro foi barrado ("Google
  Ads", +12%/+8,5% inventados, alerta por hora). Duas medicoes mudaram decisao de cor:
  quente/morno/frio tem contraste **1.00 a 1.01 ENTRE SI** (dai os 3px de respiro na
  barra da Temperatura), e a serie de venda saiu do azul para `--ok`. **Excecao viva na
  regra 11.1: `SERIE_E_ACAO_HOJE` no `validar.py`**, decisao consciente do dono.)
- anterior: `handoff_migracao_pitwall_v63.md` (18/08/2026, **frontend puro: o numero
  abriu venda a venda, e a regra de so contar venda concluida enfim chegou ao ar**.
  Duas ordens do dono no mesmo dia, que sao a mesma ordem. Os cards faturamento e
  lucro ganharam `detalhar`: a soma abre dentro da propria faixa de valores, com
  data, modelo, cliente, codigo e a cifra do card aberto (peso no faturamento num
  modo, margem no outro), e a ultima linha **RESOMA na tela** para o card e o
  detalhe nunca poderem discordar sem que se veja. Pre-vendas em bloco proprio,
  declaradas fora da soma com o total em transito. Zero rede, zero migration: sai
  do `vendasData` que a aba ja carregou, e o filtro e o **mesmo `vgConta`** do
  placar. Achado da sessao: a working tree suja de 17/08 (`vgConta`, painel de
  Motoboys) **nunca tinha sido commitada**, entao o app publicado somava pre-venda
  na aba Vendas enquanto o `painel_metricas` do banco ja nao somava, a mesma
  palavra dando dois numeros em duas abas. Tres assercoes estavam VERMELHAS antes
  da sessao, herdadas daquela mudanca: reescritas para o criterio novo com numero
  medido, nunca silenciadas (faixa negativa 500/1000 = 50%; dois grupos no recorte,
  MP Imports 4.200). O `diag_mobile.py` passou a ABRIR o bloco antes de medir e
  reprova se ele nao renderizar. Suite: **664 assercoes, 0 falhas**, EXIT 0 nos
  seis comandos e nas cinco larguras. Commit `4d010bb` em `origin/main`.)

- anterior: `handoff_migracao_pitwall_v62.md` (17/08/2026, **carga de preco que virou
  correcao de RLS: o buraco anotado ha tres semanas nao era o pior, e o pior
  ninguem tinha nomeado**. A tabela de 17/08 subiu nas duas calcs (16 fornecedores
  com lista nova, Raposa preservada, **494 produtos / 1.029 precos**, zero variacao
  acima de 15%, CPO em 38). Mas ao responder "como resolvo o `dados.js` publico",
  a medicao mostrou que a policy `calc_dados_sel` filtrava **so por tenant**, com
  `authenticated` tendo SELECT: a sessao do Brendon (`vendedor`, mesmo tenant)
  baixava **custo, fornecedor e praca** das 494 linhas pelo PostgREST, que vale
  mais que a tabela de venda. Fechado com `calc_dados_select_apenas_dono` e provado
  na hora por `set local role` (dono le 1 de 2 linhas, Brendon le 0, anon leva
  permission denied). **Nao existia meio-termo**: o blob e UMA linha de jsonb e RLS
  e por LINHA. Agravante: o commit de vendas de tres dias antes fez o painel ler
  `calc_dados` direto justificando "Zero migration: ja tem policy para
  authenticated" — frouxidao de permissao nao envelhece parada, alguem constroi em
  cima. **A trava de 15% deu zero e ainda havia SETE erros de leitura**, todos
  achados a mao: ordem do bloco decidindo o que e preco solto (o Davi lista preco
  por unidade, a MP lista preco antes das cores; tratados igual, o preco de uma cor
  vazava para a seguinte), `Poco F8 Ultra` casando com Apple Watch Ultra 3, `anc`
  dentro de "cancelamento", `ª` fora do `sem_acento` (o fone paralelo de R$69,99
  virando AirPods Pro de verdade), `caixa branco` virando cor, `s11 46` sem "mm", e
  linha com `*` escapando do detector de produto. Decisoes do dono: numero
  malformado se corrige por coerencia com tabela explicita token->valor; **preco com
  condicao pendurada fica de fora** (fecha pendencia de 03/08, e custa o 17 256GB
  mais barato da rodada); Poco e Xiaomi fora do catalogo. Remote mudou pela segunda
  vez: hoje e **so `origin`**. Aberto: o `dados.js` publico segue exposto e a saida
  desenhada e a opcao B, uma RPC com projecao por papel, que so nao comecou porque
  falta decidir se o painel mostra CUSTO para vendedor.)

- anterior: `handoff_migracao_pitwall_v61.md` (16-17/08/2026, **a aba mostrava 17
  campos e a venda guardava 39**. Os 22 que faltavam so apareciam abrindo o
  painel EDITAR: consultar exigia entrar no unico modo capaz de corromper a
  venda. Entraram cinco coisas encadeadas: bloco de Detalhes (leitura pura, com
  o historico lido da `auditoria` que existia desde a Fase 2 e nunca teve tela),
  recorte "De onde vem" (fornecedor/modelo/pagamento/condicao), quadro de etapas
  (`pendente → a_retirar → em_maos → a_caminho → entregue`, com `dias_na_etapa`
  derivado na leitura), detalhamento de pagamento (N formas por venda, e **a
  soma TEM que fechar com o valor**), e a ponte com a calculadora (o catalogo do
  painel tem 6 itens; a calc tem 501 produtos com fornecedor, praca, cor e
  custo). **ETAPA NAO E STATUS** e o dominio e `etapa_venda`, nunca `etapa`, que
  ja e do LEAD. Os 17 coeficientes de parcelamento sairam de dois arquivos e
  viraram DADO em `calc_dados.config.taxas`, com prova de que o preco nao mudou.
  CPO entrou no dominio de condicao das DUAS tabelas. Licao: **o defeito mais
  caro estava na prova que passava** — tres vezes a suite ficou verde pelo motivo
  errado. 617 assercoes, 0 falhas.)

- anterior: `handoff_migracao_pitwall_v60.md` (15/08/2026, **o consultor estava
  parado ha 5 dias e ninguem sabia**. O dono perguntou o caminho para atualizar a
  calculadora; a resposta util foi medir antes de falar: `config.validade` em
  10/08, vencida, com as quatro funcoes de copiar pedido travadas desde 11/08.
  Segunda vez em tres semanas (a primeira foram 9 dias em 27/07): nao e descuido
  de sessao, e um prazo que expira sem alerta. Carga de 17 fornecedores (2 novos,
  All imports e João Telles): 841 -> **1.043 precos**, 411 -> 501 produtos, zero
  variacao acima de 15%, CPO em 120 (nao zerou). Tres classes de **custo puro** a
  pedido do dono (`1ª Linha`, `Garmin`, `Moto Elétrica`), que exigiram CODIGO e
  nao so dado: `mg()` mandava toda categoria != MacBook para o `else` e dava
  margem de iPhone, entao a moto eletrica apareceria com preco de venda. **O erro
  que quase custou caro nao foi de preco, foi de git**: o clone estava 25 commits
  atras e um dos commits faltantes renormalizou o `index.html` de CRLF para LF, o
  que faria um rebase conflitar linha a linha; resolvido com reset na base certa e
  reaplicacao das 4 edicoes, diff final de 92 linhas. Corrigido de fato: **o push
  sai daqui pelo remote `github`**; o morto e o `origin`, e cinco versoes de skill
  cobraram do dono um passo que a maquina dava. Provas: `prova_sem_margem.js` 22/22
  (nova), `prova_cpo.js` 39/39, `validar.py`, `node --check`, exit 0 em todas, mais
  checksum do blob e da derivacao batendo contra o BANCO. Aberto: `Acessório` ainda
  ganha margem, linha orfa no tenant `...0004`, validade ainda sem alerta.)
- e antes: `handoff_migracao_pitwall_v59.md` (14/08/2026, **as tres pendencias
  herdadas fecharam, e a que mais assustava era a menor**. Sem tela nova.
  (1) A referencia orfa da `prova_atmosfera.py` ("Secao 5 do plano", plano que
  nunca existiu em disco) virou ponteiro para o v56 secao 2 e para o plano da
  Fatia 2. (2) O CSS morto de `.cont-card::before` foi apagado, mas so depois de
  a prova ser REFORCADA: o harness media a barra do primeiro cartao e passou a
  medir a de todos, e a delecao foi comparada contra o HEAD em copia temporaria,
  devolvendo as mesmas 3 cores em 7 cartoes. (3) **O `.gitattributes`, adiado
  seis vezes por causa de uma previsao que ninguem mediu.** Contando bytes no
  index: o repo JA estava em LF, e um unico arquivo tinha CRLF
  (`public/calc/index.html`, 1443 linhas, gravado em 03/08 de outra maquina). O
  "diff gigante" de seis handoffs era um arquivo. Coda: a minha primeira
  medicao usou `grep -c $'\r'` e devolveu 2243 e 2728, numeros que confirmavam a
  expectativa e estavam errados; a contagem de bytes devolve 0. 459 assercoes /
  0 falhas, rodadas depois da renormalizacao. Banco nao encostado. Aberto: as
  pendencias herdadas do v55, que merecem a mesma varredura medida.)
- anterior: `handoff_migracao_pitwall_v58.md` (14/08/2026, **as regras do molde
  sairam do payload, e uma delas NAO PODE ser cobrada**. Fatia 3, a ultima da
  spec de 13/08: `story_slots`, `tetos`, `proibicoes`, `garantia` e `caixinha`
  viviam guardados desde a Fatia 1 e nunca chegavam na tela. O achado que
  definiu o desenho: **`tetos` nao e verificavel**, porque nao existe codigo de
  humor em `public.conteudo` (so a palavra em 3 titulos, e titulo e rotulo, nao
  chave: invariante 12). Contar por titulo daria um numero errado com cara de
  medido. Entao a fatia e consulta DECLARADA, nao cobranca, com a ressalva
  colada no teto e a limitacao escrita no topo da gaveta; as 8 proibicoes ficam
  neutras, porque em vermelho leriam como 8 violacoes que o app nunca mediu.
  **O defeito que a prova pegou**: `.mol-regras-corpo{display:grid}` e regra de
  autor e vence o `display:none` do `<details>` fechado, entao a gaveta nascia
  aberta por cima do kanban — e a minha assercao passava, porque conferia a
  PROPRIEDADE `reg.open` em vez do display COMPUTADO. Quem achou foi o
  `diag_mobile` com 30 sobreposicoes em 360px. Corrigido nos dois lados, e a
  ferramenta passou a **abrir todo `<details>` antes de medir** (antes, gaveta
  nenhuma era medida: provado com 900px injetado dentro dela, 7 estouros).
  Terceiro erro meu, no codigo de teste: a mutacao da ressalva reprovava por
  crash e derrubava as 458 assercoes seguintes; separada com guarda de nulo.
  459 assercoes / 0 falhas, `prova_molde.sql` 26 ok / 0 falhas, 4 mutacoes com
  EXIT 1. A spec de 13/08 esta inteira executada. Aberto: se o dono quiser o
  teto de humor COBRADO, o caminho e o Notion ganhar campo proprio, nunca o app
  adivinhar pelo titulo.)
- anterior: `handoff_migracao_pitwall_v57.md` (14/08/2026, **a grade do molde parou
  de so descrever e passou a COBRAR**. Fatia 2 da spec de 13/08. O pedido chegou
  como frontend e nao era: medido pelo MCP antes de escrever linha, a
  `molde_semana()` devolvia so o molde, e os campos `existe`, `no_ar` e
  `fora_do_molde` desenhados na secao 3.4 da spec **nunca tinham sido
  implementados** — a grade nao tinha de onde tirar cobranca nenhuma. RPC
  recriada devolvendo FATO (o veredito e derivado no cliente por `moldeEstado`,
  com `l()`, no precedente de `nivelPeca`); `story` NUNCA entra no
  `fora_do_molde`, senao os 7 stories que o molde manda existir viram violacao.
  Na tela, `.mol-plan` e `.mol-exec` sao elementos DISTINTOS: um chip so diria
  "Reels 3 de 3" numa semana em que zero Reel foi ao ar. Dia futuro nao cobra, e
  peca a mais e divergencia (`--dim`), nao urgencia. **Dois achados**: (1) o
  cartao de hoje e `--accent-tint`, um TERCEIRO chao que existia desde a Fatia 1
  e que nenhuma prova media — agora medido composto (`#F1F3FC`), pior caso 4.60
  contra alvo 4.5; (2) o fixture do harness fixava a semana em 10 a 16/08 e
  **apodreceria na segunda 17/08**, quando todo dia sem card viraria FALTA com a
  suite verde: virou relativo, com cenas deterministicas de semana -4 e +4.
  Uma prova minha reprovou por estar errada: cobrava 1.5 de contraste entre
  `--quente-fg` e `--dim` e mediu 1.12, mas contraste mede LUMINANCIA, nao matiz
  — invertida para exigir o icone que compensa a colisao. 443 assercoes / 0
  falhas, `prova_molde.sql` 24 ok / 0 falhas, 4 mutacoes com EXIT 1. Aberto: a
  Fatia 3 do molde (tetos, proibicoes, garantia, caixinha), e as tres pendencias
  herdadas do v56.)
- anterior: `handoff_migracao_pitwall_v56.md` (13/08/2026, **a atmosfera da aba
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
- 59 arquivos na pasta, 53 deles da linha migracao (contado em 17/08/2026 com
  `Get-ChildItem docs\handoffs -Filter *.md`). O de maior versao substitui todos os
  anteriores.

## Linha seguranca (pit-guard)

- topo: (vazio)
- NAO existe nenhum `handoff_seguranca_pitwall_vN.md` no repo. O
  `time_agentes_pitwall.md` afirmava que a v1 existia: nao existe aqui. O primeiro
  handoff desta linha nasce `v1`.

## Linha backend (base)

- topo: (vazio). Enquanto a migracao for o fio principal, o `base` pode seguir na
  linha migracao. Quando abrir esta linha, declarar no handoff qual escolheu.

## Linha frontend (vitrine)

- topo: `handoff_frontend_pitwall_v1.md` (26/08/2026, **a aba Financeiro, Fatia 1**).
  Primeiro handoff desta linha. Nao substitui o da migracao: complementa, cobrindo so o
  que a `vitrine` construiu. Visao (placar + secoes de gasto por grupo), Movimentos
  (classificacao na linha e em lote) e Importar (parser OFX no navegador, previa
  obrigatoria antes de gravar), tudo pendurado no invariante 18, que virou faixa fixa no
  topo. **Zero token de cor novo**: 9 grupos financeiros sobre os 7 trilhos ja medidos,
  com mapa explicito e UMA colisao assumida a dedo (Marketing e Vida, os dois icones mais
  distantes); `Sem categoria` em `--morno` porque e ESTADO, nao identidade; e **gasto
  nunca em vermelho** (`--erro` so na faixa de nao classificado e no resultado negativo,
  travado por cor computada). Duas excecoes NOMEADAS em `validar.py`
  (`CONTROLE_NATIVO = ['fin-chk', 'fin-solta.alvo']`) com auto-teste provando que nao
  vazam, e num terceiro caso a regra estava certa e o **CSS foi corrigido** em vez de
  aberta excecao. **A baseline `.antes` nao foi repontada em momento nenhum.** As "4
  ancoras" da linha minificada que o briefing pedia eram SEIS, e as duas que faltavam
  eram defeito visivel (sem a do `topoTit` a tela escreveria "Dashboard" em cima do
  financeiro). Achou o `diag_mobile.py` medindo verde vazio e o corrigiu para varrer as
  tres sub-views. Matou uma flake real (`file.arrayBuffer()` nao anda com
  `--virtual-time-budget`: espera fixa era loteria).

## Linha qa (bandeira)

- topo: (vazio). A bandeira nao tem Write: ela entrega o texto e a Torre grava.

## Linha financeiro

- topo: `handoff_financeiro_pitwall_v11.md` (01/09/2026, **a suite chega ao fim toda
  vez**). Entrega de ferramenta e documento, zero migration e zero mudanca em
  `public/`. Tres defeitos da mesma familia: (1) a trava da v10 so enxerga rotulo
  LITERAL, e o laco de `dash/mes` montava o rotulo por concatenacao, entao CINCO
  assercoes contavam como UMA; provado por mutacao com contra-prova no HEAD, onde
  matar quatro delas deixava o rodape dizendo `0 nao executaram` e o numero
  `992 executadas` nem se movia. (2) A suite abortava **1 em 6** com
  `Cannot read properties of null (reading 'click')`, corrida de tempo entre a previa
  do OFX e o botao; pre-existente, conferido na versao do HEAD; consertado com espera
  pela condicao sob **EXCECAO NOMEADA** ao escopo. (3) Sete linhas em cinco arquivos
  versionados declaravam numero que a suite nao media. Guard-rail novo `suite:` conta
  rotulos montados por concatenacao e exige zero, e pegou um caso na primeira corrida:
  um comentario. Medicao de record: **12 corridas seguidas, todas EXIT 0, 997 linhas
  impressas, 1002 rotulos declarados, 997 executados, 0 nao executaram**; doze e nao
  seis porque seis verdes acontecem por sorte em 33% das vezes contra um flake de 1 em
  6. O item 4 do portao 6.2 **PASSA**, pela revisao 2 do CONTRATO (`ccc3668`, decisao
  do dono, commit separado). Nenhum numero de tela mudou. Aberto: o flake
  `DOM: 0 chars` (1 em 10, sem diagnostico), o extrator que conta `ok()` dentro de
  comentario, 63 `.click()` sem guarda, e `fin_movimento.venda_id`, o DECIMO campo
  orfao (0 de 1132 preenchidos, sem leitor na aba).

- `handoff_financeiro_pitwall_v10.md` (01/09/2026, **a suite para de mentir por
  omissao**). Conserto de portao aberto por `P-AUDITA`, **nao e feature**: um arquivo de
  codigo tocado (`ferramentas/harness.py`), `public/app.js` e `public/app.css` intactos.
  Em 31/08 o harness deu EXIT 0 com 962 assercoes; em 01/09, sem ninguem tocar em uma
  linha, a mesma arvore deu EXIT 1 com `774 passou, 10 falhou` e `rodar()` abortou na 784.
  **O rodape contava so o que rodou: 178 assercoes nunca executaram**, entre elas 73 das
  80 `fin3:` da entrega que o v9 tinha acabado de aprovar e as 56 `fin2:` inteiras. Causa
  raiz: a tela deriva a janela de `new Date()` e os fixtures tem **79 datas chumbadas em
  27 escopos, nenhuma depois de 31/08/2026**. Redatar fixture NAO resolvia (o Financeiro
  precisa de 12 dias distintos dentro do mes corrente, e no dia 1 esses dias nao existem):
  congelou-se o **relogio**, com um `Proxy` sobre `Date` no topo do STUB fixando a pagina
  em 25/08/2026, so na construcao sem argumento e em `Date.now()`. O guard-rail da
  entrega: o lado Python passa a comparar **declaradas contra executadas** e a reprovar
  nomeando quem nao rodou; ramo mutuamente exclusivo se declara no proprio ponto do
  codigo, com `okRamo`, nunca em lista de excecao. Achado que muda o diagnostico: a falha
  `o aviso fica DENTRO da coluna de graficos` **nao era defeito da tela**, procurava
  `.vg-graficos`, classe que nunca existiu no `app.js` nem no `app.css`; a prova e que
  estava quebrada, e so nao aparecia vermelha porque o ramo nunca era alcancado. Suite
  **967 declaradas, 962 executadas, 0 nao executaram, 0 falhas** (medido no commit
  `d2a0d86`); EXIT 0 nos 7 comandos e
  nas 5 larguras; **6 corridas verdes em 6** (antes eram 4 em 5, com o watchdog travando
  sozinho). Nenhum numero da tela mudou. Pendencia da v4 fechada: RLS das RPCs de repasse
  provada como vendedor e sem sessao.
- `handoff_financeiro_pitwall_v9.md` (01/09/2026, **a faixa cobra o numero
  certo**). Entrega `P-R2`, **ultimo prompt de construcao do bloco 1**, vertical
  (migration + RPC + tela + suite num commit so). `fin_painel` devolvia so
  `nao_classificado_valor`, a soma COM SINAL: uma entrada de 4.800 e uma saida de -4.800
  se cancelam. Medido no banco como o proprio dono, janela de agosto: **119 linhas sem
  dominio, R$ 35.148,38 entrando e R$ 34.798,05 saindo, e a faixa declarava R$ 350,33.
  Subestimava o trabalho em 100 vezes.** Achado que o prompt nao previa: `fin_cobertura`
  ja contava em valor absoluto e dizia **R$ 65.146,43 em 118 linhas** para a MESMA janela,
  ou seja duas telas do Financeiro davam dois tamanhos para o mesmo trabalho, com duas
  ordens de grandeza de diferenca. Migration `20260901_fin_fatia3_nc_dois_lados` acrescenta
  `nao_classificado_entradas` e `nao_classificado_saidas` (nada removido); `saidas` sai
  **NEGATIVO** de proposito, para que `entradas + saidas = valor` feche a olho na tela. A
  faixa passa a manchetar os dois lados e o liquido desce para 12px, com a frase que diz
  por que ele engana. A celula `não classificado` do placar passa a contar LINHAS, porque
  senao a tela mostraria dois dinheiros diferentes para as mesmas 119 linhas, a poucos
  pixels um do outro. Zero token de cor novo, uma regra de CSS de uma propriedade. Suite
  **955 -> 962 assercoes, 0 falhas**; EXIT 0 nos 6 comandos e nas 5 larguras; **22 de 22
  `fin_`**; RLS provada no banco como dono, como vendedor e sem sessao. Ressalva
  registrada: com `pct_julgado` em 9,36 o F3 suprime a faixa na Visao, entao **hoje a
  entrega se ve em Movimentos e em Importar**, nao na Visao.
- `handoff_financeiro_pitwall_v8.md` (31/08/2026, **o painel desconta devolucao e a
  tela diz que descontou**). Entrega `P-R1` do bloco 1, **frontend puro, zero SQL**.
  `fin_painel` devolvia `bruto` e `abatido` por categoria desde a fatia 2.1 e o `app.js`
  nunca leu nenhum dos dois: dois campos ORFAOS, e por causa disso **Transporte caiu de
  624,95 para 493,93 sem explicacao na tela**, que e o portao 6.3 aberto. A linha de
  categoria ganha a nota `2.131,02 gastos menos 131,02 devolvidos · 3 linhas` e a linha de
  extrato que produz o abatimento ganha o selo `devolução`. O selo le a
  `natureza_esperada` do `fin_config`, **nunca o sinal do valor**: positivo em categoria
  de entrada e receita normal. Decisao declarada: no bloco de entradas a conta e a mesma e
  so a PALAVRA espelha (`recebidos menos ... estornados`), porque a frase de gasto ali
  seria a tela mentindo com numero certo. Zero token de cor novo (`--dim` nos dois, e
  informacao, nao cobranca). Suite **943 -> 955 assercoes, 0 falhas**; EXIT 0 nos 6
  comandos e nas 5 larguras; 21 de 21 `fin_` (nada foi ao banco). Ressalva registrada: o
  `n` da nota conta gastos + devolucoes juntos, e alguem pode ler as "27 linhas" como 27
  gastos.
- `handoff_financeiro_pitwall_v7.md` (31/08/2026, **par de repasse se desfaz, e a
  tela mostra quem esta em par**). Entrega escolhida pelo dono contra a sequencia, para
  fechar o buraco que o v6 nomeou como o pior do modulo. `fin_repasse_desmarcar` aceita o
  id do par OU de um dos lados, desfaz pelos DOIS, limpa `repasse_id` e categoria juntos
  (senao viraria orfao) e NAO toca `dominio` (Inv. 18). Achado no caminho:
  **`fin_movimentos` nao devolvia `repasse_id`**, entao a tela nao sabia sequer quem
  estava em par; passa a devolver, e a linha ganha o selo `em par de repasse`. A
  confirmacao carrega o VALOR que volta para os totais (D-k) e vive no estado da tela,
  nunca em `confirm()` do navegador, que trava o app e nao se prova no headless. Suite
  **930 -> 943 assercoes, 0 falhas**; 21 de 21 `fin_` por corpo normalizado. Ressalva
  registrada: o portao de entrada reprovou no HEAD (commit anterior nao empurrado) e a
  entrega saiu no mesmo chat da S1, contra a regra de uma por sessao.
- `handoff_financeiro_pitwall_v6.md` (31/08/2026, **repasse so existe em par, e a
  defesa vive no servidor**). Terceiro conserto de portao da sessao S1, disparado por
  defeito medido EM PRODUCAO: o dono escolheu `Repasse` no seletor de categoria da linha
  em vez do botao, e o valor saiu de `entrou`/`saiu` **sem par nenhum**, porque a
  exclusao acontece por natureza `neutro`, que nao sabe nada de par. Consertado com
  `fin_categoria.atribuivel_manual` (flag no servidor, C2), recusa no `fin_classificar`
  (`Categoria nao pode ser escolhida a mao: <codigo>`), `fin_painel` contando repasse por
  `repasse_id` e declarando o ORFAO em separado, e o seletor filtrado na tela.
  **Registra tambem uma regressao minha, consertada na mesma sessao**: ao enxertar a
  guarda eu reconstrui o corpo da `fin_classificar` de memoria e perdi quatro
  comportamentos, entre eles o bloco `exception` inteiro com duas recusas nomeadas. Mesma
  licao que o `P-AUDITA` desta sessao ja tinha dado: corpo de funcao se COPIA. Suite
  **922 -> 930 assercoes, 0 falhas**; 20 de 20 `fin_` por corpo normalizado, e o arquivo
  da migration da regressao conferido byte a byte contra o ledger (7616 chars,
  `8bb691dc...`). Buraco aberto nomeado: **nao existe caminho para desmarcar um par**.
- `handoff_financeiro_pitwall_v5.md` (31/08/2026, **conserto: o par de repasse
  atravessa a virada do mes**). Nao e entrega nova, e conserto de portao na mesma sessao
  S1. A v4 subiu dizendo que o dono podia marcar o par Ford, e **nao podia**: a janela e
  de um mes calendario e trocar de mes apagava a selecao, entao nao existia clique que
  juntasse a entrada de 30/07 com a saida de 06/08. A suite nao pegou porque o fixture
  tinha os dois lados no MESMO mes e o stub do `fin_movimentos` ignorava `p_ini`/`p_fim`.
  Consertado: `FIN_SEL` guarda o lancamento, `fin-mes` nao limpa mais a selecao, a barra
  declara quantos estao fora do mes aberto, e `repasse.valor` passa a somar MODULOS da
  janela (`20260831233621_fin_fatia3_repasse_janela`), senao um mes com uma perna so
  declarava R$ 0,00. Provado com o par Ford real: julho e agosto declaram R$ 4.800,00
  cada, os dois meses juntos R$ 9.600,00, e **a cobertura de agosto vai de 2,69% para
  9,36% com um par marcado**. Suite **917 -> 922 assercoes, 0 falhas**; 17 de 17 `fin_`
  por corpo normalizado.
- `handoff_financeiro_pitwall_v4.md` (31/08/2026, **dinheiro que so passa pela conta
  deixa de parecer receita e despesa**). Sessao S1 do bloco 1, entrega do `P-W1-REPASSE`:
  migration `20260831231416_fin_fatia3_repasse` com a categoria `repasse` (grupo Neutro
  que ja existia), a coluna `fin_movimento.repasse_id`, a RPC `fin_repasse_marcar` com
  seis recusas nomeadas e a chave `repasse` no `fin_painel`; na tela, a acao Marcar
  repasse na barra de lote e a linha que DECLARA o valor excluido.
  Antes da entrega, o dono importou o extrato de **7 meses**: a base foi de 181 para
  **1.132 lancamentos** (01/02 a 31/08/2026, R$ 444.820,68), com o dedupe se provando
  sozinho (total = contagem do arquivo, zero duplicata). Cobertura 2,11% -> **2,06% em
  VALOR**, R$ 435.670,20 em 860 linhas pendentes, mas **47 linhas cobrem 50% do valor**.
  Achado: o **par Ford (R$ 4.800,00) era a maior linha pendente da base** e nao era
  gasto, era repasse. `fin_regra` nao tinha 0 linhas, tinha **5**, e elas classificaram
  222 linhas na importacao. Suite **902 -> 917 assercoes, 0 falhas**; as 16 `fin_` batem
  16 de 16 por corpo normalizado. Divergencia **D-8 nova**: `fin_config` devolve
  `dominio_sugerido` sem leitor no `app.js`.
- `handoff_financeiro_pitwall_v3.md` (31/08/2026, **a tela para de desenhar numero
  economico sobre base incompleta**, commit desta sessao). Entrega vertical do
  `P-W1-COBERTURA`: uma migration (`20260831180334_fin_fatia3_cobertura`) com
  `privado.fn_fin_cobertura`, `public.fin_cobertura`, `pct_julgado` no `fin_painel` e
  `p_ordem` no `fin_movimentos`, mais o bloco `base incompleta: N% julgado · faltam
  R$ X em Y lançamentos` que entra **no lugar** do placar, nunca ao lado dele.
  Medido: **2,11% do VALOR julgado** (R$ 1.677,85 de R$ 79.619,86; faltam R$ 77.942,01
  em 131 linhas). RLS exercitada com tres sessoes (dono, vendedor, uid inexistente).
  Suite **882 -> 902 assercoes, 0 falhas**, EXIT 0 nas cinco larguras; a baseline real
  era 882, nao os 885 que o `CLAUDE.md` declara. As 15 `fin_` batem 15 de 15 por corpo
  normalizado. Divergencia **D-1 paga**; D-2 a D-7 seguem abertas, e a D-4 cresceu.
- `handoff_financeiro_pitwall_v2.md` (28/08/2026, **o git passa a descrever o banco
  por CORPO, nao so por nome**). O portao de entrada reprovou no item 1 (tree suja) e,
  pelo `CONTRATO.md` 6.1, a entrega da vez virou fechar o portao: o `P-AUDITA` NAO saiu.
  Achado principal: `20260826_fin_fatia21_painel_abatimento.sql` carregava, sob aquele
  nome, o corpo do `sem_categoria`; o corpo que o banco aplicou nao existia em arquivo
  nenhum. Recuperado do ledger e conferido por md5 RAW (`dfd3683c...`, 9890 chars nos dois
  lados). **As 14 `fin_` passam a bater 14 de 14 por corpo NORMALIZADO** (era 13 de 14).
  O criterio de record desta linha e o normalizado, nao o RAW: os arquivos do repo
  carregam cabecalho que o ledger nunca recebeu, entao RAW bate 1 de 14 e isso e correto.
  Entram tambem o `condutor` versionado (5 arquivos, 626 linhas) e o `20260721_calc_dados.sql`,
  que passa a declarar que foi aplicado fora do ledger e perde um fallback `using (true)`
  que vivia em comentario. Nenhum DDL saiu: o banco foi so leitura.
- `handoff_financeiro_pitwall_v1.md` (27/08/2026, **o contrato do Financeiro entra
  no repo e passa a carregar sozinho**, commit `67d0066`). Primeiro handoff desta linha,
  como o `CONTRATO.md` exige no portao de saida (secao 6.2). Entrega de governanca: zero
  linha de `public/` ou `supabase/` tocada. Traz a secao **6, divergencias observadas e
  nao tratadas**: **sete** achados, `D-1` a `D-7`, todos reconferidos com `grep` nos dois
  lados, com arquivo e linha, **por decisao do dono como registro puro, sem diagnostico e
  sem proposta** (o `P-AUDITA` decide o que vira entrega). Seis vieram da sessao de aceite
  e a `D-7` foi achada depois, no `P-R0`. Traz tambem a secao 7 com a ordem decidida da
  sequencia. O estado do modulo em
  si continua na linha migracao (`v68`, Fatia 2) e na linha frontend (`v1`, a aba): este
  handoff nao os substitui, governa.
- **contrato de record: `docs/financeiro/CONTRATO.md`** (revisao 1, 27/08/2026). Nao e
  handoff, e a regra: 292 linhas com o inventario medido (5 tabelas, 11 RPCs, 5 helpers
  privadas), os invariantes herdados com o numero GLOBAL (6, 7, 8, 9, 10, 12, 18) mais os
  novos do modulo com prefixo `F` (F1 a F4), os invariantes de construcao (C1 a C6), as
  17 decisoes fechadas (D-a a D-q), o vocabulario fechado de recusa e os tres portoes.
  **Onde qualquer documento anterior disser "invariantes 13 a 16", leia F1 a F4**: aquela
  numeracao colidia com a global e foi morta na revisao 1.
- **carrega sozinho.** `CLAUDE.md`, bloco de arranque, item 4 (empurrou "abrir a skill"
  para o 5, de proposito: contrato que perde para a skill nao e contrato). Quem tocar em
  `fin_` ou na aba Financeiro le o contrato antes da primeira linha, e se ele conflitar
  com o pedido do prompt, o contrato ganha e a sessao avisa.
- acompanham, na mesma pasta: `PROMPTS.md` (os prompts de sessao, revisao 1, que
  substitui os espalhados em `plano_de_prompts_financeiro_v1` e
  `plano_mestre_financeiro_v1`), `PLANO.md` (o plano mestre, revisao 2),
  `guia_de_uso_dos_prompts.md` (operacao e calendario, com as tres citacoes da numeracao
  morta trocadas por F2, F3 e F1-F4 no ato da copia) e `PRD-ESTADO.md` (o PRD de estado
  medido em 26/08, que ate 27/08 era o `doc.md` solto na raiz do repo, sem versionar).

## Linhas ainda sem agente proprio

`dados` (modo Painel), `devops` (modo Box) e `produto` (modo Estrategista) rodam
como MODOS da Torre ate haver volume. Quando um modo virar agente, abrir a linha
aqui.

## Regra

Ao abrir sessao: ler este indice mais o topo da linha do dominio que a tarefa
toca. Nunca confiar so no que este arquivo diz: conferir a pasta. Esta linha ja
ficou desatualizada em todo documento deste projeto que tentou fixar uma versao.
