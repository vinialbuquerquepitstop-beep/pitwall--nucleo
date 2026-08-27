# PRD — Aba Financeiro (Pit Wall 2.0), estado atual

**Data da medicao:** 26/08/2026
**Reconferido:** 26/08/2026, secao 12.1 e as quatro linhas que a repetiam. A divida
mudou de forma: nao e commit faltando, e push pendente. Medido com `git ls-files`,
`git status -sb` e `git show --name-only`.
**Escopo:** ponta a ponta, do arquivo OFX no disco do dono ate o numero na tela.
**Natureza deste documento:** PRD de ESTADO, nao de intencao. Todo numero abaixo foi
medido no banco vivo, no git e na suite rodando nesta sessao. Onde algo nao foi medido,
esta escrito que nao foi.

---

## 1. Resumo executivo em dez linhas

1. A aba existe, esta publicada e tem dado real dentro: **181 lancamentos**, de
   **28/07/2026 a 26/08/2026**, soma liquida **-R$ 29,06**.
2. Foram entregues **duas fatias e meia**: Fatia 1 (captura e classificacao manual),
   Fatia 2 (regras automaticas) e **so a Task 1 de 8** da Fatia 2.1.
3. Banco: **5 tabelas**, **11 RPCs publicas**, **5 funcoes helper privadas**,
   **13 migrations aplicadas**, 1 bucket de Storage.
4. Tela: 1 aba com **4 sub-views** por chip (`Visão · Movimentos · Importar · Regras`).
5. O dono usou de verdade: importou o extrato dele, criou **5 regras**, e as regras ja
   classificaram **47 linhas sozinhas**.
6. **72% da base segue sem julgamento**: 131 de 181 movimentos sem `dominio`, somando
   **R$ 1.386,75** que, pelo invariante 18, ficam fora de todo total.re
7. Suite verde, medida agora: **885 assercoes, 0 falhas**, EXIT 0 nos 6 comandos e nas
   5 larguras. Dessas, **143 sao da aba Financeiro**.
8. Seguranca: dono-only nas 11 RPCs, RLS ligada nas 5 tabelas, zero grant para `anon`,
   zero DELETE e zero TRUNCATE para `authenticated`. `get_advisors` nao acusa nada em
   `fin_*`.
9. **Divergencia aberta:** a migration da Fatia 2.1 esta **commitada e nao empurrada**
   (commit `0fa9ed4`; local `ahead 1` de `origin/main`). O repo desta maquina ja
   descreve o banco, o remoto ainda nao. Secao 12.1.
10. **Defeito visivel:** o servidor ja devolve o abatimento e a tela **nao le**. Um numero
    da Visao encolheu R$ 131,02 sem nenhuma explicacao na tela. Secao 12.2.

---

## 2. O problema que a aba existe para resolver

A frase do dono, em cinco palavras: **"nao sei onde o dinheiro vai"**.

O contexto que torna o problema dificil, e que dita quase todo o desenho: **existe UMA
conta bancaria com dinheiro da loja e dinheiro pessoal misturados**. O extrato nao sabe
qual e qual, e nenhuma heuristica sabe. So o dono sabe.

Consequencia adotada como invariante 18 do projeto:

> Movimento sem `dominio` classificado (`empresa` / `pessoal`) nao entra em NENHUM total
> de resultado, de gasto ou de meta. Ele aparece somente como "nao classificado", com
> valor visivel, cobrando o trabalho. `dominio` nunca tem default silencioso.

Com default silencioso, o mercado do mes vira custo da loja e o lucro parece certo
estando errado. A aba prefere mostrar um placar admitidamente incompleto a mostrar um
placar completo e falso.

**Corolario, tambem invariante:** caixa (`fin_movimento`) e resultado (`venda`) sao
verdades separadas e NUNCA se somam. O Dashboard le a venda (resultado por competencia);
o Financeiro le o caixa. Sao duas abas de proposito.

---

## 3. Usuario e permissao

| Papel | Acesso ao Financeiro |
|---|---|
| Dono (`fb2aad8e-...`) | total |
| Vendedor (ex.: Brendon) | **nenhum** |

Nao ha nivel intermediario, e isso e deliberado: extrato bancario e o dado mais sensivel
do sistema. As 11 RPCs recusam com a mesma frase: `Financeiro e restrito ao dono.`

Provado na sessao anterior com o usuario real: vendedor ve **0 linhas** em `fin_movimento`
e em `fin_regra`.

---

## 4. Escopo entregue, por fatia

| Fatia | O que entrega | Estado |
|---|---|---|
| **1** (25-26/08) | schema, seed, bucket, importacao de OFX, classificacao manual, lancamento manual, painel, lista | **no ar**, commit `78be994` |
| **2** (26/08) | regras de classificacao automatica, motor unico, 4a sub-view | **no ar**, commit `9649124` |
| **2.1** (26/08) | 8 tarefas planejadas | **1 de 8 feita**, commit `0fa9ed4`, **ainda nao empurrado** |
| 3 a 6 | teto e alerta, metas e provisao, conciliacao venda x caixa, canal externo | **nao comecaram** |

---

## 5. Arquitetura ponta a ponta

O caminho completo do dinheiro, em sete passos:

```
1. Banco do dono          -> arquivo .OFX baixado no computador
2. Navegador              -> parser de OFX roda NO CLIENTE (app.js), le SGML raso
3. Tela                   -> previa obrigatoria: o dono ve antes de gravar
4. Storage (bucket extrato) -> upload do arquivo, OPCIONAL, nao aborta a importacao
5. RPC fin_importar_extrato -> dedupe por hash, insere, e JA aplica as regras
6. privado.fn_fin_aplicar_regras -> motor unico de classificacao
7. RPCs de leitura        -> fin_painel / fin_movimentos / fin_regras -> tela
```

Tres decisoes estruturais valem registro:

- **O OFX e lido no navegador, nao no servidor.** OFX 1.x e SGML raso: tag de folha
  frequentemente nao fecha (`<MEMO>texto` e valido), entao parser de XML quebra. A leitura
  e por bloco com regex tolerante. Encoding cai para `windows-1252` quando o UTF-8 devolve
  o caractere de substituicao.
- **Motor unico de classificacao.** `privado.fn_fin_aplicar_regras` serve tanto o botao
  `fin_regra_aplicar` quanto a importacao. Duas implementacoes divergiriam, e no dia em que
  divergissem a importacao classificaria diferente do botao.
- **Upload opcional, importacao obrigatoria.** Falha no upload do arquivo NAO aborta a
  importacao. Perder o extrato guardado e ruim; perder a importacao inteira e pior.

---

## 6. Modelo de dados

5 tabelas em `public`, todas com `tenant_id` e RLS (invariante 7).

### 6.1 `fin_conta` (12 colunas)

Conta bancaria ou carteira. `codigo`, `rotulo`, `banco`, `tipo`, `dominio_padrao`
(default `misto`), `ativo`, `ordem`.

**Estado: 1 conta.**

### 6.2 `fin_categoria` (12 colunas)

`codigo` (a chave, invariante 12), `rotulo` (display, editavel), `grupo`,
`natureza_esperada` (`saida` / `entrada` / `neutro`), `dominio_sugerido`, `ordem`, `ativo`.

**Estado: 33 categorias ativas, em 9 grupos.**

| Grupo | Categorias | Natureza |
|---|---|---|
| Mercadoria | 1 | saida |
| Operação | 6 | saida |
| Taxas | 3 | saida |
| Marketing | 1 | saida |
| Outros | 2 | saida |
| Casa | 3 | saida |
| Vida | 7 | saida |
| Receita | 6 | entrada |
| Neutro | 3 (`transferencia_interna`, `aplicacao`, `resgate`) | neutro |

`Neutro` existe para que RDB nao vire gasto: no extrato real ha **R$ 4.558,00 de
aplicacao** que, contada como saida, seria o maior "gasto" do mes.

### 6.3 `fin_importacao` (13 colunas)

Append-only (invariante 6). `arquivo`, `banco`, `periodo_ini`, `periodo_fim`,
`saldo_final_informado`, `linhas_lidas`, `linhas_novas`, `linhas_duplicadas`.

`authenticated` **nao tem UPDATE**: as contagens sao fechadas pela helper
`privado.fn_fin_importacao_fechar`, unica escrita permitida.

**Estado: 1 importacao.** 181 lidas, 181 novas, 0 duplicadas, em 26/08/2026 10:14 BRT.

### 6.4 `fin_movimento` (19 colunas)

O fato. `data`, `descricao`, `descricao_original`, `valor` (com sinal: saida e negativa),
`categoria_codigo`, `dominio`, `origem`, `fitid`, `hash_dedupe`, `importacao_id`,
`venda_id`, `observacao`, `arquivado_em`.

Dedupe: indice unico em `hash_dedupe` e outro em `fitid`. O hash carrega ocorrencia, entao
dois cafes identicos no mesmo dia sao possiveis, mas exigem confirmacao.

**Estado: 181 linhas, nenhuma arquivada, nenhuma manual, nenhuma ligada a venda.**

### 6.5 `fin_regra` (15 colunas)

`padrao`, `tipo_match` (`contem` / `comeca` / `exato`), `categoria_codigo`, `dominio`,
`prioridade`, `ativo`, `origem` (`manual` / `aprendida`), `aplicada_n`,
`ultima_aplicacao`, `arquivado_em`.

Duas travas de schema que valem mais que codigo:

- `check (categoria_codigo is not null or dominio is not null)` — **regra que nao
  classifica nada nao existe**, o banco recusa.
- indice unico sobre a forma NORMALIZADA do padrao — duas regras para o mesmo texto com
  acento diferente nao coexistem. A normalizacao e feita por `privado.fn_fin_norm`, que e
  `IMMUTABLE` e **nao usa a extensao `unaccent`** (nao instalada neste projeto de
  proposito); faz o servico com `upper(translate(...))`.

**Estado: 5 regras, 4 ativas, 1 arquivada.**

| Padrao | Match | Categoria | Dominio | Origem | Aplicou | Estado |
|---|---|---|---|---|---|---|
| `MUDAVENDING` | contem | `alimentacao_fora` | pessoal | aprendida | 19 | ativa |
| `uber` | contem | `transporte` | **null** | manual | 27 | **arquivada** |
| `UBER DO BRASIL TECNOLOGIA LTDA` | contem | `transporte` | pessoal | aprendida | 27 | ativa |
| `ESTRELA MAR DA FREGUES` | contem | `moradia` | null | aprendida | **0** | ativa |
| `MAR ESTRELA MATERIAL D` | contem | `moradia` | null | aprendida | 1 | ativa |

Leitura desta tabela: o dono criou `uber` amplo demais, entendeu, arquivou e refez com o
nome completo da contraparte. **O ciclo de aprendizado da Fatia 2 funcionou na pratica.**

Duas regras (`ESTRELA MAR`, `MAR ESTRELA`) tem `dominio` nulo: classificam a categoria e
deixam o dominio em aberto. Isso e legitimo pelo desenho, mas significa que essas linhas
**continuam fora de todo total** ate o dono decidir o lado. E o invariante 18 cobrando.

---

## 7. Contratos de RPC

11 RPCs publicas, todas `security invoker`, todas com `search_path` fixo, todas
dono-only. Convencao de chave de erro: **leitura devolve `msg`, escrita devolve `erro`**.

### 7.1 Leitura (3)

| RPC | Assinatura | Devolve |
|---|---|---|
| `fin_config()` | — | `{ok, contas[], categorias[]}`. Chamada UMA vez por sessao: conta e categoria sao config, nao dado do dia. **Nada de categoria, conta ou grupo chumbado no JS.** |
| `fin_painel(p_ini, p_fim, p_dominio)` | 3 datas/texto | `{ok, ini, fim, hoje, dominio, ini_anterior, fim_anterior, placar{entrou, saiu, resultado, nao_classificado_valor, nao_classificado_n}, secoes[], entradas[]}` |
| `fin_movimentos(p_ini, p_fim, p_dominio, p_status)` | 4 | lista com total e contagem |

Regras de janela, iguais nas tres: `v_hoje` vem de `now() at time zone 'America/Sao_Paulo'`
(invariante 10, nunca `CURRENT_DATE`); o fim para em HOJE no mes corrente, nunca no ultimo
dia do mes, porque comparar 25 dias contra 31 do mes anterior e a maneira mais barata de a
tela mentir; `Janela invertida.` quando `ini > fim`.

`delta_pct` e `null` quando nao havia base no periodo anterior, e a tela escreve `novo`.
Desenhar `0%` inventaria uma comparacao que nunca existiu.

### 7.2 Escrita da Fatia 1 (3)

| RPC | O que faz |
|---|---|
| `fin_importar_extrato(payload)` | valida linha a linha com o numero da linha na recusa (`Data invalida na linha 14: ...`), deduplica, insere, **aplica as regras nos recem-inseridos** e devolve quantos ja nasceram classificados e por qual regra |
| `fin_classificar(payload)` | classifica em lote. **A regra que manda e a PRESENCA da chave:** chave ausente nao mexe no campo, chave presente com `null` LIMPA |
| `fin_lancar(payload)` | lancamento manual (dinheiro vivo nao aparece no OFX). Recusa lancamento identico no mesmo dia e devolve `repetido`, com botao de confirmar |

### 7.3 Escrita da Fatia 2, regras (5)

| RPC | O que faz |
|---|---|
| `fin_regras()` | lista com `casaria_hoje` por regra e o contador de classificados. **Nao filtra por `ativo`**: filtrar esconderia a regra pausada e ela ficaria orfa na tela, viva e invisivel |
| `fin_regra_sugerir(payload)` | `{movimento_id}` -> extrai o nome da contraparte. **Nao sugere categoria nem dominio**: inferir se o Uber foi da loja ou pessoal e exatamente o que o invariante 18 proibe |
| `fin_regra_prever(payload)` | o efeito ANTES de gravar. Aceita `{id}` sozinho e herda da regra existente |
| `fin_regra_salvar(payload)` | cria (sem id) ou edita (com id). `arquivar: true` faz soft delete, **nunca DELETE** |
| `fin_regra_aplicar(payload)` | `{ids}` ausente = todas as ativas. `alcance` default `nao_classificados`; `todos` sobrescreve |

### 7.4 Helpers privadas (5)

Vivem em `privado`, invisiveis ao PostgREST (invariante 8).

`fn_fin_norm(t)` · `fn_fin_esc(p)` · `fn_fin_casa(alvo, padrao, tipo)` — as tres
`IMMUTABLE`, com `search_path` VAZIO.
`fn_fin_aplicar_regras(tenant, regra_ids, mov_ids, alcance)` — o motor unico.
`fn_fin_importacao_fechar(id, lidas, novas, dup)` — a unica `security definer` do modulo.

### 7.5 As recusas nomeadas

A tela nunca inventa texto de erro. As que o dono pode ler:

`Sessao invalida.` · `Financeiro e restrito ao dono.` · `Conta nao encontrada.` ·
`Conta desativada: reative antes de importar.` · `Nenhum lancamento no arquivo.` ·
`Data ausente na linha N.` · `Valor invalido na linha N.` · `Descricao vazia na linha N.` ·
`Caminho do arquivo fora da pasta do tenant.` ·
`Importacao recusada por duplicidade inesperada. Nada foi gravado.` ·
`Nada para mudar: informe categoria, dominio ou observacao.` ·
`Categoria desconhecida ou desativada: <codigo>` · `Dominio invalido: use empresa ou pessoal.` ·
`Informe o padrao a casar.` · `Tipo de casamento invalido: use contem, comeca ou exato.` ·
`Prioridade fora da faixa: use de 0 a 9999.` ·
`Regra arquivada: crie uma nova em vez de editar esta.`

E a que carrega o desenho inteiro:

> `Padrao generico demais: "UBER" casa 4 de 12 lancamentos (33.3%).`

**Padrao que casa mais de 60% da base e recusado com o numero na cara.** O dono pode
passar por cima com `forcar: true`, e a tela **nunca forca sozinha**.

---

## 8. A superficie da tela

Uma aba no menu lateral (grupo `Análise`, icone de carteira), com **sub-navegacao por
chip**, nao por item de menu: a barra lateral ja carrega 14 entradas e financeiro sozinho
nao pode virar 20% dela.

```
Financeiro    [ Visão ] [ Movimentos ] [ Importar ] [ Regras ]
```

### 8.1 A faixa do invariante 18

Vive **no topo das tres primeiras sub-views**, nunca num rodape que ninguem le. Declara o
que os numeros abaixo estao IGNORANDO. Diz duas coisas que a tela seria tentada a omitir:
o valor e soma COM SINAL, e **nao respeita o filtro de dominio** (sao justamente os que
nao tem lado), senao o dono trocaria para `Empresa` e acharia que o numero encolheu.

**Hoje ela diz: 131 lancamentos, R$ 1.386,75.**

### 8.2 Visão

Abre em **secao de gasto**, nao em lista. Lista responde "o que aconteceu"; a pergunta do
dono e "para onde foi".

- placar (`entrou`, `saiu`, `resultado`)
- secoes por grupo, cada uma com suas categorias, `pct`, `delta_pct`, `n`
- barra de **magnitude**, um tom so (`--dim`, mede 5.43 contra `--surface`), nunca colorida
  por categoria (ja reprovado duas vezes neste projeto). Fatia visivel minima de 2%
- categoria em `<details>`, e nao toggle proprio: abre por teclado de graca, e o
  `diag_mobile` abre toda gaveta antes de medir

### 8.3 Movimentos

Onde o dado vira classificado. **Selecao em lote** nao e conforto: com 50 a 150
lancamentos por mes, classificar um a um e trabalho abandonado na segunda semana.

Toda linha oferece criar regra, e **o formulario abre DENTRO da linha**. A regra nasce de
um lancamento real, nunca de um formulario vazio: abrir um cadastro de regras para depois
inventar padroes de cabeca e o caminho que ninguem percorre.

Filtro `nao_classificados`: o servidor ignora o filtro de dominio, e **a tela diz isso**,
em vez de deixar o seletor de `Empresa` parecendo aceso e sem efeito.

### 8.4 Importar

Arrastar ou escolher arquivo. Parser no navegador, **previa obrigatoria** antes de gravar.
Depois da importacao, a tela declara quantos ja nasceram classificados **e por qual regra**
(a unica prova visivel de que criar regra valeu).

### 8.5 Regras

Vazia, **nao mostra "criar regra"**: ensina que se comeca pela linha do movimento.

- previa obrigatoria, e **ela expira**: mexer na regra depois da previa tranca o botao de
  gravar de novo
- conflito (linha que casa mais de uma regra) aparece em `--morno`, nunca `--erro`:
  ambiguidade cobra trabalho, nao e falha de sistema
- sobrescrever exige confirmacao **com o numero**: `Sobrescrever os 1`, nunca um sim
  generico. Depois de rodar, a tela DECLARA que sobrescreveu
- `aplicar todas` manda payload **VAZIO**. `ids: []` e erro no servidor, nunca "todas"
- toda linha de regra carrega **icone** (trilho sem icone e regressao)

### 8.6 Cor

Zero token novo. Sao **9 grupos financeiros** contra **7 tokens de trilho medidos**, e a
colisao e ASSUMIDA e nomeada: `Marketing` e `Vida` dividem matiz, e quem os separa e o
icone (megafone x xicara), escolhidos por serem os mais distantes entre si e por viverem
em lados opostos do dominio.

`Sem categoria` NAO e trilho: e ESTADO, e usa `--morno`. Nunca `--erro` — gasto sem
categoria e trabalho que falta, nao falha de sistema.

Grupo desconhecido nao vira buraco: cai no hash deterministico do `codigo` com icone
generico.

---

## 9. Seguranca, medida hoje

| Item | Medido |
|---|---|
| RLS | ligada nas 5 tabelas |
| Policies | `fin_conta` e `fin_categoria`: so SELECT. `fin_importacao`: SELECT + INSERT. `fin_movimento` e `fin_regra`: SELECT + INSERT + UPDATE |
| Grant `anon` | **zero em todas as 5** |
| Grant `PUBLIC` | **zero** |
| DELETE / TRUNCATE para `authenticated` | **zero** (invariante 9) |
| `security definer` no modulo | **1 sozinha** (`fn_fin_importacao_fechar`), privada |
| `search_path` | fixo em todas as 11 RPCs; VAZIO nas 3 helpers de casamento |
| `get_advisors` (security) | **0 achado em `fin_*`** |
| Bucket `extrato` | privado, teto de 10 MB |
| Path do arquivo | prefixado com `tenant_id`, recusa fora da pasta |

Os 3 avisos que o `get_advisors` devolve hoje sao de **fora do modulo**
(`registrar_venda`, `remover_nf`, protecao de senha vazada no Auth).

---

## 10. Provas, rodadas nesta sessao

EXIT CODE conferido, nao texto de saida.

```
python ferramentas/validar.py          EXIT 0
python ferramentas/harness.py          EXIT 0    885 passou, 0 falhou
python ferramentas/prova_trilho.py     EXIT 0
python ferramentas/prova_grafico.py    EXIT 0
python ferramentas/prova_atmosfera.py  EXIT 0
node --check public/app.js             EXIT 0
python ferramentas/diag_mobile.py 360  EXIT 0
                                 390   EXIT 0
                                 414   EXIT 0
                                 1280  EXIT 0
                                 1440  EXIT 0
```

Das 885 assercoes, **143 sao do Financeiro**: 87 com prefixo `fin:` (Fatia 1) e 56 com
prefixo `fin2:` (Fatia 2). **A Fatia 2.1 nao acrescentou assercao nenhuma**, o que e
coerente com ela ter mexido so no servidor.

---

## 11. O estado real do dado, hoje

### 11.1 Volume

| | |
|---|---|
| Movimentos | **181** (0 arquivados, 0 manuais, 0 ligados a venda) |
| Janela | 28/07/2026 a 26/08/2026 |
| Soma com sinal | **-R$ 29,06** |
| Entradas brutas | R$ 39.795,40 |
| Saidas brutas | -R$ 39.824,46 |
| Importacoes | 1 |
| Contas | 1 |
| Categorias | 33, em 9 grupos |
| Regras | 5 (4 ativas) |
| Arquivo no bucket | 1, 53.676 bytes, dono como owner |

### 11.2 O julgamento, que e o que falta

| | n | % |
|---|---|---|
| Sem `categoria_codigo` | **128** | 70,7% |
| Sem `dominio` | **131** | 72,4% |
| Classificados nos dois campos | **49** | 27,1% |

**R$ 1.386,75 estao fora de todo total** por falta de `dominio`.

### 11.3 O que ja foi classificado

| Categoria | Bruto gasto | Devolvido | Liquido | n |
|---|---|---|---|---|
| `Alimentação fora` | R$ 518,08 | — | R$ 518,08 | 19 |
| `Transporte` | R$ 624,95 | **R$ 131,02** | **R$ 493,93** | 27 |
| `Moradia` | R$ 219,00 | — | R$ 219,00 | 3 |
| `Motoboy` | — | — | — | 1 |
| `Outro (pessoal)` | — | — | — | 2 |

Caixa por dominio: **empresa -R$ 20,00**, **pessoal -R$ 1.395,81**.

Vale ler esse `-R$ 20,00` com atencao: a loja aparece com vinte reais de movimento num
mes de R$ 39.795,40 de entradas. Nao e o resultado da loja, e **a medida de quanto do
extrato ainda nao foi julgado**. E exatamente o que o invariante 18 promete: nao mentir.

---

## 12. Divergencias e divida aberta

Esta secao e o motivo de o documento existir. As duas primeiras sao de hoje.

### 12.1 O commit existe, o remoto nao tem (aberta)

**Reconferido depois de esta secao ser escrita, no mesmo dia.** O que ela descrevia mudou
de forma, e a versao antiga dela ficaria aqui como divida que nao existe mais: **nao e
mais falta de commit, e falta de push.**

Os quatro arquivos que esta secao listava como sem versionar, medidos um a um com
`git ls-files --error-unmatch`:

| Arquivo | Antes | Agora |
|---|---|---|
| `supabase/migrations/20260826_fin_fatia21_painel_abatimento.sql` | untracked | **versionado**, commit `0fa9ed4` |
| `docs/superpowers/specs/2026-08-26-financeiro-fatia21-design.md` | untracked | **versionado**, commit `0fa9ed4` |
| `docs/superpowers/plans/2026-08-26-financeiro-fatia21.md` | untracked | **versionado**, commit `0fa9ed4` |
| `docs/superpowers/plans/2026-08-19-segundo-lojista-tenant.md` | untracked | **segue untracked**, divida propria |

Sobra um degrau so, e ele e real:

```
$ git status -sb
## main...origin/main [ahead 1]

$ git rev-parse --short HEAD origin/main
0fa9ed4    <- tem a migration da Fatia 2.1
9649124    <- nao tem
```

Entao a frase "quem restaurar o repo do zero reconstroi um `fin_painel` **com o defeito do
reembolso de volta**" **continua verdadeira, mas so a partir do REMOTO**. Restaurar desta
maquina reconstroi certo. E o remoto e exatamente o que sobrevive a perda da maquina, que
e o unico cenario para o qual backup existe. O pipeline diz que **git e a fonte da
verdade**; hoje a fonte da verdade e um disco so.

O que **nao** e consequencia disso: `0fa9ed4` nao tocou nenhum arquivo em `public/`
(conferido com `git show --name-only`), entao o app publicado **nao** esta atrasado por
causa dele. O deploy da Cloudflare dispara no push, e nao ha frontend neste commit para
subir. O defeito de tela da 12.2 continua de pe pelo motivo dela, nao por este.

**Custo de fechar: `git push origin main`.**

### 12.2 O servidor conserta e a tela nao conta (grave)

A Task 1 da Fatia 2.1 mudou `fin_painel` para tratar entrada em categoria de gasto como
**abatimento**, nao como receita. O calculo esta certo: `Transporte` caiu de R$ 624,95
para R$ 493,93, e os R$ 131,02 de reembolso do Uber sairam do bloco de entradas.

O `fin_painel` passou a devolver `bruto` e `abatido` por categoria, exatamente para a tela
poder escrever a nota que a spec exige:

```
Transporte        R$ 493,93
                  624,95 gastos menos 131,02 devolvidos · 27 linhas
```

**`app.js` nao contem uma unica ocorrencia de `abatido`.** Medido. A Task 6 (a nota do
abatimento e o selo de `devolução`) e da Fatia 2.1 e nao foi feita.

Efeito pratico: **um numero da Visao mudou sozinho R$ 131,02 e a tela nao explica por que.**
Para o dono, que estava olhando 624,95 ontem, isso le como a tela ter passado a errar.
Numero que muda sem explicacao gasta a confianca que a aba inteira depende de ter.

### 12.3 A Fatia 2.1 esta 1/8 feita

O plano em `docs/superpowers/plans/2026-08-26-financeiro-fatia21.md` tem 8 tarefas:

| # | Tarefa | Estado |
|---|---|---|
| 1 | Abatimento derivado no `fin_painel` | **feita**, commit `0fa9ed4` (nao empurrado) |
| 2 | Procedencia gravada (`regra_id` em `fin_movimento`) | nao |
| 3 | As tres categorias pedidas (`iFood`, obra da casa, obra da loja) | nao |
| 4 | `fin_categoria_salvar` | nao |
| 5 | `fin_movimentos` com filtro de categoria e procedencia | nao |
| 6 | Tela: a nota do abatimento e o selo de devolucao | nao |
| 7 | Tela: o detalhe da categoria | nao |
| 8 | Tela: `+ Nova categoria` | nao |

Confirmado no banco: **nao existe categoria `ifood` nem `obra`**, e **nao existe a coluna
`regra_id`** nem a RPC `fin_categoria_salvar`.

### 12.4 Nao ha caminho para criar categoria

Tres bloqueios independentes, todos medidos:

1. nao existe RPC de escrita de categoria;
2. `fin_categoria` nao tem policy de INSERT (so `fin_categoria_sel`);
3. `authenticated` tem **so SELECT** em `fin_categoria`.

O pedido do dono (`crie categorias de ifood, obra`) segue sem atendimento, e hoje so se
resolve por migration.

### 12.5 Nao ha caminho para remover ou arquivar um movimento errado

`fin_movimento.arquivado_em` **existe como coluna** e e usada como filtro em toda leitura.
**Nada nunca escreve nela.** Verificado: o unico `set arquivado_em` do modulo esta em
`fin_regra`, nao em `fin_movimento`. E nao ha DELETE para `authenticated`.

Ou seja: **um lancamento errado que entre na base nao tem como sair.** Metade da queixa
original do dono ("nao tendo onde corrigir a entrada equivocada vista") foi respondida
pelo abatimento; esta metade nao foi, e nao esta em nenhuma das 8 tarefas do plano 2.1.

### 12.6 O saldo do extrato e guardado e nunca conferido

`saldo_final_informado` recebe o `LEDGERBAL` do OFX e **nenhuma RPC compara com a soma dos
movimentos**. E justamente a conferencia que pega importacao incompleta. Herdado do v67,
ainda aberto, e barato de fechar.

### 12.7 Categoria que zerou some da secao

Parar de gastar tambem e um fato, e a Visao nao o mostra. Herdado, ainda aberto.

### 12.8 Duas regras ativas sem `dominio`

`ESTRELA MAR DA FREGUES` e `MAR ESTRELA MATERIAL D` classificam categoria e deixam o
dominio em aberto. Legitimo, mas as linhas que elas pegam continuam fora de todo total. A
tela hoje nao chama atencao para "regra que classifica pela metade".

Alem disso, `ESTRELA MAR DA FREGUES` esta com **`aplicada_n = 0`**: foi criada e nunca
pegou nada. Vale conferir se e padrao errado ou se a regra irma ja tinha levado as linhas.

---

## 13. Roadmap declarado e nao construido

| Fatia | Assunto | Nota |
|---|---|---|
| 3 | teto e alerta | desenho previsto: `fin_teto` e limite (seguranca), `fin_meta` e alvo; a confirmar |
| 4 | metas e provisao | — |
| 5 | conciliacao venda x caixa | `fin_movimento.venda_id` ja existe e esta 100% nulo: o gancho esta pronto e nao foi usado |
| 6 | canal externo de alerta | **bloqueado por decisao, nao por codigo.** O dono pediu WhatsApp; a Cloud API exige numero dedicado que sai do celular, e nao pode ser o numero de venda. Recomendacao segue sendo PWA push |

---

## 14. A leitura de uma frase so

**A aba esta construida, provada e no ar; o commit que faltava ja existe e o que falta e
um `git push`; e o produto esta esperando julgamento humano em 72% da propria base.**
O gargalo hoje nao e capacidade de software, e as 131 linhas que so o dono pode decidir
se sao da loja ou da casa.
