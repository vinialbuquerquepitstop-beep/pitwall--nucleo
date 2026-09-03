# Handoff Frontend v3 — a tela para de chamar caixa de resultado

Data: 03/09/2026. Linha: frontend (vitrine). Substitui o `handoff_frontend_pitwall_v2.md`
como topo da linha do frontend. A linha do Financeiro continua no
`handoff_financeiro_pitwall_v15.md`.

---

## 1. Headline

**A Visao do Financeiro passou a desenhar DUAS verdades separadas: o caixa da conta
(entrou, saiu com a composicao estoque + gasto, saldo, um placar por dominio) e o
resultado da loja (vendas, faturado, lucro), com a nota da divergencia entre os dois e
a palavra `resultado` proibida de rotular caixa.**

Isso fecha a janela de regressao que estava ABERTA: a migration
`20260903_fin_painel_caixa_x_resultado` ja estava aplicada em producao e a tela lia
`pl.resultado`, chave que nao existe mais. O placar do dono estava zerado.

---

## 2. O que mudou nesta sessao

### 2.1 `public/app.js`

`finPlacar` deixou de existir. No lugar dela nasceram nove funcoes, todas legiveis:

| Funcao | Papel |
|---|---|
| `finCel` | uma `.pb-celula` (rotulo, numero, pe), reusada pelos dois cartoes |
| `finSaiuPe` | o pe do `saiu`: `R$ 15.400,00 em estoque · R$ 654,00 de gasto` |
| `finCaixaComp` | a nota que diz que estoque NAO e despesa, com os tres numeros |
| `finCaixaCol` | um lado (Empresa ou Pessoal): 3 celulas + a nota |
| `finNcCel` | a celula do nao classificado, desenhada UMA vez |
| `finVerdade` | o cartao com icone, titulo, FONTE declarada e recorte |
| `finCaixa` | o cartao do caixa: dois lados em `tudo`, um lado quando ja ha filtro |
| `finResultadoVenda` | o cartao do resultado, de `resultado_venda` |
| `finDivergem` / `finVerdades` | a nota entre os dois e a composicao na ordem certa |

Tres textos deixaram de chamar caixa de resultado:
- `finBaseIncompleta`: `Entrou, saiu e resultado` virou `Entrou, saiu e saldo`, e
  `Número de resultado sobre base incompleta` virou `Número econômico...`;
- `finRepasseLinha`: `o resultado só acerta por acidente` virou `o saldo só acerta...`;
- o comentario do ramo do F3 em `finVisao`.

### 2.2 `public/app.css`

Bloco novo `as DUAS verdades` (82 linhas) mais 13 linhas na media query de 420px.
Classes: `.fin-verdade`, `.fin-verdade-cab/-ico/-tit/-fonte/-pe`, `.fin-caixa-cols`,
`.fin-caixa-col`, `.fin-caixa-rot`, `.fin-cels`, `.fin-nc`, `.fin-caixa-comp`,
`.fin-divergem`.

**Zero token de cor novo (C5).** O que separa os dois cartoes e a SUPERFICIE invertida:
o caixa e placa `--surface` com celulas `--bg`; o resultado e placa `--bg` com celulas
`--surface`. Figura e fundo trocados leem como dois objetos sem gastar matiz, e matiz
aqui seria mentira (nenhum dos dois e mais urgente que o outro).

Mais uma correcao de UMA linha, **fora do brief**, declarada na secao 3.

### 2.3 `ferramentas/harness.py`

- o stub de `fin_painel` passou a devolver o payload novo, respeitando as tres
  identidades que o guard-rail da migration cobra no banco (`saldo = entrou - saiu`,
  `gasto = saiu - estoque`, `tudo = empresa + pessoal`);
- **38 assercoes `fin5:`** novas;
- 5 assercoes antigas reescritas sobre a estrutura nova (2 delas com rotulo trocado,
  porque a afirmacao mudou: `4 celulas do pitboard` -> `3 celulas de caixa em cada
  lado`, e `entrou, saiu, resultado e nao classificado` -> `entrou, saiu e saldo`).

### 2.4 `ferramentas/foto.py`

`'financeiro': 'abaFinanceiro'` entrou no mapa de abas. A aba mais nova e mais
discutida do app era a UNICA que nao dava para fotografar, e o docstring desse arquivo
existe justamente por causa de uma sessao que afirmou o que a tela "ganhou" sem olhar
para ela.

---

## 3. Decisoes tomadas, e o que foi RECUSADO

| # | Decisao | Argumento |
|---|---|---|
| D1 | Dois CARTOES, nao dois grupos no mesmo placar | corolario do Inv. 18: caixa e resultado nunca se somam. Colados, leem como metades de um numero so, que e o defeito com outra roupa |
| D2 | A FONTE fica no cabecalho de cada cartao (`fonte: o extrato da conta` / `fonte: as vendas registradas`) | titulo separa pouco; o que separa duas verdades e de onde o numero veio |
| D3 | A nota da divergencia fica ENTRE os dois, nao no rodape | a pergunta nasce na costura dos dois numeros, e rodape e onde nota vai para nao ser lida |
| D4 | `finDelta` reusado no lucro | ele ja resolve o D-n (`novo`, nunca `0%`) e ja tem prova propria. Escrever um segundo formatador seria duas verdades para o mesmo numero |
| D5 | Quando `resultado_venda` vem null (filtro Pessoal), a tela DIZ por que o bloco sumiu | bloco que some calado e numero que muda sozinho com outra roupa |
| D6 | O rotulo do lado (`EMPRESA` / `PESSOAL`) virou regua com hairline | medido na foto de 1280px: com rotulo pequeno e o mesmo respiro dentro e entre colunas, os dois lados liam como um placar unico de seis celulas |
| D7 | A celula do nao classificado ganhou regua em cima | na foto ela encostava embaixo da coluna Empresa e lia como se fosse dela, quando ela e justamente o que nao pertence a lado nenhum |
| **R1** | **RECUSADO: desenhar `resultado_venda` sozinho no estado F3 (base incompleta)** | a base do lucro e a tabela `venda`, que nao depende do julgamento do extrato, entao havia argumento para deixar. Mas o F3 e literal: **no LUGAR do numero, nunca ao lado**. Um lucro sozinho debaixo de "base incompleta" convida a ler o mes por um numero so. Comportamento mantido: o bloco do F3 substitui tudo |
| **R2** | **RECUSADO: reponta de baseline `.antes`** | nenhuma foi tocada. Guard-rail que incomoda nao se cala repontando baseline |
| **R3** | **RECUSADO: token de cor novo para separar as duas verdades** | C5. A separacao saiu por superficie e por palavra |

### 3.1 Uma correcao fora do brief, declarada

`.fin-mes-rot` usava `text-transform:capitalize` e o seletor de mes do Financeiro
exibia **`Agosto De 2026`**, com a preposicao maiuscula no meio da frase. Trocado por
`::first-letter{text-transform:uppercase}` (6 linhas de CSS, incluindo o comentario).

- **Por que entrou:** e um defeito visivel na PROPRIA tela que esta sendo entregue, e o
  dono vai abrir essa tela. Zero numero muda, zero comportamento muda.
- **Por que pode sair:** nao esta na frase da entrega. E um bloco isolado, derrubavel
  sozinho sem tocar em mais nada, se a Torre preferir C6 estrito.
- Coincidencia util: o navegador de mes do Dashboard (secao 5.1) corrigiu o MESMO
  defeito no mesmo dia, com a mesma tecnica.

---

## 4. Provas

Todos rodados da raiz do repo, com o codigo final. **Exit code conferido, nao o texto.**

| O que foi testado | Comando exato | Resultado | Exit |
|---|---|---|---|
| sintaxe + regra 11.1 do azul | `python ferramentas/validar.py` | TUDO PASSOU | **0** |
| comportamento, Chrome headless | `python ferramentas/harness.py` | 1087 passou, 0 falhou; 1092 declaradas, 1087 executadas, 0 nao executaram (5 de ramo alternativo) | **0** |
| contraste dos 7 trilhos | `python ferramentas/prova_trilho.py` | ok | **0** |
| degraus do grafico do Escopo | `python ferramentas/prova_grafico.py` | ok | **0** |
| contraste da aba Conteudo | `python ferramentas/prova_atmosfera.py` | ok | **0** |
| parse do JS | `node --check public/app.js` | ok | **0** |
| geometria de celular | `python ferramentas/diag_mobile.py 360` | 0 sobreposicoes, 0 estouros | **0** |
| idem | `python ferramentas/diag_mobile.py 390` | idem | **0** |
| idem | `python ferramentas/diag_mobile.py 414` | idem | **0** |
| idem | `python ferramentas/diag_mobile.py 1280` | idem | **0** |
| idem | `python ferramentas/diag_mobile.py 1440` | idem | **0** |
| tela sobrando | `python ferramentas/diag_largo.py 1500` | ok | **0** |
| idem | `python ferramentas/diag_largo.py 1920` | ok | **0** |
| idem | `python ferramentas/diag_largo.py 2560` | ok | **0** |

**RC global da corrida encadeada: 0.**

### 4.1 As 38 assercoes `fin5:`, por alvo

| Alvo cobrado | n |
|---|---|
| a palavra `resultado` nao rotula caixa (rotulo, texto do cartao, titulo, fonte de cada verdade) | 5 |
| `saldo` desenha o numero certo, com sinal, cor e pe | 5 |
| o `saiu` declara estoque e gasto (pe, conta que fecha na tela, nota, ramo sem estoque) | 6 |
| o bloco de venda (rotulos, valores, delta, lucro diferente do saldo) | 4 |
| duas verdades: dois cartoes, nota entre eles, ordem no documento, cor, nao truncar | 5 |
| em `tudo`: dois placares, nenhum saldo combinado, zero campo orfao | 3 |
| `nao_classificado` uma vez so | 2 |
| `delta_pct_lucro` null vira `novo` (D-n) | 1 |
| filtro num dominio so: placar unico, venda some com explicacao | 5 |
| liquido do placar nao encosta no pendente da cobertura; F3 nao chama caixa de resultado | 2 |

### 4.2 Prova extra que nao esta na suite (medida, nao estimada)

Truncamento das celulas novas (`scrollWidth > clientWidth`), medido em iframe com o
viewport real, com o mesmo stub do harness:

| Largura | colunas de caixa | cartoes | celulas truncadas |
|---|---|---|---|
| 360 | 2 | 2 | **0** |
| 390 | 2 | 2 | **0** |
| 414 | 2 | 2 | **0** |
| 800 | 2 | 2 | **0** |
| 1280 | 2 | 2 | **0** |

O script vive no scratchpad da sessao, nao no repo. A parte que FICA e a assercao
`fin5: nenhum numero do caixa sai cortado pela reticencia`, que roda dentro do harness.

### 4.3 O que a foto pegou e a suite nao pegava

`python ferramentas/foto.py financeiro 1280 ...` (com a aba nova no mapa) acusou tres
coisas que passavam verdes em todas as ferramentas:

1. os dois lados liam como um placar unico de seis celulas (D6);
2. o nao classificado parecia pertencer ao lado Empresa (D7);
3. `Agosto De 2026` (secao 3.1).

Registro para a proxima sessao: **prova de cor computada nao substitui olhar.**

---

## 5. Ressalvas: o que NAO foi provado

1. **Nada foi provado contra o servidor de verdade.** Todas as 38 assercoes rodam sobre
   o stub do harness, com o payload que eu mesmo escrevi. O que garante que o stub e
   fiel e o guard-rail `do $guard$` dentro da migration, que confere as mesmas tres
   identidades no banco. **Nao abri o Supabase: o dominio deste agente e frontend.**
   Vetor exato a provar: chamar `fin_painel('2026-08-01','2026-08-31','tudo')` como dono
   e conferir que os seis campos batem com a tabela do brief.
2. **Os valores de agosto/2026 do brief nunca foram renderizados.** O fixture usa
   numeros proprios (2.000 / 150 / 130 / 20 / 1.850 e o lado pessoal negativo), porque
   ele exercita os DOIS ramos da composicao. Vetor: abrir a aba com o banco vivo.
3. **A migration nao foi conferida contra o banco.** Ela esta no working tree como
   arquivo NAO rastreado (`?? supabase/migrations/20260903_fin_painel_caixa_x_resultado.sql`).
   O brief diz que ja esta aplicada; eu nao verifiquei, e nao tenho acesso.
4. **`foto.py` a 390px nao mede celular de verdade.** O headless do Chrome no Windows
   tem piso de ~500px de largura e o `foto.py` nao usa o truque do iframe que o
   `diag_mobile` usa. A foto de 390px sai cortada, nao encolhida. Quem mede celular
   continua sendo `diag_mobile.py`. Nao mexi no `foto.py` alem do mapa de abas.
5. **Duas corridas do harness reprovaram e eu NAO capturei qual assercao caiu.** As duas
   aconteceram na mesma janela de tempo em que o outro trilho (secao 7) estava
   escrevendo no `harness.py` e no `app.js`: e a mesma janela em que o contador saltou
   de 1080 para 1092 declaradas sem nenhuma edicao minha. Depois disso a suite rodou
   **12 vezes seguidas, todas 1087 passou / 0 falhou / EXIT 0**, incluindo 3 na sequencia
   exata `validar.py` e depois `harness.py`. A explicacao mais provavel e leitura de
   arquivo sendo reescrito no meio da corrida, nao assercao instavel. **Nao esta
   provado.** Vetor exato: com a tree ja commitada e nenhuma outra sessao aberta, rodar
   `python ferramentas/harness.py` 10 vezes e conferir EXIT 0 nas 10.
6. **Cor do saldo negativo.** `.fin-placar .pb-num.neg` usa `--erro-fg`, herdado do
   `resultado` antigo sem discussao nesta sessao. Saldo negativo nao e falha de sistema,
   e o CONTRATO (D-o) e explicito sobre nao gastar `--erro` com o que nao e falha. Ficou
   como estava por ser decisao pre-existente, mas e uma pergunta legitima para o dono.

---

## 6. Pendencias

| # | Item | Bloqueio ou nota |
|---|---|---|
| 1 | O dono ainda NAO ABRIU A ABA | quarta vez que um handoff pede. Agora com o motivo mais forte de todos: ate esta entrega o placar dele estava ZERADO, porque o servidor ja tinha mudado |
| 2 | Migration `20260903_fin_painel_caixa_x_resultado.sql` nao rastreada | entra no commit unico da Torre, junto com esta entrega (C6) |
| 3 | Cor do saldo negativo | ressalva 6. Decisao do dono |
| 4 | Filtro Pessoal esconde o resultado da loja | comportamento do servidor (`resultado_venda` null). A tela declara. Se um dia o dono quiser ver o lucro sob o chip Pessoal, e mudanca de servidor, nao de tela |
| 5 | Os R$ 630 do Rodrigo e o `forcar` no repasse | herdado do `handoff_financeiro_pitwall_v14.md`, secao 4 |

---

## 7. ACHADO QUE NAO ESTAVA NO BRIEF: a working tree tem DUAS entregas

Durante a sessao, `ferramentas/harness.py` e `public/app.js` **ganharam 12 assercoes e
tres blocos de codigo que eu nao escrevi**, entre duas corridas do harness sem nenhuma
edicao minha no meio (1080 declaradas -> 1092).

Rastreado: e o **navegador de mes do Dashboard** (`dash/nav:`, classes `.dh-mes`,
`.dh-mes-b`, `.dh-mes-rot`, funcoes `dv*`), de outra sessao rodando na mesma pasta.

| Arquivo | Meu | Do outro trilho |
|---|---|---|
| `public/app.js` | linhas ~796 a 1020 (bloco `fin`) | ~3918, 3932, 3949, 4445, 4467, 4479, 4793 (bloco `dv`) |
| `public/app.css` | hunk de 82 linhas em ~3519, 13 linhas na media de 420px, 6 linhas em `.fin-mes-rot` | hunks em ~2211 (+20) e ~2434 (+4) |
| `ferramentas/harness.py` | stub de `fin_painel`, bloco `fin5:` (+249 no fim), 5 assercoes reescritas | hunk de +77 em ~5442, com as 12 `dash/nav:` |

**Nao toquei em nada do outro trilho, e nada dele reprova**: a corrida final e 1087
passou, 0 falhou, EXIT 0 nos 14 comandos, com as duas entregas dentro.

**A Torre precisa decidir isso antes de commitar**, e a decisao nao e minha:
- commitar tudo junto vira um commit que a mensagem nao descreve, e o C6 (entrega
  vertical) existe para impedir exatamente isso;
- separar exige dois commits com `git add -p` por regiao de arquivo, o que e viavel
  porque as regioes nao se cruzam em nenhum arquivo.

Registro do risco de processo, que e maior que o do codigo: **duas sessoes escrevendo
na mesma working tree nao commitada.** Cada uma mediu a suite com o trabalho da outra
dentro, e nenhuma das duas sabia. Se as regioes tivessem se cruzado, uma teria
sobrescrito a outra em silencio.

---

## 8. Primeiro movimento do proximo chat

1. **Abrir a aba Financeiro no ar** (a janela de regressao so fecha depois do deploy) e
   conferir os seis numeros de agosto contra a tabela do brief.
2. Antes disso, a Torre resolve a secao 7: um commit ou dois.
3. Rodar o portao de entrada 6.1 do CONTRATO com a tree ja limpa, para a proxima entrega
   nao comecar sobre estado nao conferido de novo.

---

## 9. Invariantes reforcados

- **Inv. 18, corolario:** caixa e resultado sao verdades separadas e NUNCA se somam. A
  tela agora tem isso na estrutura (dois cartoes, duas fontes declaradas) e na prova
  (`fin5: e o saldo combinado dos dois NAO e desenhado em lugar nenhum`).
- **Inv. 12 / C2:** nenhum dado de config entrou no JS. Categoria, grupo e conta
  continuam vindo de `fin_config`.
- **C3:** nenhuma frase de recusa nova. O texto novo e explicacao de numero, nao recusa.
- **C5:** zero token de cor novo. `--morno` = `#f2a71b` segue semantico e separado da
  marca `#0025cc`.
- **Portao 6.2, zero campo orfao:** `estoque`, `gasto`, `saldo`, `placar_empresa`,
  `placar_pessoal`, `resultado_venda` e os quatro `nao_classificado_*` tem leitor, e uma
  assercao `fin5:` confere os seis pelo valor que so cada um produz.
- **F3:** o bloco de base incompleta continua entrando NO LUGAR do numero, nunca ao lado,
  e agora tambem nao chama caixa de resultado.
- **D-n:** `delta_pct_lucro` null escreve `novo`, nunca `0%`.
- **Tela que omite recorte mente:** os dois cartoes declaram a janela (`de X a Y`).
- **Baseline nao se reponta no meio da obra:** nenhuma `.antes` foi tocada.

---

**A Torre atualiza `docs/handoffs/handoff_indice_pitwall.md`.**
