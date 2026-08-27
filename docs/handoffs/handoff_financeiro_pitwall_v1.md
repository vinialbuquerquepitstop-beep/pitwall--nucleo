# Handoff Financeiro v1 — o contrato entra no repo

**Data:** 27/08/2026
**Linha:** financeiro (primeiro handoff desta linha)
**Commit:** `67d0066`
**Natureza:** entrega de governanca. Zero linha de `public/` ou `supabase/` tocada.

---

## 1. A frase da entrega

**O contrato do Financeiro passa a carregar sozinho em toda sessao que tocar em `fin_`
ou na aba Financeiro.**

Verificavel sem abrir o codigo: abrir uma sessao nova, pedir qualquer coisa sobre `fin_`,
e a sessao anuncia que leu `docs/financeiro/CONTRATO.md` antes de responder. Secao 5.

---

## 2. O problema que ela resolve

As regras do modulo viviam em prompt colado no chat. Prompt nao tem versao, nao tem diff
e morre no fim da sessao: mudar uma regra custava corrigir doze prompts, e a sessao
seguinte comecava sem saber o que ja tinha sido decidido. O contrato agora mora no git e
o prompt fica curto e descartavel.

---

## 3. O que entrou

`docs/financeiro/`, pasta nova:

| Arquivo | Linhas | O que e |
|---|---|---|
| `CONTRATO.md` | 292 | a regra de record, revisao 1 |
| `PROMPTS.md` | 670 | os prompts de sessao, revisao 1 |
| `PLANO.md` | 345 | o plano mestre, revisao 2 |
| `guia_de_uso_dos_prompts.md` | 198 | operacao e calendario |
| `PRD-ESTADO.md` | 585 | o PRD de estado medido em 26/08 |

`CLAUDE.md`, bloco de arranque, **item 4** (o antigo item 4, "abrir a skill", virou 5):

```
4. Ao tocar em qualquer coisa com prefixo `fin_` ou na aba Financeiro:
   leia `docs/financeiro/CONTRATO.md` ANTES de escrever a primeira linha.
   Se o contrato conflitar com o pedido do prompt, o CONTRATO ganha e voce avisa.
```

`docs/handoffs/handoff_indice_pitwall.md`: nasce a `## Linha financeiro`.

### 3.1 Decisoes tomadas nesta sessao

- **O contrato entra ANTES da skill no arranque, nao depois.** Decisao do dono, com a
  razao dita por ele: *contrato que perde para a skill nao e contrato*. Custou renumerar
  um item; nenhum documento do repo citava "item 4" do arranque (conferido com `grep` em
  `CLAUDE.md`, no indice e em `.claude/`).
- **O `doc.md` solto na raiz virou `docs/financeiro/PRD-ESTADO.md`.** A instrucao antiga
  do `P-ESTRUTURA`, que mandava deixar o `doc.md` fora deste commit, fica **revogada** por
  decisao do dono nesta sessao.
- **O guia foi corrigido no ato da copia**, porque circulava contradizendo o contrato
  revisao 1. Tres trocas, todas ditadas pelo dono: "os 16 invariantes" para "os
  invariantes herdados e F1 a F4"; regra de ouro 5, "invariante 14" para `F2`; regra de
  ouro 6, "Invariante 15" para `F3`; Parte 3 item 2, "Acrescentar os invariantes 13 a 16
  ao CONTRATO.md" para "Conferir que o CONTRATO.md esta em docs/financeiro/". Varredura
  posterior: nenhuma citacao da numeracao morta sobrou no arquivo.
- **Fica de fora, de proposito:** `docs/superpowers/plans/2026-08-19-segundo-lojista-tenant.md`,
  ainda sem versionar. Divida propria, tratada no `P-R0`.

---

## 4. Portao

Rodado ANTES do commit `67d0066`.

| Comando | EXIT |
|---|---|
| `python ferramentas/validar.py` | 0 |
| `python ferramentas/harness.py` | 0 — **885 assercoes, 0 falhas** |
| `python ferramentas/prova_trilho.py` | 0 |
| `python ferramentas/prova_grafico.py` | 0 |
| `python ferramentas/prova_atmosfera.py` | 0 |
| `node --check public/app.js` | 0 |
| `python ferramentas/diag_mobile.py` em 360, 390, 414, 1280, 1440 | 0 nas cinco |

---

## 5. Teste de aceite: PASSOU

Sessao nova de verdade (`claude -p` numa CLI separada, **nao** subagent), a partir da raiz
do repo. Prompt cru, sem nenhuma mencao ao contrato:

```
Leia public/app.js na parte de fin_ e me diga o que voce encontrou.
```

Primeira frase da resposta: *"Li o bloco inteiro e cruzei com o
`docs/financeiro/CONTRATO.md`"*. Anunciou antes de responder.

Nao foi so citar o nome do arquivo: a resposta veio estruturada por `F3`, `C2`, `C3`,
`C6`, `D-a`, `D-k`, `Inv. 12`, secao 3 e secao 4, identificadores que so existem na
revisao 1 de hoje. O apontamento em `CLAUDE.md` funciona e nao precisa mudar de lugar.

---

## 6. Divergencias observadas, nao tratadas

Levantadas pela sessao de aceite, **reconferidas uma a uma nesta sessao** com `grep` no
`app.js` e nas migrations versionadas. Registro puro: nenhuma foi consertada, nenhuma foi
diagnosticada, nenhuma proposta esta escrita aqui. A ordem de listagem e a da sessao de
aceite, nao ordem de gravidade.

**D-1. `F3` nao tem implementacao em `public/app.js`.**
`grep -c "base incompleta\|julgado\|julgada" public/app.js` = **0**.
Medicao do mes corrente feita na sessao de aceite: 151 linhas, valor total
R$ 70.286,30, julgado em valor R$ 1.537,99, **2,2%**. A Visao desenha `pct` e
`delta_pct` em `public/app.js:703-704`.

**D-2. `finSobreporHTML` le chave diferente da que o servidor usa para sobrescrever.**
`public/app.js:1255` (`finSobreporHTML`), campo lido em `public/app.js:1257` e tambem em
`public/app.js:1162`: `casaria_ja_classificados_diferentes`.
`supabase/migrations/20260826_fin_fatia2_rpcs_regra.sql:157` devolve tambem
`sobrescreveria_diferente`.
`grep -c sobrescreveria_diferente public/app.js` = **0**.

**D-3. `bruto` e `abatido` sao devolvidos pelo servidor e nao tem leitor na tela.**
`supabase/migrations/20260826_fin_fatia21_painel_abatimento.sql:129` e `:177` devolvem
`'bruto', cat.bruto, 'abatido', cat.abatido`.
`finCatLin` (`public/app.js:700-704`) le `rotulo`, `codigo`, `n`, `total`, `pct` e
`delta_pct`. `grep -c abatido public/app.js` = **0**. As 20 ocorrencias de `bruto` no
`app.js` sao de outro contexto (parser OFX em `:898-905`, `localStorage` em `:2559`).

**D-4. Duas frases para a mesma recusa.**
`public/app.js:1339`: `Escreva o padrão a casar.`
`supabase/migrations/20260826_fin_fatia2_rpcs_regra.sql:67` e `:251`:
`Informe o padrao a casar.` A segunda e a que consta na secao 4 do `CONTRATO.md`.
A sessao de aceite reporta ainda cerca de 12 frases geradas no cliente fora da secao 4
(exemplos citados por ela: `Escolha a conta.`, `Selecione ao menos um lançamento`,
`Veja o efeito antes de gravar: a prévia é obrigatória.`, `Regra não encontrada na lista
carregada`). Esse conjunto **nao foi recontado** nesta sessao.

**D-5. `FIN_GRUPO` e chaveado pelo rotulo.**
`public/app.js:658`, lido em `public/app.js:670` e `:673` por
`FIN_GRUPO[String(gr||"")]`. Os 9 grupos estao escritos no JS pelo texto de exibicao
(`"Operação"`, `"Mercadoria"`, e assim por diante).

**D-6. Ternario com os dois bracos identicos.**
`public/app.js:1288`: `(1===hoje?" esperando por ela":" esperando por ela")`.

---

## 7. Ordem decidida para a sequencia

Definida pelo dono nesta sessao.

| # | Bloco | Criterio |
|---|---|---|
| 1 | `P-ABRE` · `P-R0` · `P-FECHA` | diferenca esperada **zero**. Se der zero, a entrega e vazia: encerrar a sessao, nao inventar trabalho |
| 2 | `P-AUDITA`, em **sessao separada** | apontado para as 6 divergencias da secao 6. **So o que sobreviver a auditoria vira entrega** |
| 3 | entrega da `D-k` (secao 8) | so **depois** de o `P-AUDITA` confirmar |
| 4 | `P-W1-COBERTURA` | a tela para de desenhar `pct` e `delta` sobre 2,2% de R$ 70.286,30 |

---

## 8. A entrega da `D-k`, posicionada e ainda nao escrita

Entrega propria, curta, **so tela**. Posicao: depois do `P-AUDITA` confirmar, antes do
`P-W1-COBERTURA`. A frase da entrega foi escrita e submetida ao dono nesta sessao;
nenhuma linha foi codada. Nao comecar sem o `P-AUDITA` ter confirmado a `D-2`.

---

## 9. O que fica aberto

- **`git push` pendente.** `main` esta **ahead 2** de `origin/main`: `0fa9ed4` (Fatia 2.1,
  o abatimento) e `67d0066` (este). O dono ordenou o push nesta sessao e o comando foi
  **bloqueado pelo classificador do auto mode do Claude Code**, nao por erro de git.
  Enquanto nao subir, a migration do abatimento esta aplicada no banco e o codigo nao
  esta publicado: **o app publicado esta atras do banco.** E a divida que o `P-R0` mede.
- **`LEDGERBAL` guardado e nunca conferido** contra a soma dos movimentos. Herdado do v68.
- **`fin_regra` continua com 0 linhas.** Herdado do v68.
- O plano do segundo lojista segue sem versionar.
