# Handoff Financeiro v4 — dinheiro que so passa deixa de parecer receita e despesa

Data: 31/08/2026. Linha: financeiro. Substitui o `handoff_financeiro_pitwall_v3.md`
como topo da linha, sem apagar o que ele registra.

Sessao S1 da sequencia do bloco 1. Duas coisas grandes aconteceram antes da entrega e
mudaram o tamanho de tudo: **o import dos 7 meses** e a descoberta de que **o par Ford
era a maior linha "pendente" da base**.

---

## 1. A frase da entrega

**Dinheiro que so passa pela conta deixa de parecer receita e despesa.**

Sujeito visivel: selecionar os dois lados na aba Movimentos, clicar em **Marcar
repasse**, e ver na Visao a linha `R$ 4.800,00 em 1 repasse ficaram fora de entrou e
saiu`.

---

## 2. O que aconteceu antes da entrega

### 2.1 O import dos 7 meses (tarefa do dono, sem prompt)

O arquivo `Extrato 2` (Nubank `38773068-5`, OFX 1.02, 01/02 a 31/08/2026) entrou.

| medida | antes | depois |
|---|---|---|
| lancamentos | 181 | **1.132** |
| janela | 28/07 a 26/08, julho cortado | **01/02 a 31/08, 7 meses** |
| valor bruto | R$ 79.619,86 | **R$ 444.820,68** |
| cobertura em VALOR | 2,11% | **2,06%** |
| falta julgar | R$ 77.942,01 em 131 linhas | **R$ 435.670,20 em 860 linhas** |

**O dedupe se provou sozinho:** o total ficou em 1.132, exatamente a contagem do
arquivo. As 181 que ja estavam la foram reconhecidas por `hash_dedupe`/`fitid` e
nenhuma duplicou (D-d).

Dois fatos que os handoffs anteriores erravam:
- **`fin_regra` nao tinha 0 linhas, tinha 5.** O v2 7.3 estava desatualizado. Na
  importacao elas rodaram e classificaram 222 linhas novas (181 de UBER para
  `transporte`/pessoal, 87 para `alimentacao_fora`). E comportamento correto, nao
  violacao do Inv. 18: regra e decisao do dono repetida, nao inferencia.
- A concentracao do valor pendente foi medida: **47 linhas cobrem 50%, 104 cobrem 80%,
  289 cobrem 95%**. Julgar linha a linha e trabalho abandonado; regra por contraparte e
  a alavanca.

### 2.2 A correcao que o CONTRATO impos

Eu havia escrito, olhando as maiores contrapartes, que `NU PAGAMENTOS`, `STONE IP` e
`MERCADO PAGO` "cheiram a repasse". **O `P-W1-REPASSE` derruba isso**: a lista de
repasse e fechada e do dono. As tres nao entraram, e nenhuma regra foi criada para elas.
Fica registrado como erro meu, corrigido antes de virar codigo.

---

## 3. O que mudou

### 3.1 `supabase/migrations/20260831_fin_fatia3_repasse.sql`

Aplicada como `20260831231416_fin_fatia3_repasse`. Quatro partes:

- **categoria `repasse`**, grupo `Neutro` que ja existia, natureza `neutro`. Zero grupo
  novo, zero token de cor novo (C5). Como `neutro`, repasse conta como **julgado** no F3
  sem precisar de dominio, e esta certo: dinheiro de terceiro nao tem lado a decidir.
- **`fin_movimento.repasse_id uuid`** mais indice parcial. E o id **do par**, nao do
  lancamento: os dois lados carregam o mesmo uuid, entao "ja esta em outro par" e uma
  pergunta de uma linha e o par inteiro se le sem tabela nova.
- **`public.fin_repasse_marcar(payload)`**, escrita (devolve `erro`, C4), dono-only,
  `search_path` fixo, security invoker. Seis recusas nomeadas.
- **`public.fin_painel`** ganha a chave `repasse` com valor e contagem. A EXCLUSAO ja
  acontecia por natureza `neutro`; o que faltava era DECLARAR.

**O par e marcado a mao.** Casar automatico por valor e data seria inferencia sobre
contraparte, que e o Inv. 18. A folga de 5% e sobre o MAIOR valor, nao sobre a media:
existe para tarifa e arredondamento, nao para casar o que nao e par.

### 3.2 `public/app.js`

- `finRepasseLinha(rep)`: a declaracao na Visao, nos DOIS caminhos (com placar e com o
  bloco de base incompleta). Conta so o lado positivo do par e diz em quantos PARES.
- A acao **Marcar repasse** na barra de lote, que ja existia. Ela nasce no markup e
  alterna `hidden`: renderizar condicionalmente nao funcionaria, porque trocar caixa
  **nao repinta a barra** (`finPintarLote` so mexe na classe e no contador, de
  proposito, para nao perder o scroll da lista). Foi defeito real, pego pela suite.
- A tela le o SINAL para saber quem e entrada e quem e saida. Isso e leitura do dado,
  nao inferencia de significado, e o servidor recusa se vier errado.

### 3.3 `public/app.css`

`.fin-repasse-lin`, no tom do `.fin-rodape` que ja explica o balde `neutro`. Zero token
novo. **Nao e alerta**: cobrar em vermelho o que nao e problema ensina o dono a ignorar
o vermelho.

### 3.4 `docs/financeiro/CONTRATO.md`

Seis recusas novas na secao 4, no mesmo commit que as cria.

### 3.5 `ferramentas/harness.py` e `ferramentas/diag_mobile.py`

15 assercoes `fin3:` novas de repasse, o stub da RPC com as REGRAS DE VERDADE (sinal,
5% do maior, par ja usado) e tres linhas novas no fixture. O `diag_mobile` passa a
cobrar que a acao de repasse apareca com dois selecionados, senao a barra de lote no
estado mais largo nunca seria medida no celular.

---

## 4. O que foi PROVADO

### 4.1 A RPC, contra o banco vivo, sem sujar producao

DO block com `raise exception` no fim: roda tudo e a transacao desfaz sozinha.
Conferido depois: `0` linhas com `repasse_id`, `0` com categoria `repasse`.

| # | prova | resultado |
|---|---|---|
| 1 | par Ford real (4.800 x −4.800) | `ok:true`, diferenca **0,00%** |
| 2 | mesmo par de novo | `Lancamento ja faz parte de outro repasse.` |
| 3 | invertido | `Entrada e saida invertidas: ...` |
| 4 | desigual, 500 x 50 | `Par desigual: a diferenca e de 90.00%, acima dos 5% permitidos.` |
| 5 | mesmo lancamento nos dois lados | `Entrada e saida sao o mesmo lancamento.` |
| 6 | id inexistente | `Lancamento nao encontrado.` |
| 7 | payload vazio | `Informe a entrada e a saida do repasse.` |
| 8 | segundo par exato (300 x −300) | `ok:true` |
| 9 | `fin_painel.repasse` com os dois pares | `{"n": 4, "valor": 5100.00}` |

O `valor` conta so o lado que entrou (4.800 + 300), nao os quatro lancamentos: somar os
dois lados declararia o dobro do que passou.

### 4.2 O par Ford estava escondido como gasto

`ade61039` +R$ 4.800,00 em 30/07 e `efa4fa7d` −R$ 4.800,00 em 06/08, ambos
`AGENCY FORD SUL C MODELOS` / `FORD MODELS SUL`. **Era a maior linha pendente da base
inteira**, a mesma R$ 4.800,00 que o `p_ordem=valor` da v3 poe em primeiro lugar.

### 4.3 Git contra banco, por CORPO

**16 de 16 `fin_` batem por corpo normalizado**, nos dois sentidos.
A nova: `fe11e66757b7e1e355926f522ac34b12`.

### 4.4 A suite, por EXIT CODE

Seis comandos EXIT 0 e `diag_mobile` EXIT 0 em 360, 390, 414, 1280 e 1440.
**902 -> 917 assercoes, 0 falhas.**

Sete assercoes antigas mudaram de NUMERO porque o fixture cresceu tres linhas
(4 -> 7 sem classificacao, 10 -> 13 na janela, 12 -> 15 na base das regras).
Cada uma foi conferida uma a uma: **nenhuma foi afrouxada**, todas seguem medindo o
mesmo comportamento. A recusa de padrao amplo continua disparando porque 4 de 15 e
26,7%, que ainda cruza o corte de 25% do interruptor `__FIN_AMPLO`.

---

## 5. Portao de saida (`CONTRATO.md` 6.2), item a item

| # | Item | Resposta |
|---|---|---|
| 1 | SQL rodado no banco de verdade | **SIM.** `apply_migration` mais 9 provas da RPC |
| 2 | RLS testada como dono E como vendedor | **NAO nesta entrega.** A `fin_repasse_marcar` tem o mesmo par de guardas das outras 12 (`Sessao invalida.` / `Financeiro e restrito ao dono.`), exercitado na v3 para tres RPCs, mas esta especifica so foi rodada como dono. Escrito NAO de proposito |
| 3 | a tela le todo campo novo, zero campo orfao | **SIM.** `repasse.valor` e `repasse.n` viram a linha da Visao; `valor` do retorno da RPC vira o toast; `erro` vira a recusa exibida |
| 4 | assercao nova com prefixo de fatia | **SIM.** 15 `fin3:` de repasse |
| 5 | EXIT 0 nos comandos e nas 5 larguras | **SIM.** Ver 4.4 |
| 6 | commit unico, incluindo spec e plano | **SIM**, um commit. Sem spec/plano em arquivo: a spec e o texto do `P-W1-REPASSE` no `PROMPTS.md`, ja versionado |
| 7 | handoff atualizado | **SIM.** Este arquivo e o indice |
| 8 | nenhuma recusa nova fora da secao 4 | **SIM.** As seis entraram no mesmo commit |

### 5.1 Portao de confianca (6.3)

**Nenhum numero mudou de valor nesta entrega**, porque nenhum par foi marcado em
producao. Quando o dono marcar o primeiro, `entrou` e `saiu` VAO encolher, e a
explicacao ja esta na tela, na mesma janela, na linha que declara quanto e por que.
Era exatamente o que a Task 1 da Fatia 2.1 nao fez e gerou o 6.3.

---

## 6. Ressalvas, sem maquiar

- **Nao existe caminho para DESMARCAR um par.** O `P-W1-REPASSE` nao pede, e ampliar
  escopo por conta propria e o que o `P-FREIA` existe para impedir. Mas e uma acao sem
  volta na tela do dono, e isso merece decisao dele, nao silencio meu.
- **Nada foi verificado no app rodando.** Chrome headless com stub nas 5 larguras.
- **Nenhum par foi marcado em producao.** As quatro contrapartes decididas seguem
  pendentes de julgamento no banco.
- A lista de repasse foi decidida quando a base tinha 2 meses. Agora tem 7. **Decisao
  consciente do dono (opcao A): construir com a lista fechada e revisar depois.**
- **`apply_migration` rodou pela Torre, nao pelo subagente `base`**, pelo mesmo conflito
  registrado na v3 secao 6.

---

## 7. Pendencias

### 7.1 Divergencias

| # | Estado |
|---|---|
| D-1 | **PAGA** na v3 |
| D-2 | aberta, cabe no `P-R2` |
| D-3 | aberta, e o `P-R1` |
| D-4 | aberta e **cresceu**: `Dominio invalido: use empresa, pessoal ou tudo.` no servidor contra `use empresa ou pessoal` na secao 4; `Status invalido: use todos ou nao_classificados.` fora da secao 4 |
| D-5 | aberta, sem dono na fila (`FIN_GRUPO` por rotulo, fere o Inv. 12) |
| D-6 | aberta, sem dono na fila (ternario morto) |
| D-7 | vira o `P-R1` |
| **D-8** | **NOVA, achada nesta sessao:** `fin_config` devolve `dominio_sugerido` e `grep -c dominio_sugerido public/app.js` = **0**. Campo orfao, mesma classe da D-3 |

### 7.2 Herdadas

- **132 migrations aplicadas no banco sem arquivo no git.** Divida declarada, nao paga.
- `LEDGERBAL` guardado e nunca conferido contra a soma dos movimentos.
- `20260826_fin_fatia21_painel_abatimento_sem_categoria.sql` segue sem a linha
  `-- migration aplicada:`. Agora 15 de 16 tem.
- A faixa do Inv. 18 usa `--erro` onde o D-o e o C5 mandam `--morno`.
- Contagem da suite divergente entre `CLAUDE.md` ("SEIS comandos") e `CONTRATO.md`
  ("7 comandos").
- **`CLAUDE.md` declara 885 assercoes.** Medido: a baseline era 882, e agora sao 917.

---

## 8. Invariantes reforcados

- **Inv. 18, na pratica mais dura:** a lista de repasse e do dono, fechada, e eu tentei
  ampliar por semelhanca de nome. O contrato segurou antes de virar codigo.
- **C3:** nenhuma frase de recusa nasce no JS. O texto exibido quando o par e desigual e
  o que o servidor mandou, com o numero dentro.
- **Novo, nomeado aqui:** numero excluido em silencio e da mesma familia da D-7. Excluir
  esta certo; nao dizer que excluiu e que gasta a confianca.
- **Novo, sobre a suite:** o `TESTE` do harness NAO e string raw. `\b` numa regex vira
  o caractere de backspace no JS entregue ao navegador, e a assercao passa a procurar
  algo que nao existe. Custou uma rodada vermelha.

---

## 9. Primeiro movimento do proximo chat

`P-ABRE` em sessao nova, e depois **`P-R1`** (sessao S2 da sequencia), que paga D-3 e
D-7 de uma vez.

Antes disso, duas tarefas do dono, sem prompt e sem sessao:
1. **Marcar os pares de repasse no app.** O par Ford ja esta identificado
   (`ade61039` e `efa4fa7d`).
2. **Decidir se desmarcar par vira entrega propria** (secao 6).
