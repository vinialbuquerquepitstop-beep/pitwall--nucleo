# Handoff Migracao Pit Wall (Nucleo) v34

Substitui a v33. Data: 22/07/2026.

---

## 1. Headline: duas entregas chegaram por OUTRA MAQUINA, sem handoff. Este documento tapa o buraco

O dono trabalhou o Claude em outra maquina, commitou e puxou aqui. Entre a v33 e
hoje, a `main` do GitHub ganhou 6 commits que **nenhum handoff registrava**:

| Commit | O que e |
|---|---|
| `3b363ba` | **aba Clientes** (leads com `perfil = comprou`) |
| `21adb68` | **Calculadora** em `/calc/`, precos atras do login |
| `08dfcb9` | botao **Calculadora** na navegacao |
| `83fb051` | CLAUDE.md atualizado pos-v33 |
| `89fea19` / `7dff10f` | dois backups criptografados (`backups/*.gpg`) |

Duas branches novas tambem apareceram no remoto e seguem abertas:
`claude/claude-md-docs-s14wkz` e `claude/pitscare-estruturacao-o04knt`.

**Licao de processo, nao elogio:** entrega que entra so por mensagem de commit
some do radar. Nesta sessao isso fez a leitura inicial afirmar que a aba Clientes
"nao existia", porque o checkout local estava 6 commits atras. Git e a fonte da
verdade; conferir `origin/main` (`git fetch` + `git log HEAD..origin/main`) ANTES
de afirmar o que o app tem. Toda fatia fecha com handoff, mesmo vinda de outra
maquina.

Estado do repo agora: `main` local == `origin/main` em `7dff10f`, working tree
limpo.

---

## 2. A aba Clientes, entendida linha a linha (para trabalhar HOJE)

Frontend puro, **zero mudanca de banco**. E a "Fatia 1 da frente
cliente / saida-de-aparelho" (texto do commit `3b363ba`).

### 2.1 De onde vem o dado
Reusa o UNICO carregamento de leads que ja existia. Nao ha query nova:

```
t.from("v_lead").select("*").order("proximo_contato",{ascending:true,nullsFirst:false})
```
(`public/app.js`, ~offset 50981). Isso popula a lista global `i`. A aba filtra
em cliente:

- `filtClientes(o)` = `o.filter(le => le.perfil === "comprou")`
- onde `o = i.filter(a => !a.arquivado_em)`

Ou seja: **Clientes = subconjunto client-side dos leads que compraram.** Mesmo
pipeline de Fila / Todos / Indicacoes. Consistente com Indicacoes, que tambem e
uma view de subconjunto de lead (`origem === "indicacao"`).

### 2.2 Como renderiza
No roteador de aba (funcao `k()`), quando a view e `clientes`:
```
N(lista, g(filtClientes(o), inputBusca.value), "clientes", ancora, estadoVazio)
```
- `g` = filtro de busca (o MESMO da aba Todos).
- `N` = render de lista -> chama `x(card, "clientes")` por item.
- No `x()`, a faixa entra so nesta aba: `"clientes"===e ? fxCli(a) : ""`,
  posicionada entre a linha do produto e os chips.

### 2.3 A faixa do card (`fxCli`)
Monta um `<div class="card-cliente">` com ate 3 `<span class="cli-seg">`, **cada
um condicional a ter dado**:

| Campo do lead | Vira | Condicao |
|---|---|---|
| `qtd_compras` | `N compra` / `N compras` | `> 0` |
| `valor_total` | `R$ X.XXX,XX` (pt-BR, 2 casas) | `> 0` |
| `data_nascimento` (`YYYY-MM-DD`) | `aniv. DD/MM` | existe e tem 3 partes |

Se nenhum campo tem dado, `fxCli` retorna `""` e **nao ha faixa**. O card fica
visualmente igual a um lead comum.

CSS (`public/app.css`): `.card-cliente` e flex, `var(--mono)`, 11px,
`color:var(--dim)`, `tabular-nums`; separador entre segs e `·` (U+00B7).

### 2.4 Restante do comportamento
- **Titulo** (`topoTit`): `Clientes`.
- **Busca**: `blocoBusca` fica `visivel` nas views `todos` e `clientes`.
- **Estado vazio**: "Nenhum cliente ainda. Leads que compraram aparecem aqui."
- **Navegacao**: `.aba-rara` (como Indicacoes). Desktop: inteira na lateral.
  Celular: pelo botao "Mais". A grade mobile foi reorganizada para caber a 6a
  rara (barra fixa foi para a linha 3, drawer nas linhas 1-2).
- **Acoes do card**: as padrao + Historico (se `a.id`). Sem scripts (isso e so
  da Fila). O painel de edicao de lead (Fase 2, "escrita ativa") ja cobre estes
  campos e serve para o Cliente tambem: `edNasc` (data_nascimento), `edProx`,
  `edValor` (valor_oferta), `edObs`, `edUpgrade` (`upgrade_entrada`), `edAparelho`
  (`aparelho_entrada`).

### 2.5 Provas que vieram no commit
Rodadas na outra maquina (sem python: node + Chrome headless): `node --check` ok,
teste unitario `filtClientes`/`fxCli` 9/9, harness de comportamento 15/15. A
`ferramentas/harness.py` teve a contagem de `.aba-rara` corrigida (estava vermelha
na main desde a Calculadora: subiu de 4 para 5 e nao foi atualizada; agora 6) e
ganhou cobertura do estado vazio de Clientes.

---

## 3. BLOQUEADOR para trabalhar a aba hoje: os 3 campos da faixa nao estao provados no banco

`qtd_compras`, `valor_total` e `data_nascimento` **nao aparecem em nenhuma
migration versionada** (`supabase/migrations/` so tem `20260721_calc_dados.sql`).
O schema do `v_lead` vive no Supabase, aplicado por MCP, e nem sempre commitado.

Consequencia: **nao da para afirmar, a partir do repo, que `v_lead` expoe esses 3
campos nem que ha dado real neles.** Como cada `cli-seg` e condicional a `> 0` /
existir, se a view nao tiver as colunas (ou vierem nulas), a aba Clientes mostra
quem comprou mas **sem faixa** — indistinguivel de um lead comum. O harness provou
o RENDER com fixture, nao que o banco entrega o dado.

**Primeiro passo de hoje, e depende do dono:** autorizar o conector Supabase
(sessao interativa, `/mcp`) para eu rodar, cada um em chamada separada:
```
select column_name from information_schema.columns
  where table_name = 'v_lead'
    and column_name in ('qtd_compras','valor_total','data_nascimento','perfil',
                        'upgrade_entrada','aparelho_entrada');

select id, nome, qtd_compras, valor_total, data_nascimento
  from v_lead where perfil = 'comprou' order by valor_total desc nulls last;
```
Sabemos da v16/v19 que ao menos 3 leads tem `perfil = comprou` (Diego 0001,
Isac 0006, Artu 0014), entao a aba nao esta vazia. O que falta confirmar e se a
faixa tem do que viver.

---

## 4. A Calculadora (contexto, nao e o foco de hoje)

- Vive em `public/calc/index.html`, servida em `/calc/`. Aberta em nova aba pelo
  link `abaCalc` (`<a href="/calc/" target="_blank">`), sob o rotulo de grupo
  `Ferramentas` na lateral.
- Precos "atras do login": a migration `supabase/migrations/20260721_calc_dados.sql`
  carrega os dados. Confirmar via banco se os precos leem por RLS/`tenant_id` como
  o resto (nao auditado nesta sessao).
- E a primeira coisa que mora fora do trio `index/app.css/app.js`: pagina propria
  em subpasta. Nao passa pelo roteador de abas do app principal.

---

## 5. Direcao provavel da aba Clientes (a confirmar com o dono)

O nome do commit crava o rumo: **"cliente / saida-de-aparelho"**. Os campos
`upgrade_entrada` e `aparelho_entrada` ja existem no editor. Leitura: o cliente
que comprou e candidato a TROCAR de aparelho, e o aparelho de entrada (usado) e
tanto oportunidade de giro quanto gancho de upgrade. Fatia 1 entregou a LISTA e a
faixa de contexto (compras, valor, aniversario). Fatias plausiveis a seguir, em
ordem de "palpavel primeiro":

1. **Provar a faixa com dado real** (secao 3). Sem isso o resto e no escuro.
2. Ordenacao/filtro proprio de Clientes (por valor_total, por aniversario do mes,
   por ciclo de upgrade) em vez de herdar a ordem de `proximo_contato`.
3. Ligar `aparelho_entrada` a um registro de saida de aparelho (o "saida-de-aparelho"
   do nome). Isso provavelmente TOCA o banco, entao sai da regra de "frontend puro".

**Nao decidido. Trazer ao dono antes de construir a fatia 2.**

---

## 6. Pendencias herdadas ainda abertas (da v33)

| # | Item | Nota |
|---|---|---|
| 1 | 401 da Edge Function nao gera log | Ponto cego |
| 1b | Fidelidade `index.ts`: repo vs deployed | Medir MD5 no proximo deploy |
| 3 | Calibrar meta de captacao | 10/dia segue chute |
| 4 | Ligar captacao -> lead | `captacao.virou_lead_id` sem preenchimento |
| 5 | Dashboard: metrica antes da view | Segurado |
| 6 | `registrar_nota` sem uso real | Continua |
| 7 | Aba padrao: Fila ou Hoje? | Decisao do dono, custo 1 linha |
| 8 | Leaked Password Protection | Bloqueada, plano Pro |
| 9 | `Desktop/pitwall deploy/` | Monolito morto |
| 10 | Token do GitHub em texto puro | Revogar se ainda valer |
| 11 | Legado: Estrategia, Metricas, Evolucao | Fase 7+ |
| 14 | `contItem` codigo morto (422 bytes) | Remover num patch futuro |
| 16 | Calibrar molde da rotina com uso real | Grade ja mostra qual dia cortar |

Herdada e AINDA VALENDO da v33 secao 12: a fase de **mover card no kanban de
Conteudo com escrita de volta no Notion** continua nao comecada, e o bloqueador
e do dono (marcar "Update content" na integracao do Notion). Nao foi mexido.

Novas nesta sessao:

| # | Item | Nota |
|---|---|---|
| 17 | **Confirmar `v_lead` expoe qtd_compras/valor_total/data_nascimento** | Secao 3. Bloqueia a fatia 2 de Clientes. |
| 18 | **Duas branches remotas abertas** | `claude/claude-md-docs-s14wkz`, `claude/pitscare-estruturacao-o04knt`. Fundir ou apagar. |
| 19 | Auditar RLS/tenant dos precos da Calculadora | `20260721_calc_dados.sql` nao foi lido nesta sessao. |
| 20 | Precos da calc "atras do login": provar o gate | Nao verificado que `/calc/` exige sessao. |

---

## 7. Armadilhas novas

- **Checkout local pode estar atras do remoto.** Antes de afirmar o que o app tem,
  `git fetch` e comparar com `origin/main`. Custou uma resposta errada nesta sessao.
- **Migration nao versionada = schema invisivel ao repo.** O que o `v_lead` expoe
  so se sabe pelo banco. Campo consumido pelo front (`qtd_compras` etc.) pode nao
  existir na view e o front nao quebra: a faixa so some.
- **Faixa condicional esconde ausencia de dado.** `fxCli` retornar `""` parece
  "cliente sem extras", mas pode ser "view sem coluna". Sao coisas diferentes.

---

## 8. Invariantes reforcados

- **Clientes deriva na leitura, nao no banco.** `perfil = comprou` filtrado em
  cliente sobre `v_lead`. Nenhuma coluna nova, nenhuma tabela nova. Igual ao nivel
  derivado e a Indicacoes.
- **A chave e o `codigo`/`perfil`, nunca o rotulo.** O filtro casa `"comprou"`
  (codigo do perfil), nao um rotulo de tela.
- **Tela que esconde recorte mente.** Vale para a faixa: faixa vazia por falta de
  coluna nao pode passar por "cliente sem historico de compra". Provar a origem.
