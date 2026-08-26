# Handoff v67 — 25 e 26/08/2026

Substitui todos os anteriores da linha migracao. Sessao de CONSTRUCAO, disparada por um
pedido do dono em duas mensagens: "preciso de uma parte financeira, onde detenha todo
controle financeiro, dashboard, provisao, metas, um sistema financeiro completo. pessoal
tambem. inclua formas de enviar extrato de banco pra alimentar direto na pitwall", e
logo depois "incluindo alertas de gasto, secoes mostrando onde esta sendo gasto".

**Entrou a Fatia 1 do modulo Financeiro: 6 migrations e a aba na tela.** Detalhe
completo do frontend em `handoff_frontend_pitwall_v1.md` (linha `vitrine`, v1).

---

## 0. Para quem chega agora, em dez linhas

1. O pedido era CINCO subsistemas, nao um. Foi cortado em 6 fatias; a Fatia 1 fechou.
2. Decisao central: **caixa e resultado sao verdades separadas e nunca se somam.**
   `venda` diz o resultado; `fin_movimento` diz o caixa. Somar os dois dobraria o
   faturamento no dia em que o PIX do cliente virasse lancamento.
3. O dono tem **UMA conta bancaria com dinheiro da loja e pessoal misturados**. Dai o
   **invariante 18**, novo: movimento sem `dominio` nao entra em total nenhum.
4. Banco: 4 tabelas, 33 categorias em 9 grupos, bucket privado `extrato`, 6 RPCs.
5. Tela: aba `Financeiro` com Visao, Movimentos e Importar, parser de OFX no navegador.
6. **829 assercoes, 0 falhas** (piso era 713). Os 6 comandos e as 5 larguras em EXIT 0,
   conferidos pela Torre por conta propria, nao so pelo relatorio dos agentes.
7. O `base` **recusou parte da especificacao da Torre e estava certo**: o `hash_dedupe`
   como foi pedido apagaria dinheiro real em silencio. Secao 3.
8. A `vitrine` **achou o `diag_mobile.py` medindo verde vazio**: a lista `abasIds` e
   chumbada e nao continha a aba nova. Secao 6.
9. Nada foi commitado e nada foi publicado. Push e deploy aqui, e o dono nao mandou.
10. Nao ha um unico OFX REAL testado. E a ressalva que so o dono fecha. Secao 8.

---

## 1. As perguntas que fecharam o desenho

| Pergunta | Resposta do dono |
|---|---|
| Pessoal x PJ | **uma conta so, tudo misturado** |
| Formato de extrato | **OFX** |
| Dor mais cara | **"nao sei onde o dinheiro vai"** |
| Volume | **50 a 150 lancamentos/mes** |
| Metas | lucro, objetivos da empresa, reserva de seguranca |
| Pessoal | **espelho do empresarial** |
| Canal do alerta | app + WhatsApp, com ressalva; **a 2a rodada nao foi respondida** |

Aviso dado e registrado: a WhatsApp Cloud API exige numero dedicado que **sai do
WhatsApp do celular**, e nao pode ser o numero de venda do dono. Recomendacao para a
Fatia 6: PWA push.

---

## 2. As cinco decisoes de arquitetura

1. **Caixa x Resultado nunca se somam.** `fin_movimento.venda_id` liga os dois sem
   fundi-los, e vai revelar venda concluida que nunca entrou no banco (Fatia 5).
2. **`dominio` nasce NULL e nunca tem default silencioso** (invariante 18).
3. **Valor com sinal, natureza derivada** na leitura (invariante 4).
4. **Categoria `neutro`** (transferencia, aplicacao, resgate) fica fora de todo total de
   gasto. Sem isso, aplicar R$ 5.000 no CDB vira o maior gasto do mes.
5. **Categoria e config em tabela**, chave `codigo` (invariante 12).

## Invariante 18 (novo)

> Movimento financeiro sem `dominio` classificado nao entra em nenhum total de
> resultado, de gasto ou de meta. Aparece somente como "nao classificado", com valor
> visivel, cobrando o trabalho. `dominio` nunca tem default silencioso.

Na tela virou faixa fixa no topo, que declara o valor, a contagem, que os numeros abaixo
o ignoram, que ele e soma COM SINAL e que **nao muda com o filtro de dominio**.

---

## 3. O `base` recusou a especificacao da Torre, e estava certo

A Torre pediu `hash_dedupe = md5(conta | data | valor | memo)` com indice unico e
`on conflict do nothing`.

Cenario real, todo mes: **dois Uber de R$ 20,00 no mesmo dia, mesmo memo.** O OFX manda
os dois com FITIDs diferentes, o indice de `fitid` deixa passar, mas o hash e IDENTICO:
o `on conflict do nothing` engole o segundo e o caixa do mes fica R$ 20 mais leve **sem
nenhum sinal na tela**. Pior: `fin_lancar` recalcularia o mesmo hash, entao o dono
ficaria **impossibilitado de registrar o segundo na mao**. Buraco sem saida.

Correcao aplicada: o hash ganhou uma **ocorrencia**, o indice da linha dentro do grupo
de linhas identicas.

```
hash_dedupe = md5(conta_id | data | valor | descricao_base | ocorrencia)
```

- Duas identicas no mesmo arquivo: ocorrencia 1 e 2, **as duas entram**.
- Reimportar o mesmo arquivo: os contadores se reproduzem iguais, **as duas batem**.
- `fin_lancar` recusa com mensagem amigavel e aceita `forcar: true` quando aconteceu
  de verdade duas vezes.

Reversivel em uma migration (tirar a ocorrencia das duas expressoes).

**Licao, e ela e a mesma da v66 pela terceira vez: trava desenhada no papel protege o
caso que quem escreveu imaginou.** Foi a prova que separou o caso real do imaginado.

---

## 4. O banco (6 migrations)

| Versao | Nome | O que faz |
|---|---|---|
| `20260826014833` | `fin_fatia1_schema` | 4 tabelas, 2 indices unicos parciais, 5 de leitura, 8 policies dono-only, grants minimos, 4 triggers de auditoria |
| `20260826014901` | `fin_fatia1_seed_config` | 1 conta + **33 categorias** com acento intacto |
| `20260826014913` | `fin_fatia1_bucket_extrato` | bucket privado `extrato` + 2 policies |
| `20260826015046` | `fin_fatia1_rpcs_escrita` | `fin_importar_extrato`, `fin_classificar`, `fin_lancar` + helper privado |
| `20260826015200` | `fin_fatia1_rpcs_leitura` | `fin_painel`, `fin_movimentos`, `fin_config` |
| `20260826015511` | `fin_fatia1_indices_fk` | 3 indices de FK |

Tabelas: `fin_conta`, `fin_categoria` (config); `fin_movimento`, `fin_importacao` (dado).
Os 9 grupos: `Mercadoria`, `Operação`, `Taxas`, `Marketing`, `Outros`, `Receita`,
`Casa`, `Vida`, `Neutro`.

Versionadas em `supabase/migrations/20260826_fin_fatia1_*.sql`.

### Contrato das RPCs (o que a tela consome)

- `fin_config()` — contas e categorias ativas. **Nada de categoria chumbada no JS.**
- `fin_painel(p_ini, p_fim, p_dominio)` — placar, `secoes`, `entradas`. **`saiu` vem
  POSITIVO**; `delta_pct` e `null` quando nao havia base (a tela escreve `novo`, nunca
  `0%`); `nao_classificado_*` NAO respeita o filtro de dominio.
- `fin_movimentos(p_ini, p_fim, p_dominio, p_status)` — lista, para em 500 com
  `truncado`.
- `fin_classificar(payload)` — 1 ou N ids. **O que manda e a PRESENCA da chave**: chave
  ausente nao mexe no campo, chave com `null` LIMPA.
- `fin_lancar(payload)` — manual, com `repetido: true` e a saida `forcar: true`.
- `fin_importar_extrato(payload)` — transacional, aceita data crua do OFX, erro aponta
  a linha.

---

## 5. Provas de banco (14 cenarios)

Todas com `request.jwt.claims` + role `authenticated` (RLS valendo), **desfeitas por
`raise exception`**. Estado final: `fin_movimento` = 0 linhas, `fin_importacao` = 0.

| # | Cenario | Medido |
|---|---|---|
| 1 | RLS dono | conta=1 cat=33 imp=1 mov=1 |
| 2 | RLS vendedor (Brendon, mesmo tenant) | **0 em todas as 4 tabelas** |
| 3 | RLS tenant errado | 0 em todas |
| 3b | Vendedor chamando as 6 RPCs | as 6 recusam: `Financeiro e restrito ao dono.` |
| 4 | Importar o mesmo arquivo 2x | 1a `novas=5`; 2a `novas=0, duplicadas=5`, tabela nao mudou |
| 5a-c | Identicas sem fitid, reimportacao, arquivo sobreposto | 2 entram; reimportar da `duplicadas=2`; sobreposto da `duplicadas=1` |
| 6 | Sinal | `entrou=2000.00 saiu=100.00 resultado=1900.00` |
| 7 | Neutro (`aplicacao` -5000) | fora das secoes E fora de `saiu` |
| 8 | Invariante 18 | `nao_classificado_valor=-105.50 n=3`, fora de todo total |
| 9 | Lote de 3 ids | `n=3` numa chamada |
| 9b | Coerencia de sinal | avisa, nao recusa |
| 10 | `CURRENT_DATE` | **false nas 7 funcoes** (invariante 10) |
| 11 | Auditoria | exatamente 1 UPDATE, com antes e depois |
| 12 | Grants | nenhum `public`, nenhum `anon`, nenhum DELETE, nenhum TRUNCATE |
| 13 | `get_advisors` | 3 WARN, **as 3 pre-existentes**, zero introduzido |
| 14 | Base VAZIA | as 3 RPCs de leitura devolvem `ok:true`. **A tela nao quebra no 1o carregamento** |

---

## 6. A tela, e o que ela achou de quebrado

Aba `Financeiro` (`.aba aba-rara`, grupo `Análise`, abaixo de `abaDash`), com chips
`Visão · Movimentos · Importar`. Detalhe completo em `handoff_frontend_pitwall_v1.md`.

**Tres achados que valem mais que a tela em si:**

1. **As "4 ancoras" da linha minificada eram SEIS.** A Torre listou 4, e duas nem estavam
   na linha 1. As duas que faltavam sao defeito visivel: sem a do `topoTit`, a tela
   escreveria **"Dashboard"** em cima do financeiro (e o fallback do ternario); sem a da
   lista do `pitboard`, o placar de LEAD ficaria por cima do placar de dinheiro.
2. **O `diag_mobile.py` estava dando verde vazio.** As 5 larguras passavam ANTES de a
   `vitrine` tocar no arquivo, porque a lista `abasIds` e chumbada e nao continha
   `abaFinanceiro`: a tela nova nunca era desenhada na medicao. Corrigido, e agora mede
   as tres sub-views separadamente (a que aperta o layout e Movimentos, nao a Visao),
   abre a barra de lote e o formulario manual antes de medir, e REPROVA se os elementos
   nao estiverem no DOM na hora.
3. **Uma flake real foi morta.** `file.arrayBuffer()` nao anda com o
   `--virtual-time-budget` do headless: espera fixa era loteria, e a mesma assercao
   passou e falhou entre duas rodadas. Virou espera por condicao.

**Cor: zero token novo.** 9 grupos sobre 7 trilhos medidos, com mapa explicito e **uma**
colisao assumida (Marketing e Vida, os dois icones mais distantes). `Sem categoria` usa
`--morno` porque e ESTADO, nao identidade. Barra de secao em um tom so. **Gasto nunca em
vermelho**: `--erro` so na faixa de nao classificado e no `resultado` negativo, travado
por cor computada.

**Excecoes nomeadas em `validar.py`, sem repontar baseline.** Dois guard-rails bateram e
os dois eram reais. Em um deles a regra estava certa e o **CSS foi corrigido**
(`.fin-lote-n` de `--accent` para `--text`: contador nao age, ele conta). Os outros dois
viraram `CONTROLE_NATIVO = ['fin-chk', 'fin-solta.alvo']`, com dois auto-testes novos
provando que a excecao **nao vaza**.

---

## 7. Estado da suite

```
validar.py 0 · harness.py 0 · prova_trilho.py 0 · prova_grafico.py 0
prova_atmosfera.py 0 · node --check 0 · diag_mobile 360/390/414/1280/1440 todos 0
```
**829 assercoes, 0 falhas** (piso 713 da v65; +116, das quais 87 sao `fin:`). Duas
assercoes antigas foram ATUALIZADAS, nao silenciadas (`9 abas raras` para `10`).
Conferido pela Torre rodando a suite, nao lendo o relatorio.

---

## 8. O que ficou aberto

1. **Nenhum OFX REAL foi testado.** Todos os itens de prova foram jsonb ou arquivo
   sintetico. **Esta e a proxima acao do dono**: baixar um extrato de verdade, arrastar
   na aba, conferir a previa antes de confirmar. A previa existe exatamente para isso.
2. **O saldo do extrato e guardado e nunca conferido.** O `LEDGERBAL` vira
   `saldo_final_informado`, mas nenhuma RPC compara com a soma dos movimentos. **E a
   conferencia que pega importacao incompleta**, e ela nao existe. Barato de fechar.
3. **Categoria que zerou some da secao.** Gastar R$ 5.000 em julho e R$ 0 em agosto faz
   a categoria sumir. Para "onde o dinheiro vai" isso e informacao perdida: parar de
   gastar tambem e um fato. Mudanca de uma linha.
4. **Upload no bucket `extrato` nao foi exercido ponta a ponta.** As policies existem e
   foram lidas em `pg_policy`; nenhum arquivo subiu. O `nf` usa o mesmo molde.
5. **Canal externo de alerta sem decisao** (Fatia 6). Fatias 1 a 3 alertam so por dentro.
6. **Fatias 2 a 6 nao comecaram**: regras automaticas, teto e alerta, metas e provisao,
   conciliacao venda x caixa, canal externo.
7. **Nada commitado, nada publicado.** Push e deploy aqui.
8. Herdados e ainda validos: `docs/superpowers/plans/2026-08-19-segundo-lojista-tenant.md`
   segue sem commit (38 tarefas, nenhuma executada); `permite_esfriar` e config morta em
   4 dos 6 perfis; `LEAD-0019` e `LEAD-0028` com `origem` nula; `LEAD-0007` e `LEAD-0008`
   sem telefone; a escrita de volta no Notion bloqueada pela capability "Update content".

---

## 9. A ressalva de sempre

A base financeira tem **ZERO movimentos**. Todo numero que a tela mostra hoje e estado
vazio. Nao ha nada para calibrar, nenhuma media, nenhuma tendencia. O primeiro extrato
real e que transforma isto de encanamento provado em ferramenta.
