# Handoff v62 — 17/08/2026

Substitui todos os anteriores. Sessao de **carga de preco** das duas calculadoras,
que terminou virando tambem **correcao de RLS**: o buraco de seguranca que a skill
carregava anotado desde 27/07 nao era o pior, e o pior ninguem tinha nomeado.

Sem tela nova. Banco, dados e permissao.

---

## 0. Para quem chega agora, em cinco linhas

1. A tabela de preco de 17/08 esta no ar nas duas calcs: **494 produtos, 1.029
   precos**, 16 fornecedores com lista nova, Raposa preservada.
2. `calc_dados` **nao e mais legivel por vendedor**. Ate hoje a sessao do Brendon
   baixava custo, fornecedor e praca pelo PostgREST.
3. O `public/calc/consultor/dados.js` **continua publico** e e a maior pendencia.
4. O remote do git mudou de novo: hoje e **so `origin`**. Medir antes de empurrar.
5. Commits: `dd4bb36` (tabela), `c5f526e` (skill), `a7277f4` (skill + seguranca).
   Migration: `calc_dados_select_apenas_dono`.

---

## 1. Estado medido no fim da sessao

| O que | Valor | Como conferir |
|---|---|---|
| `calc_dados` (tenant 0001) | 494 produtos, 1.029 precos, soma 3.948.560,95 | SQL da secao 7 |
| `atualizado_em` | 2026-08-17 23:20:02 UTC | idem |
| Fornecedores no blob | 17 (16 com lista nova + Raposa preservada) | idem |
| Linhas `CPO` | 38 | idem (zero seria erro de ordem de leitura) |
| `dados.js` do consultor | 137 produtos, 413 precos | `node --check` + secao 7 |
| `config.validade` | **24/08/2026** | `curl` da secao 7 |
| Policy `calc_dados_sel` | exige `papel = 'dono'` | prova da secao 5 |
| Clone x `origin/main` | 0 / 0 no fim da sessao | `git rev-list --left-right --count` |

Working tree deixado com `public/app.js` e `ferramentas/harness.py` modificados.
**Nao sao meus**, ja estavam assim no inicio da sessao. Commitei sempre por
caminho especifico, nunca `git add -A`.

---

## 2. A carga de 17/08

Export `Downloads/17_08 fornecedores .zip`, md5 `EFBF3172CF4268A888DCD6472BB77046`,
`_chat.txt` com 3.472 linhas, **20 mensagens, todas do proprio dia 17/08**. O md5 e
a data da ultima mensagem foram conferidos ANTES de parsear, pela armadilha de
03/08 (tres vezes o mesmo zip velho apontado como novo).

16 fornecedores mandaram lista. **A Raposa nao mandou**, e as 24 linhas / 29 precos
dela foram preservadas dentro da propria transacao de escrita, lidas do blob antigo.
Nunca apagadas em silencio, nunca apresentadas como preco de hoje.

Diff contra a carga de 15/08, calculado no banco por `full outer join`:

| | |
|---|---|
| precos antes / agora | 1.043 / 1.000 (mais 29 da Raposa = 1.029) |
| subiram / cairam / iguais | 11 / 22 / 804 |
| novos / sairam de linha | 163 / 206 |
| **variacao acima de 15%** | **zero** |

Os 206 que sairam de linha nao sao perda de dado: 53 do BR10 e 32 da DG sao troca
de lista (a DG mandou **seminovos** hoje, e em 15/08 tinha mandado lacrados, entao
nenhuma chave se repete), e os 29 da Raposa foram preservados.

**Como o dado atravessou.** Payload de 26 KB em 5 pedacos para `privado.carga_1708`
(staging, invisivel ao PostgREST), depois transformado por SQL. Checksum dos dois
lados antes de escrever: **1.000 precos e soma 3.877.683,95**, iguais no parser
local e no Postgres. A escrita foi um bloco `DO` unico com tres travas
(`494` produtos, `1.029` precos, soma `3.948.560,95`); qualquer desvio derrubaria a
transacao inteira. Staging dropado no fim.

**Derivacao do consultor provada contra o BANCO**, nao contra o proprio calculo:
413 precos, 137 produtos, soma pv 1.825.252,64 e pp 1.866.552,64, os quatro numeros
iguais dos dois lados.

---

## 3. As sete armadilhas de parser desta carga

Todas achadas por conferencia manual contra a lista de origem, **nenhuma por trava
automatica**. A trava de 15% deu zero, e ainda assim havia sete erros. Isso e o
recado principal desta secao: **variacao dentro da faixa nao prova leitura certa.**

1. **Ordem do bloco decide o que e preco solto.** O mais caro. O Davi/Fabio lista
   **um preco por unidade** (`AZUL / 2.699 / 2.679 / 2.679`) e a MP lista **preco e
   depois as cores** (`R$4.699,99 / azul / branco`). Tratados igual, o ultimo preco
   do Azul virava o preco do Verde. Regra implantada: o PRIMEIRO evento do bloco
   decide. Comecou com cor, preco solto e outra unidade da MESMA cor e fica o menor;
   comecou com preco, ele vale para as cores seguintes.
2. **`Poco F8 Ultra 512GB` casava com Apple Watch Ultra 3.** R$4.550 de Android
   viraria relogio. `ultra` sozinho nao basta, exigir `ultra 3`.
3. **`anc` sem fronteira de palavra casa dentro de "c_anc_elamento"**: o AirPods 4
   SEM cancelamento virava o COM, e um dos dois sumia.
4. **`ª` nao e acento combinante**, entao `sem_acento()` nao virava `1ª linha` em
   `1a linha`: o fone paralelo de R$69,99 entrava como **AirPods Pro de verdade** e
   o Cabo Apple herdava os R$69,99.
5. **`caixa branco` virava cor Branco fantasma** em todo produto CPO do Cristiano.
6. **O Cristiano escreve `s11 46` sem "mm"**: os relogios dele colavam no bloco do
   Ultra 3.
7. **Linha comecada por `*` escapava do detector de produto** (o teste rodava no
   texto cru, nao no `limpa()`): `*MACBOOK AIR M5 512GB*` nao era produto e os
   R$7.899,99 caiam no MacBook Neo de cima.

Mais duas de estrutura, do mesmo tipo: **casar fornecedor pelo corpo da mensagem**
fez a Five Cell inteira virar Junior (`lacrados` aparece no corpo de quase toda
lista; casar so pelo cabecalho), e **produto fora do catalogo precisa FECHAR o
bloco**, senao o `pack com 1 AirTag` (R$200) e o `poco x8 pro` (R$2.297) jogam preco
e cor dentro do produto de cima.

---

## 4. Decisoes do dono, 17/08/2026

- **Numero malformado se corrige por coerencia**, com tabela explicita
  `token -> valor` no parser, nunca por regra generica. Os quatro desta carga:
  `4,850,00` -> 4.850,00 (Quality) · `4.3999,99` -> 4.399,99 (MP) ·
  `7.200,00,00` -> 7.200,00 (LBR) · `1.1550` -> 1.550,00 (Davi/Fabio). Token fora da
  tabela continua sendo pendencia, nunca vira preco.
- **Preco com condicao pendurada fica de fora.** Fecha uma pendencia que estava
  aberta desde 03/08: `caixa aberta`, `lacre rompido`, `deslacrado / somente para
  midia` e `c/caixa` agora sao descarte declarado no diff. Custo conhecido e aceito:
  os 4.500 do M Apple seriam o **17 256GB mais barato da rodada** (o proximo e 4.900).
- **Poco e Xiaomi ficam fora do catalogo** (6 precos, Real Comercio, LBR e Cristiano).
- **Entram** `iPhone 13 mini 512GB` (Quality, 1.599) e `iPhone 16 Pro Max 1TB`
  (MP, 5.749,99).
- **`MACBOOK AIR M5 512GB` da MP entra sem a RAM no nome**, contra a minha
  recomendacao de deixar fora. Vira `MacBook Air M5 13" 512GB` (polegada e deducao
  documentada; RAM nao se inventa, regra de 03/08). Nao funde com o
  `MacBook Air M5 13" 16/512GB` dos outros seis fornecedores e aparece como linha
  propria. Impacto zero em preco de venda: a 7.899,99 nunca e o menor (Real Comercio
  esta 7.844,99).
- **`MacBook Air M4 15" 16/256GB`** (Real Comercio, 7.386) entrou na mesma carga sem
  pronunciamento do dono; comunicado depois, sem objecao registrada. Se for para
  sair, e uma linha.
- **"Sem selo" nao quer dizer aparelho sem selo.** Eu marquei o `iPhone 11 64GB` do
  Joao Telles a R$750 como suspeito porque a lista abre com `SEM SELO / SEM
  GARANTIA`. E instrucao para **nao retirar** o selo que vem no aparelho. O preco e
  legitimo e e o menor do modelo.
- **Fechar `calc_dados` para vendedor agora** (secao 5), deixando a opcao B para
  depois, porque o Brendon nao usa o painel.

---

## 5. A correcao de RLS: o buraco maior nao era o que estava anotado

A skill carregava desde 27/07 a pendencia do **`dados.js` publico** (preco de venda
e escada de comissao, sem login). O dono perguntou como resolver. Medindo para
responder, apareceu um buraco maior que nenhum documento citava:

```
calc_dados_sel: using (tenant_id = privado.fn_tenant_atual())
```

A policy **filtrava so por tenant**, e `authenticated` tem `GRANT SELECT`. O Brendon
e `vendedor` **no mesmo tenant**, ativo. Ou seja: com a sessao dele, uma chamada no
PostgREST devolvia o blob inteiro, com **custo, nome do fornecedor e praca** das 494
linhas. Isso e a cadeia de suprimento, que vale mais que a tabela de venda.

**Por que nao existia meio-termo.** O blob e UMA linha de jsonb e RLS e por LINHA:
nao da para esconder `v`, `f` e `l` de dentro dela por policy. Ou o papel le tudo,
ou nao le nada.

**O agravante de tres dias antes.** O commit de vendas (`10d76b9`) fez o painel ler
`calc_dados` direto, com este comentario em `public/app.js:1151`:

```
// Zero migration: `calc_dados` ja tem policy de SELECT para `authenticated`
```

A frouxidao virou dependencia de uma feature nova. Deu para fechar assim mesmo
porque o Brendon nao usa o painel, mas a janela era estreita. **Frouxidao de
permissao nao envelhece parada: alguem constroi em cima.**

Aplicado (migration `calc_dados_select_apenas_dono`):

```sql
alter policy calc_dados_sel on public.calc_dados
  using (tenant_id = privado.fn_tenant_atual()
         and privado.fn_papel_atual() = 'dono');
```

Provado na hora, com `set local role authenticated` e `request.jwt.claims` de cada
uid:

| Quem | Le `calc_dados` |
|---|---|
| sem RLS (postgres) | 2 linhas (tenant 0001 + a orfa do 0004) |
| **dono** | **1 linha**, e enxerga fornecedor (`BR10`) |
| **Brendon (`vendedor`)** | **0 linhas** |
| anon | `permission denied for table calc_dados` |

O dono le 1 de 2 linhas: o isolamento de tenant continua intacto, nao foi trocado
por controle de papel.

**Consequencia viva, aceita:** se um `vendedor` abrir o painel, a busca de produto e
a tabela de parcelamento vem **vazias, sem erro** (a query volta 0 linhas, nao
falha). No dia em que o Brendon usar o painel, o sintoma vai parecer bug de tela e
e permissao.

---

## 6. Aberto

1. **`dados.js` publico** (desde 27/07, agora a maior pendencia de seguranca).
   Preco de venda das 413 combinacoes e a escada de comissao completa, sem login.
   A saida desenhada e a **opcao B**: RPC `SECURITY DEFINER` com projecao por papel
   (dono ve custo; qualquer outro papel ve so `n`, `c`, `t`, cor, hex, `pv`, `pp`,
   mais `validade`, `pb`, `taxas`, `comissao`), `revoke select on calc_dados from
   authenticated`, as tres telas lendo a RPC, e o arquivo apagado do repo. Ganho
   maior que a seguranca: a derivacao pv/pp passa a acontecer no banco, some a
   geracao manual do arquivo e o push a cada carga, trocar a validade deixa de
   exigir deploy, e a divergencia entre as duas calcs deixa de ser possivel por
   construcao. **Pergunta que dimensiona a obra e segue sem resposta: o painel pode
   mostrar CUSTO para o vendedor?**
2. **Validade sem alerta.** Nao venceu desta vez (estava em 22/08 com 5 dias de
   folga, a primeira rodada em que o arranque nao achou a calc travada), mas segue
   sendo um prazo que expira sozinho. Ja travou o consultor por 9 dias em 27/07 e
   por 5 em 15/08.
3. **`Acessório` ainda ganha margem de iPhone** (AirPods Pro de R$1.500 aparece a
   R$2.050). Herdado do v60, sem decisao.
4. **Linha orfa no tenant `...0004`** com o blob de 27/07 (341 produtos). A RLS
   filtra, mas o `.single()` de `public/calc/index.html` quebra a pagina inteira se
   alguma sessao enxergar as duas.
5. **Duas cores nao resolvidas** nesta carga, sem erro de preco: o emoji cinza e
   ambiguo (Natural, Silver ou Space Gray), entao o All imports perdeu uma cor do
   `13 Pro Max 128GB` e o `15 Pro 128GB` dele entrou **sem cor**; e o
   `Light blue loop` do Ultra 3 do Cristiano ficou como `Azul` em vez de `Sky Blue`.

---

## 7. Como provar, comandos exatos

Banco:

```sql
select atualizado_em,
       jsonb_array_length(dados->'produtos') as produtos,
       (select count(*) from jsonb_array_elements(dados->'produtos') p,
               jsonb_array_elements(coalesce(p->'cs','[]'::jsonb)) c) as precos,
       (select count(distinct p->>'f') from jsonb_array_elements(dados->'produtos') p) as fornecedores
  from public.calc_dados
 where tenant_id = '00000000-0000-0000-0000-000000000001';
```

Esperado hoje: `2026-08-17 23:20:02+00`, `494`, `1029`, `17`.

Consultor no ar (nunca pelo navegador do dono, que tem cache):

```
curl -s https://flat-resonance-09ba.pitstopimports.workers.dev/calc/consultor/dados.js | grep -o 'validade":"[0-9/]*"'
```

Esperado: `validade":"24/08/2026"`.

Codigo da calc do dono e sempre em `/calc/`, **nunca** `/calc/index.html`, que cai
no fallback de SPA e devolve outra pagina sem erro.

Git, na ordem que evita estrago:

```
git remote -v
git fetch origin main && git rev-list --left-right --count origin/main...HEAD
git push origin HEAD:main
```

**O nome do remote ja mudou duas vezes**: era `origin`, virou `github` em 15/08,
e em 17/08 o `github` sumiu e o `origin` voltou a ser o bom. Medir, nao lembrar.

---

## 8. Ponteiros

- Skill do dominio: `.claude/skills/calculadoras/`, com os quatro `references/`
  atualizados nesta sessao (`aprendizados.md` ganhou a entrada de 17/08,
  `mapa-calculadoras.md` a RLS nova e o remote, `formato-dados.md` os nomes e as
  decisoes, `procedimento-alimentacao.md` os comandos de push).
- Parser desta carga: `parse1708.py` no scratchpad da sessao, **nao versionado**.
  Se a proxima carga for feita a mao de novo, as sete armadilhas da secao 3 estao
  todas descritas em `aprendizados.md` para nao serem repagas.
- Suite de validacao do frontend **nao foi rodada**: esta sessao nao encostou em
  `app.js`, `app.css` nem `index.html` do painel.
