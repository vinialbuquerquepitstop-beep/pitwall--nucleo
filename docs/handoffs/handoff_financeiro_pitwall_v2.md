# Handoff Financeiro v2 — o git passa a descrever o banco por CORPO

Data: 28/08/2026. Linha: financeiro. Substitui o `handoff_financeiro_pitwall_v1.md`
como topo da linha, sem apagar o que ele registra.

---

## 1. A frase da entrega

**O git volta a descrever o banco por CORPO, nao so por nome, e a working tree fica
limpa.**

---

## 2. O problema que ela resolve

O `P-R0` do v1 (commit `2aec847`) entregou "o git volta a descrever o banco" e provou
**14 migrations `fin_` aplicadas contra 14 versionadas, diferenca zero nos dois
sentidos**. Aquela prova era de **nome**. A propria secao 9.1 do v1 registrou, honesta,
que **o corpo de cada arquivo nao tinha sido comparado**.

Nesta sessao o corpo foi comparado. Reprovou em um dos 14.

O arquivo `supabase/migrations/20260826_fin_fatia21_painel_abatimento.sql` carregava,
sob o nome de `fin_fatia21_painel_abatimento`, o **corpo da migration seguinte**
(`sem_categoria`). Os dois arquivos do repo tinham SQL identico, diferindo so em
comentario. O corpo que o banco realmente aplicou como `fin_fatia21_painel_abatimento`
**nao existia em arquivo nenhum do repo**.

Efeito pratico: o estado final do banco estava certo (a segunda migration substituiu a
primeira), mas o historico que o git contava nao aconteceu. Quem reaplicasse o repo do
zero rodaria o mesmo corpo duas vezes.

---

## 3. O que mudou

Oito caminhos, um commit.

### 3.1 `supabase/migrations/20260826_fin_fatia21_painel_abatimento.sql`

Corpo recuperado de `supabase_migrations.schema_migrations` por base64, **copiado, nunca
transcrito no olho**. Depois da copia, o cabecalho de reconciliacao
`-- migration aplicada: 20260826201829_...` foi devolvido, para o arquivo ficar simetrico
com os outros 12 que ja o carregam, mais cinco linhas de procedencia dizendo de onde o
corpo veio e com que md5 foi conferido.

### 3.2 `supabase/migrations/20260721_calc_dados.sql`

Trabalho de 28/08 que estava na working tree e nunca tinha sido commitado. O arquivo
passa a **declarar que foi aplicado fora do ledger**, pelo SQL Editor, em 21/07/2026, e
alinha a policy `calc_dados_sel` com a que o banco aplicou em `20260817233215`
(recorte por papel `dono`, porque a tabela carrega custo de fornecedor). Sai o
`comment on table`, sai a instrucao "APLICAR NO Dashboard", e **sai um fallback
`using (true)` que vivia em comentario dentro do repo**, ou seja, uma RLS sem recorte de
tenant escrita como sugestao.

### 3.3 `CLAUDE.md`

Quatro linhas, dentro da nota sobre skills, documentando a skill `condutor-financeiro`.
**Nao toca o item 4 do bloco de arranque**, o ponteiro para `docs/financeiro/CONTRATO.md`,
que segue intacto.

### 3.4 O condutor entra versionado

Cinco arquivos, 626 linhas, que estavam como `??` no `git status`:
`.claude/agents/condutor.md` (121), `.claude/skills/condutor-financeiro/SKILL.md` (132),
`references/ciclo.md` (109), `references/prompts.md` (195), `references/decisoes.md` (69).

O `condutor` e o unico agente **somente-leitura** do repo: sem `Edit`, sem `Write`, sem
`Bash`, sem MCP. Ele le o estado e devolve o proximo prompt; quem executa e a Torre ou o
subagente de dominio. `.claude/` nao esta no `.gitignore` (so
`.claude/settings.local.json`), e ja tinha 42 arquivos versionados: os cinco entram na
mesma convencao.

---

## 4. O que foi PROVADO, com numero dos dois lados

### 4.1 O corpo recuperado, por md5 RAW

| | valor |
|---|---|
| md5 RAW do ledger | `dfd3683c7076962834f67237d20ccf75` |
| md5 RAW do arquivo gravado | `dfd3683c7076962834f67237d20ccf75` |
| chars ledger / arquivo | 9890 / 9890 |

Bateu **byte a byte**, criterio mais duro que o normalizado que o portao exigia. Depois
do cabecalho voltar, o arquivo tem 10182 chars e o md5 **normalizado** segue
`5fae5258c60ab0fab3f446267d30ceb3`, identico ao do banco: o cabecalho e comentario e nao
mexe no SQL.

### 4.2 As 14 `fin_`, corpo contra corpo

**Normalizado (comentario e espaco removidos): 14 de 14 batem.** Antes da correcao eram
13 de 14.

**RAW: 1 de 14.** Isso NAO e regressao, e um fato que ninguem tinha medido: todo arquivo
`fin_` do repo e **maior** que o corpo no ledger, de +57 a +348 chars, porque o repo
carrega cabecalho de reconciliacao que o banco nunca recebeu. Paridade RAW nos 14 so
seria possivel apagando a documentacao dos arquivos, o que e pior.

> **O criterio de record desta linha e o NORMALIZADO.** Quem remedir por RAW vai
> "reprovar" 13 arquivos que estao corretos.

### 4.3 A policy do `calc_dados`, arquivo contra banco vivo

```
banco    ((tenant_id = privado.fn_tenant_atual()) AND (privado.fn_papel_atual() = 'dono'::text))
arquivo  tenant_id = privado.fn_tenant_atual() and privado.fn_papel_atual() = 'dono'
```

`grep "using (true)"` no arquivo devolve EXIT 1: nao achou. Confirmado.

### 4.4 A suite, por EXIT CODE

Rodada duas vezes, antes e depois da correcao. Onze comandos, **todos EXIT 0**:
`validar.py`, `harness.py`, `prova_trilho.py`, `prova_grafico.py`, `prova_atmosfera.py`,
`node --check public/app.js`, e `diag_mobile.py` em 360, 390, 414, 1280 e 1440.

---

## 5. Portao de saida (`CONTRATO.md` 6.2), item a item

| # | Item | Resposta |
|---|---|---|
| 1 | SQL rodado no banco de verdade, nao revisado no olho | **NAO SE APLICA, e explico**: nenhum DDL saiu desta sessao. O banco foi so LEITURA. A entrega e de arquivo, para o git passar a descrever o que o banco ja tem. |
| 2 | RLS testada como dono E como vendedor | **NAO.** A policy foi comparada com a viva em `pg_policies`, nao exercitada com duas sessoes. Nenhuma policy mudou no banco. |
| 3 | a tela le todo campo novo, zero campo orfao | **SIM, por vacuidade**: nenhum campo novo. `public/` nao foi tocado. |
| 4 | assercao nova na suite com prefixo de fatia | **NAO.** Nenhuma linha de comportamento mudou, entao nao ha o que assertar. Escrito NAO de proposito, nao `n/a`. |
| 5 | EXIT 0 nos 7 comandos e nas 5 larguras | **SIM.** Ver 4.4. |
| 6 | commit unico, incluindo spec e plano | **SIM.** Oito caminhos, um commit. |
| 7 | handoff atualizado | **SIM.** Este arquivo, mais o topo da `## Linha financeiro` no indice. |
| 8 | nenhuma recusa nova fora da secao 4 | **SIM.** Nenhuma recusa nova foi criada. |

### 5.1 Portao de confianca (6.3)

**Nenhum numero visivel na tela mudou de valor nesta entrega.** Nenhuma RPC, nenhuma
view, nenhuma policy e nenhum arquivo de `public/` foi tocado. A unica coisa que mudou no
disco alem de documento e o TEXTO de duas migrations ja aplicadas.

---

## 6. Ressalvas, sem maquiar

- **O `P-R0` provou NOME e nao CORPO.** A secao 4.1 do v1 media menos do que a frase dela
  dizia. O "diferenca zero nos dois sentidos" era verdadeiro para nome e falso para
  corpo. Corrigido aqui, e o criterio de record passa a ser o normalizado (4.2).
- **A prova de 4.2 depende de uma normalizacao que eu escolhi** (remover `--` ate o fim
  da linha, remover todo espaco, minusculo). Ela mangla `--` dentro de literal de string,
  mas mangla dos DOIS lados, entao a comparacao continua valida. Nao e prova de que o SQL
  e semanticamente igual, e prova de que o texto util e igual.
- **Nada foi verificado no app rodando.** Nenhuma tela foi aberta nesta sessao.

---

## 7. Pendencias

### 7.1 Divida NAO paga, herdada e ainda aberta

**Migrations aplicadas no banco sem arquivo no git.** O v1 secao 9.2 registrou 132 (158
aplicadas contra 26 versionadas). A fase 1 desta sessao nomeou duas delas, que tocam
justamente a tabela `calc_dados`:

- `20260817021620 calc_dados_taxas_fonte_unica`
- `20260817233215 calc_dados_select_apenas_dono`

Nenhuma das duas foi versionada aqui, **por escopo declarado**. A divida fica declarada e
nao paga. Corolario incomodo: o `20260721_calc_dados.sql` faz o caminho inverso, existe
no repo e nao tem linha no ledger.

### 7.2 Assimetria menor, deixada de proposito

O `20260826_fin_fatia21_painel_abatimento_sem_categoria.sql` e o unico `fin_` que segue
**sem** a linha `-- migration aplicada:`. Ficaram 13 de 14 com ela. Nao entrou aqui
porque nao era o arquivo em conserto.

### 7.3 Herdadas do v1 e do v68, intocadas

- `LEDGERBAL` guardado e nunca conferido contra a soma dos movimentos.
- `fin_regra` continua com 0 linhas.
- As sete divergencias `D-1` a `D-7` da secao 6 do v1, **nao tratadas, nao diagnosticadas
  e nao propostas** nesta sessao, por escopo.

### 7.4 Push

**Nao sai desta sessao.** Decisao do dono, v1 secao 9.2: neste repo push e deploy, a
friccao e proposital, e nao se adiciona regra de `git push` no `.claude/settings.json`.
Comando para o dono: `! git push origin main`

---

## 8. Invariantes reforcados

- **Invariante 8** ganhou prova de campo: a policy do `calc_dados` no arquivo usa
  `privado.fn_tenant_atual()` e `privado.fn_papel_atual()`, e a viva no banco tambem. Os
  helpers seguem no schema `privado`.
- **Disciplina de recuperacao:** corpo de migration se recupera do ledger por copia
  verificavel (base64 mais md5 dos dois lados), nunca por transcricao. Foi o que o `P-R0`
  fez com a `sem_categoria` e o que se repetiu aqui.
- **Novo, nomeado aqui:** paridade de NOME entre git e banco nao e paridade. Enquanto o
  corpo nao for comparado, "o git descreve o banco" e uma afirmacao nao medida.

---

## 9. Primeiro movimento do proximo chat

**`P-AUDITA` das sete divergencias `D-1` a `D-7`**, secao 6 do v1, em sessao separada,
como o v1 secao 11 ja posicionava. Ele nao saiu nesta sessao porque o portao de entrada
reprovou no item 1 (working tree suja) e, pelo `CONTRATO.md` 6.1, a entrega da vez passou
a ser fechar esse item.

O portao de entrada agora abre limpo: tree limpa, 14 de 14 `fin_` batendo por corpo
normalizado, suite EXIT 0 nas cinco larguras.
