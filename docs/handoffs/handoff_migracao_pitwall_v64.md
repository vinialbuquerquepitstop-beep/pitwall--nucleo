# Handoff v64 — 19/08/2026

Substitui todos os anteriores. Sessao de FRONTEND puro: nenhuma migration, nenhuma
RPC nova, nenhuma chamada de rede nova. A aba Hoje foi reconstruida sobre uma
referencia visual baixada nesta manha, e ganhou uma secao que nao estava nela.

---

## 0. Para quem chega agora, em seis linhas

1. Commit `fda502a`, empurrado para `origin/main`. Cloudflare publica sozinha.
2. A aba **Hoje** foi refeita sobre `Downloads/stitch_pit_wall_crm (1).zip`
   (baixado 19/08 09:37): faixa de dinheiro, tres leituras no topo, corpo em
   grade, e o placar de 4 celulas REMOVIDO por ordem do dono.
3. Entrou a secao **Pendencias**, que nao vinha do mock: junta o que esta aberto
   e atrasado nos sete trilhos, com botao que leva a aba onde se resolve.
4. O card **De onde veio** do Dashboard foi refeito no mesmo desenho.
5. Suite: **691 assercoes, 0 falhas**, EXIT 0 nos seis comandos e nas cinco
   larguras.
6. **Uma excecao foi aberta na regra 11.1 do azul** (secao 6 deste documento). E
   decisao consciente do dono, e esta secao existe para que a proxima sessao
   saiba disso sem precisar arqueologia.

---

## 1. O que o dono pediu, na ordem, e o que cada pedido custou

| # | Pedido | O que aconteceu |
|---|---|---|
| 1 | "consegue acessar o ultimo screen baixado em relacao a front end de pag hoje" | Achado o zip do Stitch. **Eu errei ao dizer que origem de lead e lucro nao existiam no banco**: existem os dois (`lead.origem` obrigatoria no cadastro, `venda.custo_aparelho`). |
| 2 | "monta o card de origem com o dado real" | O card **ja existia** na aba Dashboard (`metOrigem`). Refeito no desenho do mock em vez de duplicado. |
| 3 | "voce se perdeu... a construcao e a pagina hoje" | Alvo corrigido: a obra era a aba Hoje inteira. |
| 4 | "a estetica deve ser o mais identica possivel; rotina, conteudo, lembrete, sync, some" | Placar removido, KPI em porcentagem, grafico com duas series, titulos e botoes no padrao do mock. |
| 5 | "lateral direita vazia... grafico estreito... use a skill de front end" | Duas colunas trocadas por grade de 4 unidades. |
| 6 | "mude o grafico de leads... altere as cores" (era o card **Temperatura**) | Mexi no grafico errado primeiro. Depois refiz a Temperatura. |
| 7 | "adicione uma secao de PENDENCIAS" | Secao nova. |
| 8 | "pode subir" | Commit `fda502a` + push. |

**Licao cara desta sessao, para a proxima:** eu afirmei duas vezes que um dado
"nao existe" sem consultar o banco, e nas duas o dono estava certo. Antes de
dizer que algo falta, rodar a query.

---

## 2. Layout da Hoje: o que substituiu o que

A primeira versao usava **duas colunas verticais fixas**. Medido antes de trocar:
~990px de altura na esquerda contra ~380px na direita, ou seja ~600px de branco, e
o grafico espremido em 1/3 de largura enquanto duas listas curtas ocupavam o mesmo
tanto. Coluna vertical fixa so fica equilibrada por acaso.

A grade nova e a **mesma do Dashboard** (`.dash-l`, 4 unidades por linha), agora
tambem em `.hj-l`:

```
linha 1   [ Faturamento 1 ][ Lucro 1 ][ Temperatura 2 ]
linha 2   [ Leads novos 2            ][ De onde vem 2 ]
Pendencias .................................. largura total
Fila de hoje ................................ largura total
corpo     [ Rotina ]        |  [ Conteudo, Lembretes, Nota ]
rodape    regua
```

Escada: 4 unidades acima de 1180px, 2 entre 760 e 1179, 1 abaixo de 760.

Duas regras que NAO podem ser desfeitas sem pensar:

- **A ordem do DOM e `Pendencias, Fila, Rotina, Conteudo, Lembretes, Nota`**, e
  nao se usa `order` no CSS para reorganizar. `order` faz o foco de teclado andar
  para tras do que se ve. A nota do dia segue por ULTIMO no empilhamento do
  celular, que e a decisao registrada desde a v33 (a nota e o ato de fechamento).
- **A Fila ocupa largura total.** Em meia largura o botao `Enviar` quebrava de
  linha. Junto com isso foi preciso `.fila-sug{flex:0 0 auto}`: `.btn-acao` nasce
  com `flex:1` e o `Sugerir` esticou por ~600px.

---

## 3. O que o mock pediu e NAO entrou (e por que)

O mock e um mockup de agencia: os numeros dele sao inventados. O que foi barrado:

| No mock | Por que ficou de fora |
|---|---|
| Origem "Google Ads" 35% | Nao existe no dicionario de origem. Trafego pago no schema sao campos separados (`trafego_ref`, `trafego_campanha`). |
| Faturamento +12% / Lucro +8,5% | Viraram a variacao real do mes contra o mes anterior (`vgAgregar` sobre `v_venda`). |
| "Alerta: quentes subiram 12% nas ultimas 2 horas" | Nao ha medicao por hora. Seria numero inventado. |
| Linha de "conversao" diaria no grafico | Com o volume atual seria uma linha de zeros com nome de taxa. A serie diz o que e: venda fechada no dia. |

Uma assercao do harness ja existia para isso desde 08/08 ("os mockups do Stitch
pintam este lugar com Uptime 99.98% e 70% da Capacidade Total, que nao existem no
banco"). Ela foi **preservada em espirito**: virou uma prova de que `Uptime`,
`Capacidade` e `Google Ads` nao aparecem no texto renderizado da aba.

---

## 4. O placar de 4 celulas saiu, e o que herdou a funcao dele

Ordem do dono: "rotina, conteudo, lembrete, sync, some". O `hojePlacar(d)` saiu da
montagem da Hoje (a funcao continua no arquivo, usada pela Captacao).

Duas coisas iam junto no bolo e foram salvas:

1. **O progresso da rotina** (`0 de 1 feitas`) virou contador no cabecalho da
   propria secao Rotina (`.dia-sec-badge.neutro`). Sem isso a Hoje deixaria de
   dizer quanto do dia foi feito.
2. **`hojePlacarAtualiza()` foi religada nesse contador.** Ela atualiza o numero
   de forma cirurgica quando se marca tarefa, SEM reler `painel_do_dia`. Com o
   placar fora ela virou no-op silencioso: continuava rodando e nao mexia em nada.
3. **A regua NAO saiu.** Ela desceu para `.hj-rodape`. E o unico lugar onde se ve
   que o motor do CRM esta vivo; se ela parar, a fila mente em silencio.

Quatro assercoes liam o placar. Nenhuma foi silenciada: passaram a ler o contador
novo, provando a MESMA coisa (marcar tarefa move o progresso, sem remontar a linha
nem reler a RPC).

---

## 5. Cores: as duas medicoes que mudaram a decisao

### 5.1 As tres semanticas tem a MESMA luminancia

```
quente #F26B31 x morno #C48808   1.01
morno  #C48808 x frio  #8395AF   1.00
quente #F26B31 x frio  #8395AF   1.01
```

Numa barra segmentada colada, as tres viram UMA faixa para quem nao distingue
matiz. Por isso a barra da Temperatura tem **3px de respiro entre as fatias**, e
ha prova disso no harness. E o mesmo achado que ja obriga icone nos trilhos de
categoria: **matiz sozinho nao separa**.

Cada nivel ganhou celula com o trio faixa/texto/tint. Texto `-fg` sobre o tint:
quente 4.65, morno 4.61, frio 4.61, sem_contato 5.43 (alvo 4.5).

**Nenhum token global foi tocado.** Trocar quente/morno/frio no `:root` mudaria o
chip da Fila, o ponto do lead, o Pitscare e o card de cliente, e obrigaria a
remedir a paleta inteira. Se o dono pedir isso, e outra sessao.

### 5.2 A serie de venda saiu do azul

Grafico de leads: barra = lead novo (`--dim`, 5.81), linha = venda fechada
(`--ok`, 3.35), barra de HOJE (`--text`, 18.23, e 3.14 contra `--dim`).

As duas series separam so **1.74 entre si**: quem distingue e a FORMA (barra cheia
x linha com ponto) mais a legenda nomeada.

---

## 6. A excecao aberta na regra 11.1 do azul — LEIA ANTES DE MEXER

A regra 11.1 do `validar.py` conta uso NOVO de `var(--accent)` e reprova o que nao
tiver papel aprovado. Ela existe porque barra de progresso azul ja entrou duas
vezes no projeto (`cap-barra` na Fase 5; `.met-barra i` em 03/08/2026).

Por ordem do dono ("a estetica deve ser o mais identica possivel" a referencia,
que pende inteira do azul), foi aberta a lista `SERIE_E_ACAO_HOJE`, com papel
nomeado um a um:

- `dia-sec-badge` — contador de pendentes da Fila
- `.dia-add .btn-acao` — Adicionar (lembrete e tarefa)
- `.dia-nota-pe .btn-acao` — Salvar nota

A serie do grafico entrou e depois **SAIU** desta lista, quando a venda virou
verde: `hj-graf-linha` e `hj-leg-linha` foram removidas e a excecao encolheu
sozinha.

**O auto-teste continua intacto:** `assert papel_do_azul('.met-barra i') is None`.
Se um dia ele parar de reprovar, a regra morreu e esta excecao morre junto.

---

## 7. Secao Pendencias (nao vinha do mock)

Junta o que esta ABERTO E ATRASADO nos trilhos, que hoje so aparece para quem abre
cada aba. Sete fontes, todas derivadas na leitura do que a aba ja tem em memoria:

| Linha | Fonte | Destino |
|---|---|---|
| lead com contato atrasado | `v(leads,hoje)` com `p(proximo_contato,hoje) > 0` | `abaFila` |
| cliente com pos-venda vencido | `pitscareGrupos(ativos,hoje).venc` | `abaPitscare` |
| entrega sem baixa | venda concluida com `etapa != entregue` | `abaVendas` |
| venda sem nota fiscal | concluida sem `nf_numero` e sem `nf_url` | `abaNfs` |
| peca de hoje sem publicar | `d.conteudo` fora de publicado/descartado | `abaConteudo` |
| lembrete vencido | `d.lembretes[].vencido` | (ja na tela) |
| tarefa da rotina em aberto | `d.contagem.total - feitas` | (ja na tela) |

**Decisao de produto que a proxima sessao nao deve reverter sem falar com o dono:
nada se digita ali.** Ja existem duas listas de tarefa na mesma tela (Rotina e
Lembretes); uma terceira criaria disputa sobre onde escrever. Cada linha e uma
CONTAGEM com botao que leva ao lugar onde se resolve. Ha prova no harness de que
nao existe `input` nem `textarea` dentro de `.pend-sec`.

O handler novo e `pend-ir`, que faz `E(data-aba).click()` — troca de aba do mesmo
jeito que o usuario faria, sem rota paralela.

---

## 8. Estado da suite

```
python ferramentas/validar.py          EXIT=0
python ferramentas/harness.py          EXIT=0   691 passou, 0 falhou
python ferramentas/prova_trilho.py     EXIT=0
python ferramentas/prova_grafico.py    EXIT=0
python ferramentas/prova_atmosfera.py  EXIT=0
node --check public/app.js             EXIT=0
python ferramentas/diag_mobile.py W    EXIT=0 em 360, 390, 414, 1280, 1440
```

Eram 680 antes da sessao. As 11 novas cobrem: placar fora da Hoje, regua no
rodape, numero inventado do mock que nao entrou, KPI em porcentagem, cor computada
da barra e da serie do grafico, coluna de hoje marcada, valor escrito por dia,
tint da celula de temperatura, gap entre fatias, ordem das secoes e a ausencia de
campo de digitacao em Pendencias.

Armadilha reencontrada: `validar.py` checa **substring** em `app.css`/`app.js`.
Escrever o nome de uma classe proibida DENTRO DE UM COMENTARIO reprova a suite.
Aconteceu nesta sessao com `cap-barra`.

---

## 9. Achados de banco que ficaram sem dono

Nao viraram tarefa. Ficam registrados porque foram medidos:

1. **Dois leads com `origem` nula, mesmo com o campo obrigatorio no formulario:**
   `LEAD-0019` (27/07) e `LEAD-0028` (16/08). Entraram por caminho que nao passou
   pela validacao do `w()`. Juntos valem **R$ 8.700** em venda concluida, ou seja
   o furo de cadastro esta justamente em quem compra.
2. **Indicacao e a maior origem em volume E em dinheiro**: 10 leads, 4 clientes,
   R$ 14.170 na janela de 90 dias. O mock inflava Instagram para 42% e omitia
   WhatsApp direto, que e o empate em volume.
3. **PII saiu para o Stitch.** O mock foi gerado com nome real de cliente, perfil
   e atraso visiveis (`Brenno Rodrigues`, `Eduarda DUDA`, `Zana`). Para a proxima
   geracao de mock, usar nome ficticio.

---

## 10. O que ficou aberto

1. **O dono declarou insatisfacao com o grafico de leads** ao autorizar o deploy
   ("estou insatisfeito com o grafico, mas melhoro depois"). Subiu como esta. Nao
   ha direcao registrada sobre o que incomoda: perguntar antes de redesenhar.
2. **A troca dos tokens globais de quente/morno/frio** foi oferecida e nao
   escolhida. Se entrar, exige remedir contraste de chip, ponto, Pitscare e card
   de cliente, e refazer `prova_trilho.py` e as provas de cor computada.
3. **A fase ja decidida continua a mesma da v33**: mover card no kanban = escrita
   de volta no Notion. O bloqueador nao e de codigo: a integracao precisa da
   capability **"Update content"** em notion.so/profile/integrations, senao o
   `PATCH /v1/pages/{page_id}` volta 403.
