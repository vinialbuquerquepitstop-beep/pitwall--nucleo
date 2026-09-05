# Handoff financeiro v19 — E1: o saldo que mudou traz na tela a explicacao

**Data:** 05/09/2026
**Entrega:** E1 de `docs/financeiro/plano_solucao_integral_20260904.md`, secao 3.
**Frase:** *o saldo que mudou traz na tela a explicacao de por que mudou.*
**Substitui:** `handoff_financeiro_pitwall_v18.md`.

---

## 1. O que fecha

A divida do **portao 6.3**, aberta desde 03/09/2026: tres saldos mudaram de valor e a
tela nao disse por que. Decisao do dono em 04/09/2026, **D-t = A** (pagar, nao dispensar).

A excecao 6.3.1 nao cobria o caso: tres das quatro condicoes falhavam.

Defeito 2 dos nove da auditoria de 04/09. Sobram oito.

---

## 2. O mecanismo, e por que ele e generico

`fin_nota_numero` nao guarda um texto da Thay: guarda **qualquer numero da tela que
mudou de valor**. Uma linha = um numero, num mes de competencia, com valor antes, valor
depois, a causa em uma frase e a data do fato.

E1 veio **antes** da E2 exatamente por isso: a E2 tambem muda numero na tela e cai no
6.3 igual. Construir a nota uma vez, usar duas.

| Coluna | Papel |
|---|---|
| `codigo` | chave estavel (Inv. 12), e o que torna o seed idempotente |
| `escopo` | o codigo do numero explicado. **E ele que diz a tela ONDE colar** |
| `competencia` | primeiro dia do mes, travado por CHECK |
| `valor_antes` / `valor_depois` | `numeric(14,2)` |
| `diferenca` | **coluna GERADA**, `valor_depois - valor_antes`. A tela nunca recalcula |
| `causa` | a frase, escrita para o dono, com acento e cedilha |
| `mudou_em` | data do FATO, sem default: a mudanca pode ser anterior a escrita da nota |

`escopo` e conjunto fechado de 9 valores, casados com as chaves que a `fin_painel` ja
serve: `saldo`, `saldo_empresa`, `saldo_pessoal`, `entrou`, `saiu`, `gasto`, `estoque`,
`pct_julgado`, `lucro`.

### Decisao de desenho: a nota nao tem caminho de escrita pelo app

`authenticated` recebe **SELECT e mais nada**. Nota nasce por migration, junto da
entrega que mexeu no numero, nunca pela tela. E a leitura mais dura possivel do 6.3: a
explicacao vem do mesmo commit que moveu o valor.

Consequencia para a E2: ela vai ter que seedar a nota dela tambem. Isso e o desenho
funcionando, nao um obstaculo.

`arquivado_em` existe para que a unica remocao futura seja soft (Inv. 9). Hoje ninguem
pode escrever nela, e isso e proposital.

---

## 3. As tres notas, medidas

Os seis valores vieram da `fin_painel` de producao com o dono autenticado, nao do plano.

| mes | antes | depois | diferenca | linhas da Thay |
|---|---|---|---|---|
| fevereiro | 3.872,09 | 1.999,09 | **−1.873,00** | 2 |
| marco | 3.864,20 | 1.864,20 | **−2.000,00** | 3 |
| maio | 5.635,02 | 1.235,02 | **−4.400,00** | 3 |
| | | | **−8.273,00** | **8** |

Os −8.273,00 sao exatamente o liquido das 8 linhas que a tabela `auditoria` mostra indo
de `empresa` para `pessoal` em 03/09/2026 22:56:46. A decisao da Thay foi do dono e
**nao foi revertida**.

O seed e idempotente (`on conflict (tenant_id, codigo) do nothing`) e tem trava propria:
um bloco `DO` que derruba a migration inteira se as tres notas nao ficarem no estado
alvo ou se a soma nao der −8.273,00. Rodar de novo nao duplica e nao mascara divergencia.

---

## 4. Como a tela ancora a nota

A nota e desenhada pela **MESMA funcao que desenha o numero** (`finCel`), dentro da
`.pb-celula`, depois do pe. Nao e aba de historico, nao e rodape, nao e bloco no fim da
Visao: nos tres casos numero e explicacao viram dois objetos, e o dono le o primeiro sem
o segundo. Aqui **nao existe caminho de codigo que desenhe um sem o outro**, porque sao
a mesma string.

O casamento sai do dado, nao de lista chumbada no JS (C2): a celula declara as bases que
desenha, a coluna declara o lado, e o `escopo` (`base` ou `base_lado`) e o endereco.

**Nota segue numero.** Numero que nao esta na tela nao carrega nota:
- `saldo_empresa` nao aparece sob o filtro Pessoal;
- nenhuma nota de caixa aparece sob o F3, onde os numeros do caixa nao sao desenhados.
  A nota carrega valor em dinheiro, e derramar isso debaixo de "base incompleta"
  desenharia pela porta dos fundos o numero que o F3 acabou de esconder;
- a nota de `pct_julgado` FICA no bloco do F3, porque o julgado e o unico numero que
  aquele estado desenha.

Excecao coerente: o cartao "Resultado da loja" nao se divide em empresa e pessoal (a
venda e da loja), entao ele e sempre o placar principal e recebe o escopo `lucro` sem
lado, inclusive no filtro `tudo`.

Zero token de cor novo (C5). A nota usa `--dim`, o tom do pe da celula. **Nao** usa
`--erro` (isto nao e falha) nem `--morno` (isto nao e ambiguidade cobrando trabalho, que
e o D-o): e explicacao.

---

## 5. Provas

### 5.1 Portao proprio: nenhum saldo mudou

`fin_painel` como dono, mes a mes, antes e depois das tres migrations. **42 celulas
comparadas** (pct julgado, saldo total, empresa, pessoal, entrou, saiu nos 7 meses):
**42 identicas, zero mudou**. E1 explica numero passado, nao produz numero novo.

Nao houve remedicao depois do trabalho de frontend: a conexao MCP do Supabase caiu.
Tela e harness nao tocam no banco, entao nada podia ter movido esses numeros, mas a
medicao pos-frontend nao existe e nao se deve afirmar que existe.

### 5.2 Seguranca

| Prova | Resultado |
|---|---|
| Grants para `authenticated` | so `SELECT` |
| Grants para `anon` | nenhum |
| DELETE / TRUNCATE / REFERENCES / TRIGGER | nenhum (Inv. 9) |
| RLS na tabela | ligada, policy dono-only usando `tenant_id` (Inv. 7) |
| Vendedor lendo a tabela | 0 linhas |
| Vendedor na `fin_painel` | `Financeiro e restrito ao dono.` |
| UID inexistente | `Sessao invalida.` |
| Recusa nova inventada | nenhuma, as duas ja estao na secao 4 do CONTRATO |
| `security definer` nova | nenhuma, `fn_fin_importacao_fechar` segue unica |
| `current_date` novo | nenhum (Inv. 10) |
| Trigger de auditoria | `trg_auditar_fin_nota_numero` (Inv. 6) |
| `get_advisors` | 3 avisos, **nenhum da E1** (dois definers pre-existentes, senha vazada) |

### 5.3 Suite, por EXIT CODE

Todos **EXIT 0**. O harness rodou **5 vezes**, todas 0.

```
node --check public/app.js        0
validar.py                        0
harness.py                        0  (5 corridas)
prova_trilho.py                   0
prova_grafico.py                  0
prova_atmosfera.py                0
prova_suite.py                    0
diag_mobile.py  360/390/414/1280/1440   0/0/0/0/0
diag_largo.py   1500/1920/2560          0/0/0
```

**1109 passou, 0 falhou. 1114 rotulos declarados, 1109 distintos executados, 0 nao
executaram** (5 de ramo alternativo, previstas). Eram 1087 antes.

Do Financeiro: **323**. `fin:` 87 · `fin2:` 56 · `fin3:` 80 · `fin4:` 40 · `fin5:` 38 ·
**`fin6:` 22**. Mais 2 `suite:`, que provam a ferramenta.

As `fin6:` cobrem: mes sem nota nao desenha nada e nao quebra; a nota mora dentro da
celula do numero; o lado do escopo casa com a coluna; **nenhum numero com nota se
desenha fora da celula que a carrega** (a inseparabilidade do 6.3); nas colunas de caixa
so colam escopos com lado; o lucro cola no cartao de venda; a nota some junto com o
numero no filtro que o esconde; nada de caixa vaza sob o F3; a `diferenca` exibida e a
do servidor e nao uma refeita no JS; a causa sai byte a byte com acento e cedilha; e a
nota usa `--dim`, nunca `--erro` nem `--morno`.

A sonda da `diferenca` merece nota: o fixture manda `-100,00` onde a conta daria
`-90,00`. No banco `diferenca` e coluna gerada e nao pode divergir; no fixture ela
diverge de proposito, porque e o unico jeito de separar "a tela exibiu o campo do
servidor" de "a tela refez a conta".

---

## 6. Migrations

Aplicadas e versionadas. **O nome do arquivo e a version do ledger discordam de dia**, e
isso e a virada do fuso, nao arquivo fora de ordem: aplicadas em 04/09 a noite em Sao
Paulo, que e 05/09 em UTC. Cada arquivo diz isso no cabecalho.

| Arquivo | Version no ledger |
|---|---|
| `20260904_fin_nota_numero_schema.sql` | `20260905022511` |
| `20260904_fin_nota_numero_seed_thay.sql` | `20260905022554` |
| `20260904_fin_painel_notas.sql` | `20260905022704` |

`fin_painel` mudou em tres pontos: uma variavel, um SELECT sobre `fin_nota_numero`, e a
chave `notas` no retorno. **Nenhuma linha de calculo foi tocada.** `security invoker`,
`stable` e `search_path` inalterados.

Regra de janela: a nota entra quando o mes de competencia intersecta a janela pedida. A
nota **nao** e filtrada por `p_dominio`, de proposito: quem sabe onde cada escopo
aparece e a tela, e filtrar no servidor exigiria mapear escopo para dominio la, que e
conhecimento de layout, nao de dado.

---

## 7. Achados fora da entrega

### 7.1 A suite tem um teste instavel (flaky)

Uma corrida devolveu **EXIT 1 com 9 falhas**, todas na previa do OFX (`fin: a PREVIA
aparece antes de qualquer gravacao` e as 8 seguintes). Isolado: com o `app.js` novo e o
`harness.py` do HEAD, EXIT 0. Com os dois novos, 8 corridas seguidas EXIT 0. As 20
linhas que separavam as duas medicoes eram **comentario puro, ASCII, zero delecao**.

E corrida assincrona no `finSoltar`, nao regressao. **Isto e divida aberta e perigosa:**
a doutrina do projeto e confiar no EXIT CODE, e um EXIT 1 fantasma treina a proxima
sessao a ignorar o guard-rail exatamente quando ele estiver certo. Quem pegar isso:
o ponto e o `await finSoltar(...)` seguido de `finQ('.fin-previa')` sem espera.

### 7.2 O inventario dos documentos esta errado em sete pontos

Medido no banco vivo em 04/09/2026. **Nao corrigido aqui de proposito**: e trabalho da
revisao final do plano integral, e os numeros ja estao medidos.

| Item | Doc diz | Real | Onde |
|---|---|---|---|
| RPCs publicas `fin_` | 11 | **14** | `CONTRATO.md` §1 |
| Helpers privadas `fn_fin_` | 5 | **8** | `CONTRATO.md` §1, `PRD-ESTADO` §1 |
| Categorias ativas | 33 | **34** (9 grupos) | `CONTRATO.md` §1 |
| Assercoes do Financeiro | 223 de 997 | **323 de 1109** | `CONTRATO.md` §1, `CLAUDE.md` |
| `fin_categoria` colunas | 12 | **13** | `CONTRATO.md` §1 |
| `fin_movimento` colunas | 19 | **21** | `CONTRATO.md` §1 |
| Migrations `fin_` versionadas | 22 | **29** (agora 32) | `PRD-ESTADO` §1 |

As 3 RPCs a mais sao `fin_cobertura`, `fin_repasse_marcar`, `fin_repasse_desmarcar`.
Os 3 helpers a mais sao `fn_fin_cobertura`, `fn_fin_contraparte`, `fn_fin_cp_norm`.

### 7.3 O F3 nao e mais o gargalo

O `PRD-ESTADO` de 02/09 registra **4,22% julgado em VALOR** na base inteira. Medido em
04/09: fevereiro a agosto estao em **100%**, menos julho, em **98,54%**. **Os sete meses
passam os 95% do F3.** A entrega da categoria (`7e339d7`) e o trabalho da Thay fecharam
o buraco. O gargalo do modulo agora e a lista de nove defeitos, nao a cobertura.

### 7.4 O portao de entrada precisa dos DOIS criterios de md5

Casando git contra banco, o criterio normalizado do handoff v2 §4.2 (comentario e espaco
fora, minusculo) **reprova dois arquivos corretos**: `fin_fatia2_regra_schema` e
`fin_fatia2_helpers_search_path`. Sao os dois que contem o literal acentuado do
`translate()`, e o `lc` do Perl nao baixa caixa de acentuado multibyte enquanto o
`lower()` do Postgres baixa. Os dois casam **byte a byte depois de tirar o cabecalho**.
Quem remedir so pelo normalizado vai reprovar arquivo correto.

Divida herdada, sem mudanca: **174 aplicadas contra 42 versionadas, 132 sem arquivo no
git**, o mesmo numero do handoff financeiro v1 §9.2.

---

## 8. Como foi construido

Torre encadeando. `base` fez schema, seed e `fin_painel`; `vitrine` fez `app.js` e
`app.css`. **Os dois subagentes travaram** (watchdog, 600s sem progresso): o `base`
depois de terminar, o `vitrine` no meio do harness. A Torre verificou o trabalho do
`base` do zero e escreveu os fixtures e as 22 `fin6:` que faltavam.

Nao houve passagem pela `bandeira`: a Torre provou direto. A auditoria da secao 7 do
CONTRATO, que roda em sessao SEPARADA, segue devendo e e o passo certo para isso.

---

## 9. O que fica aberto

1. **Oito defeitos** dos nove. A vez e a **E2** (`nenhuma regra julga sozinha`),
   destravada pela **D-s = A**, e ela reusa o mecanismo de nota desta entrega.
2. **D-u** (`MF COMPANY LTDA`, R$ 6.100,00), **D-v** (`BRUNO DA COSTA AZEVEDO`,
   R$ 270,00) e **D-w** (Rodrigo Alves, R$ 630,00, trava a E8) seguem sem resposta do
   dono.
3. O flaky da previa (7.1).
4. O inventario dos documentos (7.2).
5. **A tela nao foi aberta nesta sessao.** Toda a medida veio da suite e do banco. Vale
   o "entregar palpavel": a proxima sessao deveria abrir a aba Financeiro e conferir que
   a nota, no navegador de verdade, esta onde estas assercoes dizem que esta.
