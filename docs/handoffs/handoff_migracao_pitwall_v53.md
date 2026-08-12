# Handoff Migracao Pit Wall (Nucleo) v53

Substitui a v52. Data: 12/08/2026.

---

## 1. Headline: a aba Dashboard ganhou um painel de Performance de Vendas

Pedido do dono, em duas etapas. Primeiro: *"aba vendas com graficos de lucro e
faturamento circular, e em faturamento e lucro, opcao de clicar e ver detalhes."*
Depois de um mock: **"reprovado. tenho uma referencia visual do que quero"**, com
uma imagem de dashboard de e-commerce de 13 paineis, e *"quero exatamente nesse
formato."*

O que subiu: **dashboard de 12 cards na aba Dashboard** (KPI com icone e variacao,
rosca de canal, serie por mes, P&L, ranking, tabela de canal com conversao, rosca
de status, margem por condicao, insights) e a **coluna de valores da aba Vendas
virou faixa de 5 cards** no mesmo formato.

**Zero banco.** Nenhuma RPC, nenhuma migration, o `base` nao entrou. Tudo agrega
`vendasData` (v_venda), `vendasArq` e a base de leads que o `B()` ja deixa em
memoria. Trocar a janela custa **zero chamada de rede**.

---

## 2. A referencia estava com os numeros do dono e dois rotulos trocados

A imagem trazia **R$ 16.350,00** de "Receita Total" (o faturamento real dele, certo)
mas chamava de **"Ticket Medio"** o que era o **LUCRO** (R$ 1.096; o ticket real e
R$ 5.450) e de **"Taxa de Conversao"** o que era a **MARGEM** (6,73%; a conversao
real e 14,3%). "Pedidos 15" e "Itens 23" eram inventados: sao 3 vendas.

Achado que vale mais que a obra: **conferir o rotulo antes de copiar o layout.**
Um dashboard bonito com rotulo trocado ensina o dono a ler o numero errado.

---

## 3. O mapa honesto dos 13 paineis

| painel da referencia | virou |
|---|---|
| 5 KPIs com icone e delta | Faturamento · Lucro · Margem · Ticket medio · Conversao |
| Receita por canal (rosca) | Faturamento por canal, origem via `lead.origem` |
| Receita ao longo do tempo | **coluna por mes**, faturamento + lucro |
| Resumo Financeiro | P&L real, sem devolucoes e sem impostos |
| Produtos mais vendidos | Aparelhos, com margem de cada um, **sem foto** |
| Desempenho por canal | tabela: leads, vendas, faturamento, ticket, conversao |
| Status dos pedidos (rosca) | Status das vendas, incluindo arquivada e cancelada |
| Insights | 4 regras deterministicas |
| **Origens de trafego (sessoes)** | **Margem por condicao** |
| **Itens vendidos** | **fora** |
| **Devolucoes, Impostos** | **fora** |

Os quatro que mudaram, e o motivo esta escrito **dentro do proprio card**, para a
proxima sessao nao achar que foi esquecimento:

- **trafego nao existe.** O sistema nao tem analytics nenhum. Sessao inventada nao
  e dado. O slot recebeu margem por condicao, que responde pergunta de compra.
- **itens vendidos** e 1 aparelho por venda: repetiria o numero de Vendas.
- **devolucoes e impostos** nao tem coluna no cadastro de venda. Ficaram de fora
  em vez de nascerem zeradas, que seria afirmar uma medida inexistente.
- **linha diaria** sobre 3 vendas em 73 dias sao 3 bolinhas numa reta. Vira coluna
  por mes, e a linha volta sozinha a partir de 8 pontos.

---

## 4. DECISOES DO DONO CONTRA A RECOMENDACAO (registradas, e conscientes)

1. **A paleta da referencia entra ao pe da letra**: chips azul/verde/roxo/laranja
   e roscas coloridas. Isso **quebra a regra da `referencia-visual-v3`** de que o
   azul da marca aparece em quatro lugares e mais nenhum, e a regra do projeto de
   que barra colorida por categoria ja foi reprovada duas vezes.
   Mitigacao aplicada: **todo hex novo vive sob o prefixo `--d-`**, e so ali. Lendo
   o CSS da para separar num relance paleta importada de token medido. Nao misturar.
2. **Mora nas duas telas**: dashboard completo em Dashboard, faixa de 5 KPIs no
   topo de Vendas.

---

## 5. Os insights sao REGRA, nao IA

Quatro condicoes deterministicas em JS, sobre dado que ja esta na memoria:

| insight | regra |
|---|---|
| canal nao converte | canal com **>=5 leads e 0 vendas** |
| melhor canal | canal com **>=3 leads** e conversao acima da media |
| condicao rende mais | diferenca **>=5 p.p.** entre melhor e pior, com o `n` declarado |
| faturamento sem canal | **>=20%** do faturamento vindo de lead sem origem |

Sao **auditaveis** (o numero esta na tela ao lado), **de graca**, e **estaveis**
entre dois cliques. E limitados de proposito: so enxergam o que esta escrito ali.
Insight generativo seria outra obra: backend, chave de API, custo por leitura, e
deixaria de ser auditavel.

---

## 6. A metrica que estava errada: conversao acima de 100%

A primeira versao dividia **venda da janela por lead da janela**. Na foto deu
**"133,3%"** (4 vendas sobre 3 leads): venda de lead antigo entrava no numerador
sem estar no denominador.

Taxa acima de 100% nao e numero apertado, **e a tela dizendo que a conta esta
errada**. Virou **coorte**: quantos dos leads que ENTRARAM na janela ja fecharam.

Pior: o KPI dizia 0,0% e o rodape da tabela dizia 133,3% na mesma tela. **Duas
contas com o mesmo nome contradizendo uma a outra.** Agora as duas saem da mesma
funcao, e a nota do card declara que lead conta pela entrada e venda pelo
fechamento.

---

## 7. O que so a FOTO pegou (de novo)

Suite verde, e a tela com cinco defeitos:

1. **`R$ 11.200...` e `R$ 2.800,...` truncados.** O dashboard vive numa coluna de
   **~1030px**, nao nos 1440px da tela: o mock foi desenhado largo demais. O chip
   de icone comia 42px da linha do numero. **O icone foi para a linha do rotulo** e
   o numero ganhou o card inteiro.
2. Legenda `"s..."` no lugar de `"sem origem"`, `"Semino..."` no lugar de
   `"Seminovo"`. Rotulo agora **quebra**, nao trunca: `%` so quer dizer alguma
   coisa se der para ler de que fatia ele e.
3. Ranking com o nome do aparelho em **quatro linhas** de tres palavras.
4. Tabela de canal cortando **Ticket** e **Conversao**.
5. **Mes em prejuizo desenhado igual a mes de ganho**: a barra cresce para cima
   nos dois casos. Ganhou hachura vermelha, pelo mesmo motivo do v52 (lucro x
   prejuizo medem 1.32 de luminancia, matiz sozinho nao separa).

**Armadilha nova, e cara:** `foto.py` **so LE** o HTML que o `harness.py` montou.
Depois de editar `app.js`/`app.css` sem rodar o harness de novo, a foto sai
IDENTICA e parece que a correcao nao funcionou. Aconteceu nesta sessao e quase
virou "consertei e nao mudou nada". **O `foto.py` agora ABORTA** se `app.js`,
`app.css` ou `index.html` forem mais novos que a montagem. Fotografar estado
velho e pior que nao fotografar: da leitura errada com a confianca de quem olhou.

---

## 8. Guard-rails: dois reescritos, nenhum silenciado

- **`diag_mobile.py`, geometria do painel.** A assercao descrevia o layout antigo
  (valores na terceira coluna, a direita). Foi **reescrita** para o novo (faixa em
  cima ocupando a largura, dois graficos lado a lado embaixo) e continua reprovando
  se a faixa deixar de ocupar a largura, se os graficos subirem para a linha dela,
  ou se ficarem lado a lado no celular. Derrubada conscientemente, nao calada.
- **`diag_mobile.py`, estouro horizontal.** Elemento dentro de container com
  `overflow-x:auto` **rola por desenho**, nao vaza da tela: a tabela de 6 colunas
  num card estreito e a saida recomendada, e a prova acusava como defeito
  exatamente a correcao dele. Agora eles saem numa lista `rola` separada, que
  aparece so quando ja ha algo errado naquela aba — e o `scrollWidth` do documento
  segue reprovando a pagina.

**E foi essa segunda mudanca que pegou um defeito real meu:** a 360px o documento
ia a **361,06px**. `scrollWidth` e inteiro por especificacao, entao a prova passou
a medir tambem a **borda direita real com fracao** e a **nomear o elemento**. Era
`span.kp-ico.t-roxo`: o `<div>` de texto do card nao tinha `min-width:0`, nao
encolhia, e empurrava o chip para fora da tela.

---

## 9. Provas

Todas nesta maquina, **exit code conferido**, depois da ultima mudanca:

| prova | resultado |
|---|---|
| `python ferramentas/harness.py` | **352 passou / 0 falhou** — EXIT 0 |
| `python ferramentas/validar.py` | EXIT 0 |
| `python ferramentas/prova_trilho.py` | EXIT 0 |
| `python ferramentas/prova_grafico.py` | EXIT 0 |
| `python ferramentas/diag_mobile.py` 360/390/414/1280/1440 | EXIT 0 nos cinco |
| `node --check public/app.js` | EXIT 0 |

**As 352 assercoes passaram sem edicao nenhuma na suite.** A coluna de valores
mudou de forma (5 cards horizontais com icone, lucro e margem separados do par),
mas os `data-cel` (`vg-fat`, `vg-luc`, `vg-margem`, `vg-vazamento`, `vg-ticket`),
o `.vg-valores`, o `.pb-rot` e o `.vg-num` continuam exatamente onde estavam.
E o invariante 12 valendo: a chave e o **codigo**, e trocar aparencia nao pode
mover a chave de leitura.

---

## 10. Onde encostou

| arquivo | o que |
|---|---|
| `public/app.js` | bloco `dv*` novo (~300 linhas legiveis): janela propria, coorte de conversao, rosca SVG, 8 cards, insights por regra, cabecalho. `vgVal`/`vgValores` remontados no formato de card. `renderDash` passa a montar o dashboard ANTES das metricas de lead/conteudo, e a falha do `painel_metricas` nao derruba mais a tela toda. `vendaAcao` ganha `dv-janela` e `dv-ver-vendas`. **Linha 1 minificada intacta** |
| `public/app.css` | ~250 linhas novas sob `--d-*`; `.vg-corpo` virou faixa + 2 graficos; coluna do "por mes" estreitada (era o vazio que o dono reclamou) |
| `ferramentas/diag_mobile.py` | geometria reescrita, `overflow-x` reconhecido, borda direita com fracao e nome do elemento |
| `ferramentas/foto.py` | aborta com montagem velha; conhece Dashboard, NFs, Captacao e Indicacoes; mensagem de erro passou a listar as abas (usava `ID` depois de ja saber que era `None`) |
| `ferramentas/mock_dashboard.py` | **novo.** Gerador do mock aprovado, com o mapa dos 13 paineis |
| banco | **nao encostou** |

---

## 11. Pendencias

1. **O drill-down do pedido original NAO entrou.** O dono pediu "clicar em
   faturamento e lucro e ver detalhes"; o mock com a gaveta foi reprovado junto com
   o resto, e o formato novo nao tem esse caminho. **Os cards de KPI nao clicam.**
   Fatia propria e barata: a gaveta ja estava desenhada.
2. **`i` (leads) precisa estar carregado** para canal e conversao. O `B()` carrega
   no login e no Atualizar, entao na pratica sempre esta; mas se um dia o Dashboard
   for a primeira tela sem passar pelo `B()`, canal e conversao saem vazios sem
   dizer por que. Vale um estado explicito.
3. **2 de 3 vendas reais estao sem origem** (R$ 7.950). O painel de canal fica cego
   assim, e o proprio insight acusa isso. Correcao e do dono: preencher a origem
   dos leads.
4. Herdado do v52 e ainda aberto: `k()` chama `renderVendas` a cada tecla da busca
   (3 leituras de rede por tecla); `.gitattributes` com `* text=auto eol=lf`;
   relatorio de entrega sem `despachado_em`; `privado.fn_venda_atualizar` com
   EXECUTE para `authenticated` e SECURITY DEFINER; **Conteudo e Hoje continuam
   sem a forma nova** (sexta vez atropelados).
5. Escrita de volta no Notion segue bloqueada pela capability "Update content".

---

## 12. Armadilha de fim de linha, que entrou e foi corrigida

`ferramentas/foto.py` saiu da edicao em **CRLF** (o indice e LF). Pego com
`git ls-files --eol` **antes do commit** e convertido de volta. E a mesma
armadilha da secao 11 do v52, e o comando que responde de verdade continua sendo
`git ls-files --eol`, nunca `grep` por `\r`.
