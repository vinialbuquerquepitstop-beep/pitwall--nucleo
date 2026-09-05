# Handoff financeiro v20 — auditoria da E1, em sessao separada

**Data:** 05/09/2026
**Tipo:** AUDITORIA (`P-AUDITA`), nao entrega. Nenhum arquivo de produto foi tocado.
**Alvo:** commit `3613cef`, a E1 do `docs/financeiro/plano_solucao_integral_20260904.md`.
**Substitui:** `handoff_financeiro_pitwall_v19.md`.

---

## 0. Veredito em uma linha

**A E1 passa nos 13 itens da secao 7 do CONTRATO, com UMA reprova pontual no mecanismo
generico: a nota de escopo `pct_julgado` desenha porcentagem com cifrao.** Nenhum numero
da tela esta errado hoje. O defeito e latente e mora exatamente no caminho da E2.

Auditoria rodada em sessao separada da que construiu, com SQL executado no banco de
producao e a suite rodada da raiz do repo. Nenhuma afirmacao abaixo veio de leitura no
olho: cada linha tem consulta, EXIT code ou caminho de arquivo.

---

## 1. A secao 7, item a item

| # | Pergunta | Veredito | Evidencia medida |
|---|---|---|---|
| 1 | Tabela nova tem `tenant_id` e policy que o usa? | passa | `pg_policies`: `fin_nota_numero_sel [SELECT] using=((tenant_id = privado.fn_tenant_atual()) AND (privado.fn_papel_atual() = 'dono'))`; `pg_class.relrowsecurity = true` |
| 2 | Policy testada como dono, vendedor e tenant errado? | passa | dono `fb2aad8e...`: 3 linhas. Vendedor `130353b1...`: **0 linhas** e `Financeiro e restrito ao dono.`. UID fora da `app_usuario`: **0 linhas** e `Sessao invalida.`. `anon`: nem chega na RLS, morre no grant (`permission denied for table fin_nota_numero`) |
| 3 | Inferencia de `dominio` em codigo, regra ou agente? | passa | o seed nao toca `fin_movimento` nem `dominio` de contraparte nenhuma; o mapa `escopo -> celula` do `app.js` e layout, nao julgamento de lancamento |
| 4 | `current_date` / `CURRENT_DATE` novo? | passa | `position('current_date' in lower(prosrc))` = **false** na `fin_painel` viva; `mudou_em` nasce sem default, de proposito |
| 5 | Grant de DELETE / TRUNCATE / REFERENCES / TRIGGER para `authenticated`? | passa | `role_table_grants`: `authenticated` so `SELECT`. `has_table_privilege` nos seis privilegios: **todos negados** |
| 6 | `security definer` nova? | passa | `fin_painel.prosecdef = false`, `STABLE`, `search_path` fixo. Zero funcao nova no commit |
| 7 | Campo devolvido pela RPC sem leitor no `app.js`? | passa | os 8 campos tem leitor: `codigo` e `escopo` no casamento e nos `data-*`, `competencia` em `finNotaMes`, `valor_antes` e `valor_depois` em `brlV`, `diferenca` em `finNotaDif`, `causa` em `c()`, `mudou_em` em `finData` |
| 8 | Token de cor novo? | passa | a CSS nova usa `--dim`, `--line`, `--text`, `--mono`, os quatro pre-existentes. Zero hex novo |
| 9 | Frase de erro inventada na tela? | passa **no commit** | `por que mudou` e rotulo de UI; `causa` sai do servidor byte a byte. Ver achado 4.1, que e anterior a este commit |
| 10 | Migration aplicada no banco e ausente do git? | passa | as 3 versions do ledger (`20260905022511`, `20260905022554`, `20260905022704`) tem arquivo. Toda a linha do Financeiro desde `20260826` esta versionada, sem buraco |
| 11 | Numero economico com base abaixo de 95% julgada (F3)? | passa | sob o F3 a `finVisao` retorna so `finBaseIncompleta`, e nota de caixa nao casa base nenhuma la. E o ponto e teorico nestes meses: fev, mar e mai estao a **100,00% julgado**, entao o F3 nem dispara |
| 12 | O SQL foi de fato executado? | passa | `pg_get_functiondef` da `fin_painel` viva bate com o arquivo da migration; as 3 notas estao na tabela; trigger `trg_auditar_fin_nota_numero` ligado sobre `fn_auditar` (Inv. 6) |
| 13 | A entrega resolve o pedido real? | passa | secao 2 |

---

## 2. A entrega resolve o pedido real, medido nos dois lados

A nota nao so aparece: **ela nao mente**, nem sobre o depois nem sobre o antes.

| Mes | `valor_depois` da nota | `saldo` de empresa que a `fin_painel` devolve hoje | Linhas na `auditoria` | Liquido na `auditoria` | `valor_antes` menos `valor_depois` |
|---|---|---|---|---|---|
| fev/2026 | 1.999,09 | **1999.09** | 2 | **1.873,00** | 1.873,00 |
| mar/2026 | 1.864,20 | **1864.20** | 3 | **2.000,00** | 2.000,00 |
| mai/2026 | 1.235,02 | **1235.02** | 3 | **4.400,00** | 4.400,00 |

Os seis valores batem com a RPC de producao. As contagens e os liquidos batem com a
tabela `auditoria` append-only, na janela `2026-09-04 01:56 UTC`, filtrando
`antes->>'dominio' = 'empresa'` e `depois->>'dominio' = 'pessoal'`. Soma dos tres
deltas: **-8.273,00**, exatamente o que a `fin_nota_numero.diferenca` acumula.

**A nota chega na tela nos dois filtros que importam.** Com `dominio = 'empresa'` e com
`dominio = 'tudo'` (o padrao), a `fin_painel` devolve 1 nota em cada um dos tres meses,
e o `placar_empresa.saldo` sob `tudo` e o mesmo `1999.09 / 1864.20 / 1235.02`. Sob
`pessoal` a nota nao aparece, que e o desenho.

### O portao proprio da E1 confere

`diff` entre a `fin_painel` de `20260903_fin_painel_caixa_x_resultado.sql` e a de
`20260904_fin_painel_notas.sql`, so o corpo: **tres mudancas e nada mais**, a declaracao
de `v_notas`, o SELECT de leitura sobre `fin_nota_numero`, e a chave `notas` no retorno.
Zero linha de calculo tocada. Isso sustenta estruturalmente o "42 celulas identicas" que
o v19 mediu, inclusive a ressalva honesta do v19 de que nao houve remedicao depois do
frontend.

### A suite, rodada agora nesta maquina, por EXIT CODE

```
validar.py                              0
harness.py                              0    1109 passou, 0 falhou, 22 assercoes fin6:
prova_trilho.py                         0
prova_grafico.py                        0
prova_atmosfera.py                      0
prova_suite.py                          0
node --check public/app.js              0
diag_mobile.py 360/390/414/1280/1440    0/0/0/0/0
diag_largo.py  1500/1920/2560           0/0/0
git status                              limpo
get_advisors (security)                 3 avisos, NENHUM da E1
```

Os 3 avisos sao os mesmos de sempre: `registrar_venda` e `remover_nf` como
`security definer` executaveis por `authenticated`, mais a protecao de senha vazada
desligada no Auth. Nenhum deles nasceu aqui.

---

## 3. A REPROVA: a nota de `pct_julgado` desenha porcentagem com cifrao

**O que esta errado.** `finNota` formata `valor_antes`, `valor_depois` e `diferenca`
sempre com `brlV`, que e literalmente `"R$ " + Number(n).toLocaleString(...)`. O CHECK da
`fin_nota_numero` ja admite `pct_julgado` no conjunto fechado de 9 escopos, e
`pct_julgado` e o unico dos nove que **nao e dinheiro**.

**Nao e hipotese: o proprio harness ja monta essa nota.** Em `ferramentas/harness.py:941`
existe `{ codigo: 'n_pct', escopo: 'pct_julgado', valor_antes: 90, valor_depois: 2.11,
diferenca: -87.89 }`. Na tela isso sai como:

```
de R$ 90,00 para R$ 2,11 · −R$ 87,89
```

para uma cobertura que foi de **90% para 2,11%**.

**Por que a suite fica verde em cima disso.** A assercao de `ferramentas/harness.py:7675`
so confere que a nota EXISTE (`1 === finQA('.fin-inc .fin-nota').length`). Nenhuma das 22
assercoes `fin6:` le o TEXTO dos valores da nota. O guard-rail cobre a presenca e nao
cobre o conteudo.

**Por que importa agora e nao depois.** Este e o unico lugar da tela onde a nota aparece
debaixo de `base incompleta`, ou seja, exatamente onde o dono ja esta desconfiado do
numero. E a **E2 leva marco para 91,77%**, que e o primeiro momento real em que o F3
dispara e uma nota de cobertura passa a fazer sentido escrever.

**Como consertar, na entrega que reusar o mecanismo:**

1. coluna `unidade` em `fin_nota_numero`, `text not null default 'brl'`, com
   `check (unidade = any (array['brl','pct']))`. Default `'brl'` porque 8 dos 9 escopos
   sao dinheiro e as 3 notas de hoje ja ficam certas sem migration de dado;
2. a `fin_painel` devolve `unidade` junto dos outros 8 campos;
3. `finNota` escolhe o formatador pela `unidade`, nunca por escopo chumbado no JS;
4. assercao `fin6:` nova que le o **texto** da nota de `pct_julgado` e cobra `90,00%`,
   nao `R$ 90,00`. A assercao de presenca fica, mas nao substitui.

Isso e **fatia da E2**, nao entrega propria: a E2 ja mexe no mecanismo de nota (`se a
saida for A, a nota do E1 sobe junto para os meses que mudarem`) e ja e a entrega que faz
o F3 disparar. Abrir sessao so para uma coluna e um formatador quebraria a regra de corte
vertical da secao 3 do CONTRATO, porque a frase nao teria sujeito que o dono veja hoje.

---

## 4. Dois achados fora do commit, sem culpar a entrega

### 4.1 A `msg` de leitura da `fin_painel` nao esta na secao 4 do CONTRATO

`Dominio invalido: use empresa, pessoal ou tudo.` e devolvida pela `fin_painel` e **nao
consta** na lista fechada da secao 4. A secao 4 tem so a variante de escrita,
`Dominio invalido: use empresa ou pessoal.`, que e a das RPCs de escrita.

Entrou em `78be994`, a Fatia 1, e atravessou sete commits sem ninguem notar. O v19 afirma
"as duas ja estao na secao 4" e esta **certo sobre as duas que ele conta**
(`Sessao invalida.` e `Financeiro e restrito ao dono.`); a terceira nunca foi contada por
ninguem.

Conserto: a linha entra na secao 4 na proxima entrega que ja abrir o `CONTRATO.md`. A E2
abre, porque cria recusa nomeada nova. **Entrega de raio grande: `CONTRATO.md` alterado
sai em duas fases, com parada entre elas.**

### 4.2 "Tenant errado" nao e testavel de verdade nesta base

A `app_usuario` tem **dois usuarios e um tenant so**
(`00000000-0000-0000-0000-000000000001`). O que se prova hoje e UID fora da tabela, que
cai em `fn_tenant_atual() = null` e devolve zero linha. O v19 registra isso honestamente
como "UID inexistente". Fica anotado que a prova de isolamento cross-tenant do Financeiro
e, por ora, **estrutural e nao empirica**, e que ela so vira empirica quando existir um
segundo tenant, o que pelo invariante 17 nao se constroi antes do primeiro pagamento.

### 4.3 Observacao menor, sem veredito

O comentario do `app.js` diz que "o casamento sai do dado, nao de uma lista de escopos
chumbada aqui (C2)". As bases (`saldo`, `entrou`, `saiu`, `estoque`, `gasto`, `lucro`,
`pct_julgado`) **estao** chumbadas no JS, uma por celula. Nao viola o C2, que fala de
categoria, conta e grupo, e esses vem da `fin_config`: as bases sao a identidade de cada
celula, nao dado de config. Mas o comentario afirma mais do que o codigo faz, e
comentario que inflaciona e o comeco de um arranque desatualizado.

---

## 5. Estado para a proxima sessao

- **Ponto do plano:** E1 fechada e auditada. Faltam **oito** das nove entregas.
- **Proxima entrega:** E2, `nenhuma regra grava dominio para contraparte que o dono
  nunca julgou, e a tela mostra quantas linhas voltaram para a fila`.
- **Trava da E2:** a decisao **D-s** (a regra `Compra no débito`), secao 1 do plano
  integral. Sem ela a E2 nao comeca.
- **A E2 carrega tres coisas alem da frase dela:** a saida da D-s, o conserto da unidade
  da nota (secao 3 deste handoff) e a linha que falta na secao 4 do CONTRATO
  (secao 4.1). As duas ultimas entram **de carona, declaradas no escopo**, nunca
  descobertas no meio.
- **A E2 e de raio grande** porque altera `docs/financeiro/CONTRATO.md`: duas fases,
  com parada entre elas, conforme a regra do condutor.
- **Custo declarado e esperado da E2:** marco cai para 91,77% e apaga numero economico
  ate o dono julgar. Isso e a entrega funcionando, nao defeito dela.
- `git status` limpo, banco igual ao git, suite verde. O portao de entrada da proxima
  sessao deve abrir sem conserto.
