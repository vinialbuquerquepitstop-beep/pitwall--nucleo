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
- **Ficou de fora deste commit, de proposito:**
  `docs/superpowers/plans/2026-08-19-segundo-lojista-tenant.md`. Divida propria, tratada
  no `P-R0` da mesma sessao (secao 3.3), onde entrou.

### 3.2 Segunda entrega da sessao: o handoff (commit `147e731`)

Nasce este arquivo e a `## Linha financeiro` no indice ganha topo. E onde a secao 6
passou a existir.

### 3.3 Terceira entrega da sessao: `P-R0`, higiene (commit `2aec847`)

**Frase:** o git volta a descrever o banco.

O `P-R0` avisava para nao presumir o estado da divida, e fez bem: a migration que a
medicao de 26/08 apontava como faltando (`fin_fatia21_painel_abatimento`) **ja estava
commitada** em `0fa9ed4`. A que faltava era outra, aplicada **depois** da medicao.

- `supabase/migrations/20260826_fin_fatia21_painel_abatimento_sem_categoria.sql`, novo.
  Aplicada no banco como `20260826223626`, as 22:36 de 26/08, e nunca versionada.
  Recuperada de `supabase_migrations.schema_migrations` e **conferida por md5**, nao
  transcrita no olho: `42fea630406ca5054b9002c9cfe36efd` nos dois lados, 8579 chars.
  E o conserto de um defeito que a propria Fatia 2.1 tinha introduzido: o filtro
  `natureza_esperada = 'saida'` derrubava das secoes o movimento com dominio escolhido e
  categoria em branco, que seguia contando no `saiu`. R$ 184,80 no total e em secao
  nenhuma (secoes 1012,01 contra `saiu` 1196,81).
- `docs/superpowers/plans/2026-08-19-segundo-lojista-tenant.md`, novo. Plano real, 14
  secoes, objetivo e arquitetura definidos, sem versionar desde 19/08. Entrou.

**Prova, rodada depois do commit:** 14 migrations `fin_` aplicadas no banco, 14
versionadas no git, **diferenca zero nos dois sentidos**. `git status --porcelain` vazio.

**O que NAO ficou zero, e nao era desta entrega:** 158 migrations aplicadas contra 26
versionadas. A pasta `supabase/migrations/` so comecou a ser usada em 21/07/2026 e as
**132 anteriores** foram aplicadas por MCP sem arquivo. Divida estrutural anterior a esta
sessao, nao deriva nova. Registrada aqui em vez de escondida atras de um "diferenca zero"
que so seria verdade na familia que eu escolhi olhar.

---

## 4. Portao

Rodado ANTES de **cada um dos tres commits** (`67d0066`, `147e731`, `2aec847`), verde nas
tres vezes, com o mesmo resultado. Conferido por EXIT CODE, nunca pelo texto da saida.

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

**D-7. Achada no `P-R0`, nao pela sessao de aceite.** A migration
`fin_fatia21_painel_abatimento_sem_categoria` (aplicada `20260826223626`, as 22:36 de
26/08) alterou valores exibidos nas secoes da Visao. `grep -c "184,80\|184.80"
public/app.js` = **0**; nao ha texto na tela referente a essa mudanca. Mesmo criterio das
outras seis: registro, sem diagnostico e sem proposta.

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

## 9. O que NAO foi provado, e o que fica aberto

### 9.1 Nao provado nesta sessao

- **O `P-R0` provou paridade de NOME, nao de CONTEUDO.** Para a migration recuperada, o
  md5 bate byte a byte. Para as outras 13 `fin_`, foi conferido que existe arquivo com o
  nome de cada migration aplicada; **o corpo de cada arquivo nao foi comparado** com o que
  esta em `supabase_migrations.schema_migrations`.
- **Nada foi verificado no app rodando.** As tres entregas sao de documento e de arquivo
  `.sql` ja aplicado. Nenhuma tela foi aberta.
- **As ~12 frases de cliente da `D-4` nao foram recontadas** (por decisao do dono: recontar
  e trabalho do `P-AUDITA`).

### 9.2 Aberto

- **`git push` pendente, e e a maior.** Nada desta sessao esta no remoto, **nem o commit
  que gravou este arquivo**: `0fa9ed4` (Fatia 2.1, de ontem), mais `67d0066` (contrato),
  `147e731` (handoff), `2aec847` (`P-R0`) e o `P-FECHA`. Confira com
  `git log --oneline origin/main..HEAD` em vez de confiar num numero escrito aqui, que
  envelhece a cada commit.
  Primeira tentativa: **bloqueada pelo classificador do auto mode do Claude Code**, nao
  por erro de git. Segunda: o dono colou a mensagem inteira junto do comando e o git
  recusou com `fatal: invalid refspec '1.'`. **Nada subiu.** Neste repo push e deploy, e
  por decisao do dono nesta sessao **o push nao sai de dentro de uma sessao de construcao,
  a friccao e proposital** e nao se adiciona regra de `git push` no `settings.json`.
  Enquanto nao subir, o app publicado esta atras do banco. Comando: `! git push origin main`
- **132 migrations aplicadas sem arquivo no git** (158 aplicadas, 26 versionadas).
  Estrutural, anterior a esta sessao. Ver secao 3.3.
- **`LEDGERBAL` guardado e nunca conferido** contra a soma dos movimentos. Herdado do v68.
- **`fin_regra` continua com 0 linhas.** Herdado do v68.

---

## 10. Invariantes reforcados nesta sessao

- **Inv. 18** ganhou casa fixa: deixou de viver so no `CLAUDE.md` e no PRD e passou a ser
  a secao 2.1 do `CONTRATO.md`, que carrega sozinho.
- **F1 a F4 passam a existir com numero proprio.** A numeracao "13 a 16" que colidia com a
  global do projeto foi morta na revisao 1 e varrida do guia no ato da copia.
- **C6, entrega vertical**, foi o criterio que manteve a entrega da `D-k` fechada: a frase
  esta escrita e aprovada, e nenhuma linha foi codada porque o `P-AUDITA` ainda nao
  liberou a `D-2`.
- **Portao por EXIT CODE, nunca por texto de saida:** rodado nas tres vezes.
- **"Entrega vazia e resultado valido"** foi testado e **nao se aplicou**: o `P-R0` achou
  divergencia real. O criterio serviu para nao inventar trabalho, nao para pular a
  medicao.

---

## 11. Primeiro movimento do proximo chat

1. **O dono roda `! git push origin main`.** Nada mais comeca antes disso: sao 4 commits
   parados e o app publicado esta atras do banco.
2. **`P-AUDITA`, em sessao SEPARADA desta**, apontado para as **sete** divergencias da
   secao 6 (as seis da sessao de aceite mais a `D-7`). So o que sobreviver vira entrega.
3. Se o `P-AUDITA` confirmar a `D-2`, abrir a entrega da secao 8, ja aprovada pelo dono
   palavra por palavra. Se derrubar a `D-2`, **a frase morre junto** e nao se gasta sessao.
4. Depois, `P-W1-COBERTURA`.

Nao comecar pelo `P-W1-COBERTURA`, e nao abrir a entrega da `D-k` antes do `P-AUDITA`.
