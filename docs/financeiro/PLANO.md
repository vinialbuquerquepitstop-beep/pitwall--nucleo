# Plano Mestre do Financeiro (Pit Wall 2.0)

Revisao 2, 27/08/2026. Substitui a revisao 1 do mesmo arquivo e todos os documentos anteriores como documento de operacao.

---

## 0. Correcao: o que era medido e o que era chute meu

Eu publiquei tres versoes de "quanto entrou de receita" (R$ 24.975, depois R$ 11.850) e um saldo de investidor de R$ 12.055. **As tres estavam erradas**, e a causa foi sempre a mesma: eu atribui SIGNIFICADO a contrapartes sem que voce tivesse dito o significado.

### O que e fato, medido no banco

```
Base: 181 linhas, 28/07/2026 a 26/08/2026, uma janela de 30 dias
131 linhas sem dominio
  entradas   R$  39.664,38
  saidas     R$ -38.277,63
  bruto      R$  77.942,01

BR IPHONES (CNPJ 26.426.950), dentro da janela:
  6 linhas entrando   R$ 15.675,00
  2 linhas saindo     R$  3.620,00
```

### O que era interpretacao minha, e caiu

- que os R$ 15.675 fossem aporte de investidor: **falso**, voce disse que nao ha aporte nenhum;
- que a diferenca de R$ 12.055 fosse saldo de alguem com voce: **falso pelo mesmo motivo**;
- toda estimativa de "receita do periodo": **sem base**, porque dependia das duas acima.

### O erro tecnico por tras, que vale como regra

**Uma janela de 30 dias corta ciclo.** Se dinheiro sai antes de 28/07 e volta em agosto, ou entra em agosto e volta em setembro, qualquer conta de "entrou menos saiu por contraparte" dentro da janela inventa um saldo que nao existe. Foi exatamente o que aconteceu com o BR IPHONES.

Com **um** mes de extrato, nenhuma relacao ciclica pode ser lida corretamente. Nao e falta de esforco: e falta de dado.

### As duas regras que saem disso, e entram no sistema

```
15. A tela NUNCA exibe numero economico derivado de um periodo cuja base esteja
    abaixo de 95% julgada em VALOR. Exibe "base incompleta: N% julgado" no lugar.
    Vale para receita, margem, ponto de equilibrio, meta, provisao e alerta.

16. Saldo por contraparte, quando existir, calcula sobre TODA a base, nunca sobre
    a janela selecionada, e declara desde quando esta contando. Com menos de
    3 meses de base, nao e exibido.
```

O invariante 15 e a versao em codigo do erro que eu cometi. Se ele existisse, a tela teria escrito `base incompleta: 2% julgado` em vez de um numero de receita, e eu nao teria como publicar tres numeros errados.

---

## 1. Decisoes fechadas

| # | Decisao | Estado |
|---|---|---|
| D1 | **Nao existe aporte.** O conceito de capital de terceiro sai do plano | fechada, dono |
| D2 | Joao Victor, Bruno e Ricardo sao **conta de passagem** (repasse) | fechada, dono |
| D3 | BRABA STUDIOS foi caso especifico. Sem regra, classificacao manual | fechada, dono |
| D4 | Nao existe estoque parado. Indicador removido | fechada, dono |
| D5 | Nao existe concentracao de cliente. Indicador removido | fechada, dono |
| D6 | Metas e provisoes sao **propostas por agente**, aprovadas por voce | fechada, dono |
| D7 | A tela primaria e a **Visao Pessoal**, com grafico | fechada, dono |
| **A1** | **BR IPHONES: o que sao esses movimentos?** | **ABERTA. Bloqueia numero, nao bloqueia construcao** |

A1 e a unica pergunta que sobrou, e ela **nao trava o plano**: ela trava o numero. A ferramenta que voce vai construir existe justamente para que voce responda esse tipo de pergunta uma vez, no app, em vez de responder para mim no chat.

---

## 2. Os cinco tipos de dinheiro

| Tipo | Entra em resultado? | Estado |
|---|---|---|
| **Receita** | sim | existe |
| **Gasto** (empresa ou pessoal) | sim | existe |
| **Neutro** (aplicacao, resgate, entre contas suas) | nao | existe |
| **Abatimento** (estorno, reembolso em categoria de gasto) | reduz o gasto | servidor pronto, tela nao le |
| **Repasse** (dinheiro de terceiro que so passa, entra e sai) | nao | **construir** |

**Aporte sai do plano** (D1). Fica registrado como conceito **reservado**: se um dia existir capital de terceiro de verdade, o desenho esta descrito na revisao 1 deste arquivo, no historico do projeto. Construir agora seria superficie para um caso que nao existe, que e o erro que este projeto ja recusa em outros lugares.

---

## 3. Os agentes

### 3.1 A regra que impede o agente de virar espelho

Meta derivada de habito canoniza o passado. Se voce gasta demais, um agente que olha seu historico abençoa o excesso e chama de meta.

**A meta sai de capacidade, nao de habito:**

```
capacidade = receita media - custo fixo medio - provisoes propostas
```

| Situacao | Proposta |
|---|---|
| habito < capacidade | propoe o habito. Voce ja esta saudavel, so trava o teto |
| habito > capacidade | propoe a **capacidade** e mostra o corte em reais |
| capacidade negativa | **nao propoe meta.** Declara que o mes nao fecha e que o problema e receita ou custo fixo, nao gasto pessoal |

### 3.2 Modo declarado, por causa da base curta

Voce tem 1 mes de extrato. Nao existe media de nada. O agente sempre declara em que modo esta:

| Modo | Base julgada | Comportamento |
|---|---|---|
| **Bloqueado** | < 95% em valor | **nao propoe nada.** Diz o que falta julgar (invariante 15) |
| **Provisorio** | 1 a 2 meses | propoe com a marca `PROVISORIO` e diz que 1 mes nao e padrao |
| **Medio** | 3+ meses | media movel |
| **Maduro** | 6+ meses | sazonalidade e provisao de prazo |

O modo Bloqueado e novo nesta revisao, e e a aplicacao direta do meu erro: **melhor nao propor do que propor sobre base incompleta.**

### 3.3 Os tres agentes

**Agente 1, Classificador.** Roda apos toda importacao.
- agrupa as linhas novas por contraparte;
- par que se anula em ate 5% dentro da base inteira, nao da janela: propoe `repasse`;
- categoria por semelhanca com o ja classificado;
- **dominio somente quando voce ja classificou aquela contraparte no mesmo dominio 3 vezes ou mais**. Contraparte nova sai com dominio nulo, sempre;
- entrega lote ordenado por valor, para aprovacao em um clique. **Nunca grava sozinho.**

**Agente 2, Fechamento e Conselheiro.** Dia 1, e sob demanda.
- a leitura do mes em 4 a 6 linhas;
- propostas de meta de retirada (3.1), provisao de imposto (aliquota efetiva medida, ou faixa marcada `confirmar com contador` se nao houver saida de imposto na base) e reserva de operacao;
- respeita o modo (3.2). Em modo Bloqueado, escreve o que falta e nao propoe.

**Agente 3, Vigia.** Semanal. Os 8 alertas da secao 5.

### 3.4 Invariantes novos, para o `CONTRATO.md`

```
13. Agente PROPOE, dono APROVA. Nenhum agente grava dominio, meta ou provisao sozinho.
14. Dominio proposto por agente so pode REPETIR decisao que o dono ja tomou 3 ou mais
    vezes para a mesma contraparte. Contraparte nova sai com dominio nulo, sempre.
15. A tela nunca exibe numero economico derivado de periodo com base abaixo de 95%
    julgada em VALOR. Exibe "base incompleta: N% julgado".
16. Saldo por contraparte calcula sobre toda a base, nunca sobre a janela, declara
    desde quando conta, e nao aparece com menos de 3 meses de base.
```

---

## 4. As telas

### 4.1 Visao Pessoal, a tela padrao

Abre em `Pessoal`. Empresa vira a segunda aba.

- **Gastei**, comparado com a **media de 3 meses**, nunca com o mes anterior sozinho.
- **Onde foi**: barras por categoria pessoal. Sao 11, ja existentes: Moradia, Mercado, Familia, Alimentacao fora, Transporte, Saude, Educacao, Lazer, Assinatura, Vestuario, Outro (pessoal).
- **Para quem foi**: top 5 contrapartes do mes, valor e numero de vezes. Categoria e abstrata; contraparte e onde voce se reconhece.
- **Mudou este mes**: no maximo 3 frases, geradas de regra.
- **6 meses**: serie do total pessoal, so com 2+ periodos.

Enquanto a base pessoal estiver abaixo de 95% julgada em valor, cada bloco mostra `base incompleta: N% julgado` no lugar do numero. A tela nao esconde e nao chuta.

Restricao de construcao: **zero token de cor novo**, barra de magnitude num tom so, `Sem categoria` sempre `--morno`. Passa por `prova_grafico.py`, `prova_trilho.py` e `prova_atmosfera.py`.

### 4.2 Bloco Meta Saudavel

```
   custo fixo da loja
 + retirada planejada (meta aprovada)
 + provisoes do mes
 = NECESSIDADE
 - receita ja recebida  (sem repasse, sem resgate, sem transferencia interna)
 = FALTAM R$ X em N dias
```

`Faltam R$ X em N dias` e o unico numero do sistema que muda o que voce faz hoje. Sujeito ao invariante 15: com base incompleta, o bloco diz o que falta julgar em vez de mostrar um alvo falso.

---

## 5. Os oito alertas

Cada um com limiar, piso em reais e silencio minimo. Alerta que dispara todo mes vira decoracao.

| # | Alerta | Dispara | Piso | Silencio |
|---|---|---|---|---|
| 1 | Categoria pessoal acima da media | > 30% acima da media de 3 meses | R$ 100 | 30 d |
| 2 | Passou da meta de retirada | acumulado > meta aprovada | — | 7 d |
| 3 | **Assinatura nova** | cobranca recorrente de contraparte inedita | R$ 20 | uma vez |
| 4 | Provisao do mes nao separada | passou do dia definido | — | 7 d |
| 5 | Meta reversa em risco | falta > 30% da necessidade com < 7 dias | — | 3 d |
| 6 | Importacao nao fecha com o saldo | diferenca > R$ 1,00 | — | por importacao |
| 7 | **Linha grande sem julgamento** | > R$ 500 sem dominio ha > 3 dias | R$ 500 | 3 d |
| 8 | Base caiu abaixo de 95% julgada em valor | apos toda importacao | — | 3 d |

O alerta 8 substitui o antigo teto de capital de terceiro, que saiu com o aporte. Ele e o guardiao do invariante 15: avisa quando o sistema deixou de poder mostrar numero.

---

## 6. Schema delta

Aditivo. Nenhum grupo novo, nenhum token de cor novo.

**Colunas:**
```
fin_movimento.contraparte      text null   -- nome normalizado, extraido na importacao
fin_movimento.regra_id         uuid null   -- procedencia
fin_movimento.repasse_id       uuid null   -- par de repasse
fin_movimento.arquivado_por    uuid null
```

**Categorias novas, 4:** `repasse` (grupo `Neutro`), `ifood`, obra da casa, obra da loja.
`aporte` e `devolucao_aporte` **saem** (D1). `fin_categoria.natureza_capital` sai junto.

**Tabelas novas, 4:** `fin_provisao`, `fin_meta`, `fin_alerta`, `fin_proposta`.

**View nova, 1:** serie mensal de gasto pessoal por categoria.
A view de saldo por contraparte sai (D1 e invariante 16).

**RPCs novas:** `fin_categoria_salvar`, `fin_movimento_arquivar`, `fin_repasse_marcar`, `fin_conferir_saldo`, `fin_pessoal`, `fin_meta_salvar`, `fin_provisao_salvar`, `fin_proposta_responder`, `fin_alertas`, `fin_cobertura` (o % julgado em valor, que alimenta o invariante 15).

---

## 7. O calendario

| Semana | Entregas | O que voce tem no fim |
|---|---|---|
| **1** | R0 git · R1 abatimento · R2 a faixa cobrando o numero certo · **repasse como categoria** · `fin_cobertura` e o invariante 15 na tela | **a tela para de poder mentir.** Ou mostra numero com base julgada, ou declara que a base esta incompleta |
| **2** | R3 arquivar · R4 criar categoria · R6 conferencia de saldo · **contraparte gravada e backfill** · **voce julga a base** | **a base fica limpa e nomeada**, e as perguntas do tipo "o que e o BR IPHONES" viram um clique seu, nao um chat |
| **3** | **Visao Pessoal** com graficos, top 5 contrapartes, "mudou este mes" · **Agente 1** | **voce bate o olho e ve onde gastou** |
| **4** | `fin_provisao`, `fin_meta`, meta reversa · os 8 alertas · **Agente 2** e **Agente 3** | **o sistema propoe e cobra** |

**Portao entre a semana 2 e a 3:** 95% do valor julgado, repasse separado, saldo conferindo, git igual ao banco. Se reprovar, a semana 3 nao comeca.

---

## 8. Os prompts

Continuam validos os de `plano_de_prompts_financeiro_v1`: P-ABRE, P-FECHA, P-AUDITA, P-R0 a P-R6, P-FREIA, P-NAO-INVENTA, P-DECIDE.

Primeiro passo: acrescentar os invariantes 13 a 16 ao `docs/financeiro/CONTRATO.md`.

**P-W1-CAPITAL foi cancelado** (D1). Substituido pelos dois abaixo.

### P-W1-REPASSE (semana 1)

```
Frase da entrega: dinheiro que so passa pela conta deixa de parecer receita e despesa.

Contexto decidido pelo dono, nao inferir:
- Sao repasse: o par Ford (entra AGENCY FORD SUL C MODELOS, sai FORD MODELS SUL),
  Joao Victor da Cunha Pinheiro, Bruno da Costa Azevedo, Ricardo Meireles de Oliveira.
- NAO existe aporte de investidor. Nao crie categoria de aporte, nem coluna
  natureza_capital, nem view de saldo por contraparte.
- BR IPHONES: significado ainda NAO definido pelo dono. Nao classifique, nao crie
  regra, nao chute. Deixe na fila de julgamento.

Tarefa, vertical:
1. Categoria `repasse` no grupo Neutro (nao criar grupo novo, nao criar token de cor).
2. Coluna fin_movimento.repasse_id uuid null.
3. RPC fin_repasse_marcar(payload): {entrada_id, saida_id} liga o par e marca os dois
   como repasse. Recusa nomeada quando a diferenca passar de 5% do maior valor.
4. fin_painel EXCLUI repasse de entradas e saidas e DECLARA o valor excluido em
   linha propria. Nao esconda: declare.
5. Assercoes fin3:.
```

### P-W1-COBERTURA (semana 1, a mais importante desta revisao)

```
Frase da entrega: a tela nunca mais mostra um numero economico sobre base incompleta.

Contexto: a base tem 181 linhas e menos de 2% do VALOR julgado. Todo numero de
receita, margem ou meta calculado hoje esta errado. Isso ja produziu erro real.

Leia os invariantes 15 e 16 do CONTRATO.md antes de comecar.

Tarefa, vertical:
1. RPC fin_cobertura(p_ini, p_fim): devolve
   valor_bruto_total, valor_bruto_julgado, pct_julgado,
   e o mesmo recortado por dominio (pessoal, empresa).
   Julgado = tem dominio, OU tem categoria de natureza neutro.
   (o neutro conta como julgado: aplicacao e resgate nao tem lado a decidir)
2. fin_painel e fin_pessoal passam a devolver o pct_julgado da janela pedida.
3. Tela: quando pct_julgado < 95, o bloco de numero economico e SUBSTITUIDO por
   `base incompleta: N% julgado · faltam R$ X em Y linhas`, com botao que leva
   para Movimentos ja filtrado e ordenado por valor.
   Nao e um aviso ao lado do numero. E no lugar do numero.
4. Assercoes fin3:, incluindo uma que PROVE que com base abaixo de 95% nenhum
   numero de receita, margem ou meta chega na tela.

Este e o guardiao de todo o resto do plano. Se ele nao existir, os agentes das
semanas 3 e 4 vao propor coisas sobre dado incompleto.
```

### P-W2-CONTRAPARTE (semana 2)

```
Frase da entrega: cada linha sabe de quem veio ou para quem foi.

Tarefa, vertical:
1. Coluna fin_movimento.contraparte text null.
2. Extracao na importacao: nome normalizado da descricao. O extrato usa ' - ' como
   separador e o nome vem no segundo trecho; 'Aplicação RDB' e 'Resgate RDB' nao tem
   separador. Trate os dois e me diga quais linhas ficaram sem contraparte.
3. Backfill das 181 linhas em migration IDEMPOTENTE (a extracao pode mudar depois).
4. Tela: contraparte visivel na linha de Movimentos, e agrupamento por contraparte
   no filtro.
5. Assercoes fin3:.

NAO construa saldo por contraparte. Invariante 16: janela de 30 dias corta ciclo e
inventa saldo. Com 1 mes de base, esse numero mente.
```

Os prompts P-W3-PESSOAL, P-W3-AGENTE1, P-W4-META e P-W4-AGENTES seguem como estao na revisao 1, com duas mudancas obrigatorias: respeitar o invariante 15 (modo Bloqueado abaixo de 95%) e remover qualquer mencao a aporte.

---

## 9. Medidor semanal

| Numero | Alvo |
|---|---|
| % do **valor bruto** julgado | >= 95% |
| defeitos visiveis abertos | 0 |
| divergencia git x banco | 0 |

---

## 10. O que fica fora

Patrimonio · saldo em tempo real · lucro e margem contabil a partir do caixa · cartao com parcelamento · Open Finance · IA financeira · metricas de SaaS · taxa de economia · estoque parado (D4) · concentracao (D5) · **capital de terceiro e aporte (D1)** · canal externo de alerta.

---

## 11. Riscos declarados

1. **Base de um mes nao permite conta nenhuma.** Ate haver 3 meses julgados, o sistema deve recusar-se a exibir numero economico. E o invariante 15, e ele custa uma entrega da semana 1.
2. **Janela corta ciclo.** Qualquer netting por contraparte dentro de um periodo inventa saldo. Invariante 16.
3. **O agente pode virar carimbo.** Se voce aprovar os lotes sem ler, o invariante 18 morre na pratica mesmo intacto no codigo. Defesa: lote ordenado por valor, as primeiras linhas concentram quase tudo.
4. **Quatro semanas e orcamento, nao prazo.** Se ao fim da semana 4 a aba nao estiver sendo aberta toda semana, congele escopo novo e use o que existe.

---

## 12. Primeiro movimento

1. Acrescentar os invariantes 13 a 16 ao `CONTRATO.md`.
2. `P-ABRE` · `P-R0` · `P-FECHA`. 30 minutos.
3. `P-ABRE` · `P-W1-COBERTURA` · `P-FECHA`. E a entrega que impede o sistema de repetir o erro que eu cometi.
4. `P-W1-REPASSE`, `P-R1`, `P-R2`.
5. Semana 2, voce julga a base. **A partir dai os numeros passam a existir.** Antes disso, nao existem, e nenhum documento deveria ter dito que existiam.
