# Handoff Financeiro v3 — a tela para de desenhar numero sobre base incompleta

Data: 31/08/2026. Linha: financeiro. Substitui o `handoff_financeiro_pitwall_v2.md`
como topo da linha, sem apagar o que ele registra.

---

## 1. A frase da entrega

**A tela nunca mais mostra um numero economico sobre base incompleta.**

Sujeito visivel: abrir Financeiro hoje e, no lugar do placar, ler
`base incompleta: 2,1% julgado · faltam R$ 77.942,01 em 131 lançamentos`.

---

## 2. O problema que ela resolve, medido

A `P-AUDITA` desta mesma sessao mediu a base e reprovou o item 11 da secao 7 do
`CONTRATO.md`:

| medida, 31/08/2026 | valor |
|---|---|
| valor bruto da base | R$ 79.619,86 |
| valor julgado | R$ 1.677,85 |
| **% julgado, em VALOR** | **2,11%** |
| falta julgar | R$ 77.942,01 em 131 linhas |
| % por linha (nao e o criterio do F3) | 27,62% |
| `grep "base incompleta\|julgad" public/app.js` antes | **0** |

Ou seja: o placar desenhava `entrou`, `saiu` e `resultado` sobre 2% da base, e a
tela nao dizia isso em lugar nenhum. O F3 existe porque esse erro ja foi
publicado tres vezes neste projeto, sobre a contraparte BR IPHONES.

---

## 3. O que mudou

Uma migration, tres arquivos de tela e prova, uma linha de contrato.

### 3.1 `supabase/migrations/20260831_fin_fatia3_cobertura.sql`

Aplicada como `20260831180334_fin_fatia3_cobertura`. Quatro objetos:

- **`privado.fn_fin_cobertura(p_tenant, p_ini, p_fim)`**, `language sql`, `stable`,
  `search_path` vazio, tudo schema-qualificado. **Nao e `security definer`**: roda como
  o chamador, entao a RLS de `fin_movimento` continua sendo quem recorta o tenant. A
  unica `security definer` do modulo segue sendo `privado.fn_fin_importacao_fechar`.
  `JULGADO` = tem `dominio` **ou** tem categoria de natureza `neutro`, literal do F3.
- **`public.fin_cobertura(p_ini, p_fim)`**, dono-only, mesmas regras de janela do
  `fin_painel` (Inv. 10 e D-m). Devolve `teto` junto: **95 e regra de negocio e mora no
  servidor**, nao chumbado no JS (C2).
- **`public.fin_painel`** ganha `pct_julgado`, calculado pela MESMA helper (C1). Corpo
  identico ao de `20260826223626` fora isso: **3 linhas adicionadas, zero linha de
  calculo alterada** (diff em 4.2).
- **`public.fin_movimentos`** ganha `p_ordem` (`data` | `valor`). Assinatura foi de 4
  para 5 argumentos, entao `drop` + `create` e grants refeitos explicitamente.

### 3.2 `public/app.js`

- `finBaseIncompleta(cob)` e `finIncCorte(rot,x,pend)`: o bloco que entra **no lugar**
  do placar e dos dois blocos de proposito. Le TODOS os campos que a `fin_cobertura`
  devolve, zero campo orfao.
- `finVisao(pnl,jn,cob)`: quando `cob` chega, a Visao nao desenha placar nem secoes.
- `finTopo(jn,pnl,semFaixa)`: a faixa do Inv. 18 **some** enquanto o bloco esta na
  tela. Ela termina em "os números abaixo ignoram esse valor" e nao ha numero abaixo:
  manter as duas seria publicar uma frase falsa ao lado de uma verdadeira.
- `renderFinanceiro`: `fin_painel` e `fin_cobertura` saem em `Promise.all`, nao em
  fila. Custo de latencia zero, e a decisao continua sendo do servidor (`pct_julgado`
  do painel contra `teto` da cobertura). So na Visao.
- `finMovimentos` passa a **declarar a ordem** no recorte (`maior valor primeiro` /
  `mais recente primeiro`), e a chamada manda `p_ordem: valor` quando o filtro e
  `nao_classificados`.

### 3.3 `public/app.css`

`.fin-inc` e filhos. **Zero token de cor novo** (C5): `--morno` inteiro, o mesmo par
que `Sem categoria` e o conflito de regra ja usam. Nao e `--erro` de proposito: base
incompleta e trabalho que falta, nao falha de sistema.

### 3.4 `ferramentas/harness.py` e `ferramentas/diag_mobile.py`

20 assercoes `fin3:` novas, e o `diag_mobile` passa a LIGAR o estado degradado para
medir o bloco nas cinco larguras. Detalhe que custou tempo e fica registrado: **o
`diag_mobile` roda o app dentro de um iframe**, entao interruptor de fixture se liga em
`D.defaultView`, nunca na `window` do pai. Ligado no pai, o stub le `undefined`, a base
parece completa e a medicao passa sem ter medido nada.

### 3.5 `docs/financeiro/CONTRATO.md`

Uma linha na secao 4: `Ordem invalida: use data ou valor.` Recusa nova entra no mesmo
commit que a cria, como a propria secao manda.

---

## 4. O que foi PROVADO, com numero dos dois lados

### 4.1 RLS, exercitada com tres sessoes (o item que o v2 respondeu NAO)

Com `set local role authenticated` e `request.jwt.claims` trocado:

| sessao | `fin_cobertura` | `fin_painel` | `fin_movimentos` |
|---|---|---|---|
| dono `fb2aad8e...` | `ok:true`, 2,11% | `ok:true` | `ok:true` |
| vendedor `130353b1...` | `Financeiro e restrito ao dono.` | idem | idem |
| uid inexistente | `Sessao invalida.` | `Sessao invalida.` | — |

### 4.2 Nenhum numero mudou de valor (portao 6.3)

`fin_painel` antes x depois, diff do corpo: **171 linhas -> 178**, e as 7 sao
declaracao de `v_pct`, 4 de comentario, o calculo pela helper e a chave no retorno.
**Zero linha de agregacao tocada.** O placar de agosto continua
`entrou 0 · saiu 1.275,95 · resultado −1.275,95`.

### 4.3 A conta fecha nos dois sentidos

`fin_cobertura('2026-07-01','2026-08-31')` como dono:
`1.677,85 + 77.942,01 = 79.619,86` e `1 + 49 + 0 + 131 = 181`. Os quatro baldes de
`por_dominio` sao disjuntos e exaustivos.

Achado que vale ler: dos R$ 1.677,85 ja julgados, **R$ 1.657,85 sao PESSOAIS e R$ 20,00
sao da empresa**.

### 4.4 `p_ordem` faz o que diz

`ordem=valor` devolve `4800.00` na primeira linha; `ordem=data` devolve `2026-08-25`.
`ordem=bagunca` devolve `Ordem invalida: use data ou valor.`

### 4.5 Git contra banco, por CORPO

**15 de 15 `fin_` batem por corpo normalizado**, nos dois sentidos (nenhuma so no git,
nenhuma so no banco). A nova bate com `3c6dbc0359fb31d154d867aa7a6bd456`.

### 4.6 A suite, por EXIT CODE

`validar.py` 0 · `harness.py` 0 · `prova_trilho.py` 0 · `prova_grafico.py` 0 ·
`prova_atmosfera.py` 0 · `node --check` 0 · `diag_mobile.py` 0 em 360, 390, 414, 1280
e 1440.

**Contagem de assercoes: 882 -> 902, 0 falhas.** O numero **885** que o `CLAUDE.md`
declara esta errado: medido nesta sessao com `git stash`, a baseline de `83124e5` e
**882**.

---

## 5. Portao de saida (`CONTRATO.md` 6.2), item a item

| # | Item | Resposta |
|---|---|---|
| 1 | SQL rodado no banco de verdade | **SIM.** `apply_migration`, e cada objeto exercitado depois |
| 2 | RLS testada como dono E como vendedor | **SIM.** Mais tenant errado. Ver 4.1 |
| 3 | a tela le todo campo novo, zero campo orfao | **SIM.** `pct_julgado` decide o bloqueio; `teto`, `valor_bruto_total`, `valor_bruto_julgado`, `valor_pendente`, `linhas_total`, `linhas_pendentes`, `ini`, `fim` e os quatro baldes de `por_dominio` sao todos desenhados; `ordem` vira texto no recorte de Movimentos |
| 4 | assercao nova com prefixo de fatia | **SIM.** 20 `fin3:` |
| 5 | EXIT 0 nos comandos e nas 5 larguras | **SIM.** Ver 4.6 |
| 6 | commit unico, incluindo spec e plano | **SIM**, um commit. **Sem spec e sem plano em arquivo**: a spec desta entrega e o texto do `P-W1-COBERTURA` no `PROMPTS.md`, que ja esta versionado |
| 7 | handoff atualizado | **SIM.** Este arquivo, mais o topo da `## Linha financeiro` no indice |
| 8 | nenhuma recusa nova fora da secao 4 | **SIM.** `Ordem invalida: use data ou valor.` entrou na secao 4 no mesmo commit |

### 5.1 Portao de confianca (6.3)

**Nenhum numero mudou de valor. Numeros SUMIRAM, e a explicacao subiu junto**, na mesma
tela e no lugar exato onde eles estavam. Era o unico jeito de cumprir o F3, que e
explicito: no lugar do numero, nunca ao lado dele.

---

## 6. Ressalvas, sem maquiar

- **Nada foi verificado no app rodando.** Nenhuma tela foi aberta nesta sessao. O que
  existe e Chrome headless com stub, nas 5 larguras.
- **O bloco nunca foi visto com dado de verdade.** O fixture do harness usa os numeros
  REAIS medidos no banco, mas quem desenhou foi o stub.
- **A decisao do dono, registrada:** ele escolheu construir ANTES de importar os 6 meses
  de OFX, contra a recomendacao. Consequencias aceitas: (a) o julgamento das 131 linhas
  de hoje sera parcial e havera trabalho repetido quando os outros meses entrarem;
  (b) o portao duro entre bloco 2 e 3 (95% em VALOR) vai ser medido sobre 2 meses e
  tera que ser REMEDIDO depois do import; (c) o F4 (saldo por contraparte) exige 3 meses
  e com 2 nao pode nem aparecer.
- **`apply_migration` foi rodado pela Torre, nao pelo subagente `base`.** O `CLAUDE.md`
  reserva essa ferramenta ao `base`; a instrucao desta sessao proibia acionar subagente
  sem pedido do dono. Conflito real, resolvido pela instrucao da sessao e registrado
  aqui para nao virar precedente silencioso.

---

## 7. Pendencias

### 7.1 Divergencias `D-1` a `D-7`, atualizadas

| # | O que e | Estado depois desta entrega |
|---|---|---|
| D-1 | F3 sem implementacao na tela | **PAGA** |
| D-2 | `sobrescreveria_diferente` sem leitor | aberta. Cabe no `P-R2` |
| D-3 | `bruto` e `abatido` sem leitor | aberta. E o `P-R1` |
| D-4 | `Escreva o padrão a casar.` contra `Informe o padrao a casar.`, mais ~12 frases geradas no cliente | aberta, e **cresceu**: o servidor tem `Dominio invalido: use empresa, pessoal ou tudo.` e a secao 4 registra `Dominio invalido: use empresa ou pessoal.`; e `Status invalido: use todos ou nao_classificados.` nao esta na secao 4 |
| D-5 | `FIN_GRUPO` chaveado pelo rotulo (fere o Inv. 12) | aberta. Sem dono na fila |
| D-6 | ternario com os dois bracos identicos | aberta. Sem dono na fila |
| D-7 | valores mudaram sem explicacao na tela | vira o `P-R1` |

### 7.2 Herdadas, intocadas

- **132 migrations aplicadas no banco sem arquivo no git** (158 contra 26). Divida
  declarada desde o v1, nao paga. Fora do escopo desta entrega.
- `LEDGERBAL` guardado e nunca conferido contra a soma dos movimentos.
- `fin_regra` continua com 0 linhas.
- `20260826_fin_fatia21_painel_abatimento_sem_categoria.sql` segue sendo o unico `fin_`
  sem a linha `-- migration aplicada:`. Agora sao 14 de 15 com ela.
- A faixa do Inv. 18 usa `--erro`, enquanto o D-o e o C5 mandam `--morno` para
  cobranca de trabalho. Observado, nao mexido: mexer nela sem entrega propria seria
  mudar cor de tela por conta propria.
- A contagem da suite diverge entre documentos: `CLAUDE.md` diz "SEIS comandos" e lista
  sete linhas, o `CONTRATO.md` 6.2 diz "7 comandos". Nenhum dos dois foi corrigido aqui.

### 7.3 Push

Neste repo push e deploy, e a friccao e proposital. O `origin` aponta para o proxy
morto do sandbox; o remote que funciona e `github`:

```
git push github HEAD:main
```

---

## 8. Invariantes reforcados

- **F3 deixou de ser texto e virou guard-rail com prova.** A assercao que importa nao e
  "o bloco aparece", e `placar=0 e secoes=0`: aviso ao lado passaria em qualquer teste
  de presenca e falharia no unico teste que interessa, que e o dono nao conseguir ler o
  numero errado.
- **C1 na pratica:** `fin_painel` e `fin_cobertura` respondem pela mesma helper. Duas
  implementacoes do "julgado" divergiriam, e no dia em que divergissem a tela
  bloquearia com um numero e explicaria com outro.
- **C2 na pratica:** o teto de 95 nunca entra no JS. A tela escreve o numero que o
  servidor mandou.
- **Novo, nomeado aqui:** ordenacao que decide trabalho humano e do SERVIDOR. Ordenar no
  cliente e mentira assim que a lista passa do `limit 500`: a tela ordenaria as 500 que
  recebeu, nao as maiores da janela.

---

## 9. Primeiro movimento do proximo chat

`P-ABRE`, e depois **`P-W1-REPASSE`**, o proximo da sequencia do bloco 1 no
`ciclo.md` (`P-R0` -> `P-W1-COBERTURA` -> `P-W1-REPASSE` -> `P-R1` -> `P-R2` ->
`P-AUDITA`).

Antes disso, tarefa do dono sem prompt e sem sessao: **abrir o Financeiro e olhar o
bloco com dado de verdade.** E a primeira vez que ele existe fora do headless.
