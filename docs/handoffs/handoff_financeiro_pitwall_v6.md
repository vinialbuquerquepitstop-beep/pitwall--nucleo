# Handoff Financeiro v6 — repasse so existe em par, e a defesa vive no servidor

Data: 31/08/2026. Linha: financeiro. Substitui o `handoff_financeiro_pitwall_v5.md`
como topo da linha.

Terceiro conserto de portao da sessao S1, disparado por um defeito **medido em
producao**, no uso real do dono. Registra tambem uma **regressao que eu introduzi e
consertei dentro da propria sessao**.

---

## 1. O defeito, medido em producao

O dono foi marcar o par Ford e o banco mostrou outra coisa:

| medida | valor |
|---|---|
| linhas com `repasse_id` | **0** — nenhum par existia |
| linhas com categoria `repasse` | **1**, so a perna de saida |
| qual | `efa4fa7d`, `FORD MODELS SUL`, −R$ 4.800,00, 06/08 |

Ele escolheu **`Repasse` no seletor de categoria da linha** (`fin_classificar`), em vez
de usar o botao `Marcar repasse`. E podia: a categoria aparecia no dropdown de toda
linha, porque `fin_config` devolve as 34 e a tela monta o seletor com todas.

O estrago: a exclusao dos totais acontece por **natureza `neutro`**, que nao sabe nada
de par. Entao repasse sem contraparte **sai de `entrou`/`saiu` do mesmo jeito**, sem
nada provando que o dinheiro voltou. O numero declarado na tela acertava por sorte, e a
despesa ficava escondida atras de uma categoria neutra: exatamente a exclusao silenciosa
que o `repasse_id` existia para impedir.

**Isso e defeito meu, nao erro dele.** Eu criei uma categoria que so faz sentido em par e
deixei ela escolhivel a mao.

---

## 2. O que mudou

### 2.1 Limpeza do dado

A linha voltou a `sem categoria` pela propria RPC (`fin_classificar` com
`categoria_codigo: null`), nao por `UPDATE` solto. Conferido: `0` com categoria,
`0` com par.

### 2.2 `20260831235349_fin_fatia3_repasse_so_por_par`

- `fin_categoria.atribuivel_manual boolean not null default true`, com `false` para
  `repasse`. **Flag no servidor, nao lista chumbada no JS** (C2).
- `fin_config` devolve a flag.
- `fin_classificar` **RECUSA** categoria nao atribuivel a mao. Sumir do seletor e
  conforto; o payload da RPC e publico e a tela nunca e o guarda.

### 2.3 `20260831235504_fin_fatia3_restaura_classificar` — a regressao que eu criei

Ao enxertar a guarda, **reconstrui o corpo da `fin_classificar` de memoria em vez de
copiar do arquivo versionado**. Perdi quatro coisas, todas de volta agora:

1. `and m.arquivado_em is null` na contagem de incoerencia de sinal;
2. a mensagem `Nada mudou: os lancamentos ja estavam assim.` quando `n = 0`;
3. o texto do aviso de sinal contrario, que perdeu o `Confira se a categoria e a certa.`;
4. **o bloco `exception` inteiro** (`foreign_key_violation`, `check_violation`), ou seja,
   duas recusas nomeadas da secao 4 deixaram de existir e o erro cru do Postgres passaria
   a vazar para a tela.

E a MESMA licao que o `P-AUDITA` desta sessao ja tinha registrado sobre a fatia21:
**corpo de funcao se COPIA, nunca se transcreve no olho.** Registrado aqui porque errar
duas vezes o mesmo erro no mesmo dia e informacao, nao detalhe.

### 2.4 `20260831235630_fin_fatia3_repasse_conta_por_par`

`fin_painel` passa a contar repasse por **`repasse_id`** (que so a `fin_repasse_marcar`
escreve) e devolve o **orfao** em separado (`orfao_valor`, `orfao_n`): categoria de
repasse sem par vira PROBLEMA declarado, em vez de numero certo por acidente.

### 2.5 `public/app.js` e `public/app.css`

- `finOpcoesCat` filtra por `atribuivel_manual`, **mantendo a opcao quando ela ja e o
  valor da linha**, senao o `<select>` de um repasse mostraria outra coisa.
- `finRepasseOrfao(rep)`: a linha que cobra o orfao, em `--morno`, dizendo o valor e
  **o que fazer** ("Marque o par, ou troque a categoria da linha"). Zero token novo.

### 2.6 `docs/financeiro/CONTRATO.md`

Recusa nova na secao 4: `Categoria nao pode ser escolhida a mao: <codigo>`.

---

## 3. O que foi PROVADO

### 3.1 No banco vivo, desfeito por `raise exception`

| prova | resultado |
|---|---|
| `repasse` a mao pela RPC | `Categoria nao pode ser escolhida a mao: repasse` |
| categoria normal segue funcionando | `1 lancamento classificado.` |
| **restaurado:** repetir a mesma | `Nada mudou: os lancamentos ja estavam assim.` |
| **restaurado:** aviso de sinal | `1 lancamento ficou com o sinal do valor contrario a natureza da categoria. Confira se a categoria e a certa.` |
| categoria inexistente | `Categoria desconhecida ou desativada: nao_existe` |
| o par pela RPC propria | `true` |

### 3.2 Na suite

**922 -> 930 assercoes, 0 falhas.** As 8 novas cobrem exatamente o buraco:

- `Repasse` nao aparece no seletor da linha nem no do lote;
- **o SERVIDOR recusa mesmo com o payload montado a mao** (a assercao que importa);
- repasse sem par e declarado como problema, com valor, com o que fazer, em `--morno`;
- e o repasse COM par segue declarado em separado: um nao contamina o outro.

EXIT 0 nos seis comandos e nas cinco larguras.

### 3.3 Git contra banco

**20 de 20 `fin_` batem por corpo normalizado**, nos dois sentidos. O arquivo da
migration que introduziu a regressao foi reconstruido e conferido **byte a byte** contra
o ledger: 7616 chars, md5 RAW `8bb691dc4663cbd1de29940fdec7d571` nos dois lados.

---

## 4. Portao de saida

| # | Item | Resposta |
|---|---|---|
| 1 | SQL rodado no banco de verdade | **SIM** |
| 2 | RLS testada como dono E como vendedor | **NAO.** Segue pendente desde a v4 |
| 3 | a tela le todo campo novo, zero campo orfao | **SIM.** `atribuivel_manual` filtra o seletor; `orfao_valor` e `orfao_n` viram a linha de cobranca |
| 4 | assercao nova com prefixo de fatia | **SIM.** 8 `fin3:` |
| 5 | EXIT 0 nos comandos e nas 5 larguras | **SIM** |
| 6 | commit unico | **SIM** |
| 7 | handoff atualizado | **SIM** |
| 8 | nenhuma recusa nova fora da secao 4 | **SIM.** A nova entrou no mesmo commit |

### 4.1 Portao de confianca

Um numero MUDOU de valor na tela do dono: a linha `efa4fa7d` voltou a contar em `saiu`,
e o `saiu` de agosto subiu R$ 4.800,00 de volta. A explicacao esta neste handoff e na
proxima tela que ele abrir, que volta a mostrar a linha como nao classificada. **Foi
correcao de dado errado, nao mudanca de calculo.**

---

## 5. Ressalvas

- **Continua sem caminho para DESMARCAR um par.** Agora incomoda mais: marcar ficou
  facil e a categoria nao pode mais ser trocada a mao... **exceto** para outra categoria
  ou para vazio, que segue permitido. Um par marcado errado se desfaz trocando a
  categoria de um dos lados, mas o `repasse_id` FICA, e nao ha tela que mostre isso.
  **E o pior buraco aberto do modulo hoje.**
- **Nada foi verificado no app rodando.**
- **Item 2 do portao (RLS como vendedor)** segue NAO desde a v4.

---

## 6. Invariantes reforcados

- **Novo, e o mais importante desta sessao:** categoria que so faz sentido dentro de um
  fluxo nao pode ser escolhivel fora dele. E a defesa mora no SERVIDOR: sumir do seletor
  e conforto para o dono, nao garantia contra o payload.
- **Repetido, porque eu repeti o erro:** corpo de funcao se COPIA do arquivo versionado.
  Transcrever de memoria custou quatro comportamentos, entre eles duas recusas nomeadas.
- **Exclusao silenciosa e sempre defeito**, mesmo quando o numero sai certo. `repasse`
  contado por categoria acertava por sorte; contado por `repasse_id`, acerta por
  construcao.

---

## 7. Primeiro movimento do proximo chat

`P-ABRE` em sessao nova. Depois, **decisao do dono** entre duas:

1. **`P-R1`** (sessao S2 da sequencia, paga D-3 e D-7), ou
2. **desmarcar par** como entrega propria, que a secao 5 aponta como o pior buraco
   aberto.

Antes disso, tarefa do dono, sem prompt: **marcar o par Ford pelo botao**, agora que a
selecao atravessa o mes e a categoria nao pode mais ser escolhida a mao.
Julho: `AGENCY FORD SUL C MODELOS`, +R$ 4.800,00, 30/07. Setinha para agosto:
`FORD MODELS SUL`, −R$ 4.800,00, 06/08.
