# PRD - Aba Financeiro (Pit Wall 2.0), estado atual

**Data da medicao:** 02/09/2026
**Reconferido:** 02/09/2026, contra o banco vivo (`fin_movimento`, `fin_categoria`,
`fin_regra`, `information_schema`, `pg_policies`) e contra o remoto real
(`git fetch github main`). Substitui a medicao de 26/08/2026, que descrevia uma base de
181 lancamentos e duas dividas que hoje estao fechadas (12.1 e 12.2).
**Escopo:** ponta a ponta, do arquivo OFX no disco do dono ate o numero na tela.
**Natureza deste documento:** PRD de ESTADO, nao de intencao. Todo numero abaixo foi
medido no banco vivo, no git e na suite rodando. Onde algo nao foi medido, esta escrito
que nao foi.

---

## 1. Resumo executivo em dez linhas

1. A aba existe, esta publicada e tem dado real dentro: **1.132 lancamentos**, de
   **01/02/2026 a 31/08/2026**, **2 importacoes**, R$ 444.820,68 de valor bruto.
   Em 26/08 eram 181 lancamentos de um mes so.
2. Foram entregues **tres fatias e meia**: Fatia 1 (captura e classificacao manual),
   Fatia 2 (regras automaticas), **so a Task 1 de 8 da Fatia 2.1**, e a **Fatia 3**
   (cobertura, repasse em par, devolucao abatida, faixa de entrada e saida).
3. Banco: **5 tabelas**, **14 RPCs publicas** (eram 11; a Fatia 3 acrescentou
   `fin_cobertura`, `fin_repasse_marcar` e `fin_repasse_desmarcar`), 5 helpers privadas,
   **22 migrations `fin_` versionadas**, 1 bucket de Storage.
4. Tela: 1 aba com **4 sub-views** por chip (`Visão · Movimentos · Importar · Regras`).
5. O dono usou de verdade: importou dois extratos, criou **5 regras**, e as regras ja
   classificaram centenas de linhas sozinhas (181 linhas so em `Transporte`).
6. **O gargalo e o julgamento, e ele PIOROU com a segunda importacao.** Pela conta do F3
   (tem `dominio`, ou tem categoria de natureza `neutro`), a base inteira esta
   **4,22% julgada em VALOR**; agosto sozinho, **9,36%**. Sao **858 linhas pendentes** e
   **R$ 426.070,20** fora de todo total, pelo invariante 18.
7. Suite verde, medida em 01/09/2026 em 12 corridas seguidas, todas EXIT 0: **997 linhas
   impressas** (contador `passou`), **1002 rotulos declarados**, **997 rotulos distintos
   executados**, 0 nao executaram, EXIT 0 nos 6 comandos e nas 5 larguras. Dessas,
   **223 sao da aba Financeiro** (87 `fin:`, 56 `fin2:`, 80 `fin3:`). Medicao de record:
   `docs/handoffs/handoff_financeiro_pitwall_v11.md`.
8. Seguranca: dono-only nas RPCs, RLS ligada nas 5 tabelas, zero grant para `anon`, zero
   DELETE e zero TRUNCATE para `authenticated`. `get_advisors` nao acusa nada em `fin_*`.
9. **A divergencia de git FECHOU.** `HEAD`, `github/main` e o app publicado estao no
   mesmo commit `a3e7e7c`: 0 a frente, 0 atras, working tree limpa. Secao 12.1.
10. **O defeito visivel da 12.2 FECHOU**: a tela le `abatido` e escreve a nota da
    devolucao (commit `51226d2`). O que sobra de defeito e o da secao 12.3 em diante.

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
| **2.1** (26/08) | 8 tarefas planejadas | **1 de 8 feita**, commit `0fa9ed4`. A Task 6 (nota do abatimento na tela) veio depois, por fora do plano 2.1, no commit `51226d2` |
| **3** (31/08 a 01/09) | `fin_cobertura` e o estado degradado (a tela recusa numero economico sobre base incompleta), repasse so em par com defesa no servidor, desmarcar par, nao classificado dos dois lados, devolucao abatida com nota, faixa mostrando entrada e saida | **no ar**, commits `15ab208` `46fa983` `a702501` `c02fbfb` `1f25394` `51226d2` `33676f3` |
| 4 | metas e provisao | **nao comecou** |
| 5 | conciliacao venda x caixa | **nao comecou.** Proxima entrega escolhida pelo dono (secao 13) |
| 6 | canal externo de alerta | **nao comecou**, e bloqueado por decisao, nao por codigo |

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

### 6.2 `fin_categoria` (13 colunas)

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

### 6.4 `fin_movimento` (20 colunas)

O fato. `data`, `descricao`, `descricao_original`, `valor` (com sinal: saida e negativa),
`categoria_codigo`, `dominio`, `origem`, `fitid`, `hash_dedupe`, `importacao_id`,
`venda_id`, `observacao`, `arquivado_em`, e **`repasse_id`** (Fatia 3: o par de
repasse, que so existe aos pares e nao entra em receita nem em despesa).

Dedupe: indice unico em `hash_dedupe` e outro em `fitid`. O hash carrega ocorrencia, entao
dois cafes identicos no mesmo dia sao possiveis, mas exigem confirmacao.

**Estado em 02/09/2026: 1.132 linhas, nenhuma arquivada, nenhuma manual, nenhuma
ligada a venda, 2 em par de repasse.**

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

**14 RPCs publicas** (eram 11 ate a Fatia 2.1), todas `security invoker`, todas com
`search_path` fixo, todas dono-only. Convencao de chave de erro: **leitura devolve `msg`, escrita devolve `erro`**.

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

### 7.4 Leitura e escrita da Fatia 3 (3)

| RPC | O que faz |
|---|---|
| `fin_cobertura(payload)` | a conta do F3 na janela: bruto, julgado, pendente, `pct_julgado`, e o recorte por dominio. E o que a tela le no **estado degradado**, quando se recusa a desenhar numero economico. Implementacao unica em `privado.fn_fin_cobertura`, a mesma que o `fin_painel` passou a usar |
| `fin_repasse_marcar(payload)` | marca duas linhas como o mesmo dinheiro entrando e saindo. **So aceita PAR**, e a defesa vive no servidor: valor oposto, janela que atravessa a virada do mes, e recusa nomeada quando nao casa |
| `fin_repasse_desmarcar(payload)` | desfaz o par, e devolve quantos lancamentos voltaram para a conta normal |

### 7.5 Helpers privadas (5)

Vivem em `privado`, invisiveis ao PostgREST (invariante 8).

`fn_fin_norm(t)` · `fn_fin_esc(p)` · `fn_fin_casa(alvo, padrao, tipo)` — as tres
`IMMUTABLE`, com `search_path` VAZIO.
`fn_fin_aplicar_regras(tenant, regra_ids, mov_ids, alcance)` — o motor unico.
`fn_fin_importacao_fechar(id, lidas, novas, dup)` — a unica `security definer` do modulo.

### 7.6 As recusas nomeadas

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

Desde a v9 ela mostra **quanto entrou e quanto saiu separados**, nao a diferenca: uma
entrada de 4.800 e uma saida de -4.800 se cancelavam e a faixa declarava quase zero de
trabalho com duas linhas esperando julgamento.

**Na base inteira ela cobraria hoje 860 lancamentos e R$ 435.670,20.** Na janela de
agosto, 118 linhas e R$ 65.146,43.

Acima dela, desde a Fatia 3, existe o **estado degradado**: com a cobertura abaixo do
piso do F3, no lugar do placar a tela escreve `base incompleta: X% julgado · faltam
R$ Y em N lançamentos`. Hoje esse e o estado normal da aba, porque a cobertura esta em
4,22%.

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
| `search_path` | fixo em todas as 14 RPCs; VAZIO nas 3 helpers de casamento |
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
python ferramentas/harness.py          EXIT 0    997 passou, 0 falhou
                                                 1002 declaradas, 997 executadas, 0 nao executaram
                                                 (medido em 01/09/2026, 12 corridas)
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

Das 997 linhas impressas (medicao de 01/09/2026), **223 sao do Financeiro**: 87 com
prefixo `fin:` (Fatia 1), 56 com `fin2:` (Fatia 2) e 80 com `fin3:` (Fatia 3).
**A Fatia 2.1 nao acrescentou assercao nenhuma**, o que e coerente com ela ter mexido
so no servidor. Ate 01/09 este paragrafo dizia 885 e 143, de 26/08, antes da Fatia 3.
Outras 2 assercoes usam `suite:` e provam a propria ferramenta, nao o Financeiro.

---

## 11. O estado real do dado, hoje

Medido em 02/09/2026, ignorando arquivados (nao ha nenhum).

### 11.1 Volume

| | |
|---|---|
| Movimentos | **1.132** (0 arquivados, 0 manuais, **0 ligados a venda**) |
| Janela | **01/02/2026 a 31/08/2026** |
| Valor bruto | **R$ 444.820,68** |
| Importacoes | **2** |
| Contas | 1 |
| Categorias | **34** |
| Regras | 5 |
| Movimentos em par de repasse | **2** (R$ 9.600,00 brutos, soma zero, natureza `neutro`) |
| Vendas registradas na aba Vendas | **14** |

### 11.2 O julgamento, que e o que falta

Conta do F3, a mesma de `privado.fn_fin_cobertura`: JULGADO e ter `dominio` **ou** ter
categoria de natureza `neutro`.

| Janela | Linhas | Bruto | % julgado em VALOR | Linhas pendentes | Valor pendente |
|---|---|---|---|---|---|
| base inteira | 1.132 | R$ 444.820,68 | **4,22%** | **858** | **R$ 426.070,20** |
| agosto/2026 | 175 | R$ 71.877,01 | **9,36%** | 118 | R$ 65.146,43 |

Por contagem de linha o numero parece melhor (272 de 1.132 com `dominio`, 24%), e **e por
isso que a conta do F3 e em valor**: as linhas grandes sao justamente as que ninguem
julgou.

**O alvo do medidor semanal do `PLANO.md` e 95% do valor bruto.** Estamos a 90 pontos
dele. A segunda importacao afundou o indicador em termos absolutos: em 31/08, antes dela,
a mesma conta dava 2,11% sobre 181 linhas; hoje da 4,22% sobre 1.132, com seis vezes mais
trabalho humano pendente.

### 11.3 O que ja foi classificado

Por dominio:

| Dominio | n | Bruto | Com sinal |
|---|---|---|---|
| `pessoal` | 271 | R$ 9.130,48 | -R$ 7.433,28 |
| `empresa` | **1** | R$ 20,00 | -R$ 20,00 |
| **sem dominio** | **860** | **R$ 435.670,20** | +R$ 7.135,02 |

Por categoria (so as que tem linha):

| Categoria | n | Bruto | Com sinal |
|---|---|---|---|
| `Transporte` | 181 | R$ 6.414,00 | -R$ 4.716,80 |
| `Alimentação fora` | 87 | R$ 2.332,68 | -R$ 2.332,68 |
| `Repasse` | 2 | R$ 9.600,00 | R$ 0,00 |
| `Moradia` | 8 | R$ 554,00 | -R$ 554,00 |
| `Outro (pessoal)` | 2 | R$ 106,98 | -R$ 106,98 |
| `Motoboy` | 1 | R$ 55,00 | -R$ 55,00 |
| **sem categoria** | **851** | - | - |

Vale ler o `empresa` com atencao: **a loja aparece com UM movimento de vinte reais** numa
base de R$ 444.820,68. Nao e o resultado da loja, e a medida de quanto do extrato ainda
nao foi julgado. E exatamente o que o invariante 18 promete: nao mentir.

A diferenca entre `Transporte` bruto (R$ 6.414,00) e com sinal (-R$ 4.716,80) e o
abatimento de devolucao que a Fatia 2.1 introduziu e que a tela hoje explica.

---

## 12. Divergencias e divida aberta

As duas primeiras estao FECHADAS e ficam registradas com a prova de fechamento, porque
divida que some sem registro volta.

### 12.1 O commit existe, o remoto nao tem, FECHADA em 02/09/2026

O push saiu. Medido hoje com `git fetch github main`:

```
HEAD        a3e7e7c
github/main a3e7e7c
a frente: 0 · atras: 0 · working tree limpa (--untracked-files=all)
```

Nota de armadilha, que continua valendo: o remoto `origin` desta maquina aponta para
`http://local_proxy@127.0.0.1:41729/...`, que esta **morto**, e o ref local `origin/main`
esta congelado em `08dfcb9` de 21/07/2026. Quem comparar contra `origin` vai ver 200
commits de atraso que nao existem. **O remoto real e `github`.**

### 12.2 O servidor conserta e a tela nao conta, FECHADA

A tela passou a ler `abatido` e a escrever a nota da devolucao (commit `51226d2`, handoff
v8). Medido em `public/app.js`: 4 ocorrencias de `abatido`, 22 de `devolv`.

### 12.3 A Fatia 2.1 esta 1/8 feita (2/8 contando a Task 6 fora de ordem)

| # | Tarefa | Estado |
|---|---|---|
| 1 | Abatimento derivado no `fin_painel` | **feita**, `0fa9ed4` |
| 2 | Procedencia gravada (`regra_id` em `fin_movimento`) | **nao.** Coluna nao existe, medido hoje |
| 3 | As tres categorias pedidas (`iFood`, obra da casa, obra da loja) | **nao.** Zero categoria com `ifood` ou `obra` no codigo |
| 4 | `fin_categoria_salvar` | **nao.** RPC nao existe |
| 5 | `fin_movimentos` com filtro de categoria e procedencia | nao |
| 6 | Tela: a nota do abatimento e o selo de devolucao | **feita** por fora, `51226d2` |
| 7 | Tela: o detalhe da categoria | nao |
| 8 | Tela: `+ Nova categoria` | nao |

### 12.4 Nao ha caminho para criar categoria (aberta)

Os tres bloqueios de 26/08 seguem identicos, remedidos hoje:

1. nao existe RPC de escrita de categoria (`fin_categoria_salvar` = 0);
2. `fin_categoria` nao tem policy de INSERT (0 em `pg_policies`);
3. `authenticated` nao tem grant de INSERT em `fin_categoria` (0).

O pedido do dono (`crie categorias de ifood, obra`) segue sem atendimento, e hoje so se
resolve por migration. **Custa caro agora**: com 851 linhas sem categoria para julgar, a
falta de vocabulario e parte do gargalo da secao 11.2.

### 12.5 Nao ha caminho para remover ou arquivar um movimento errado (aberta)

`fin_movimento.arquivado_em` existe e e usada como filtro em toda leitura, inclusive na
conta do F3. **Nada nunca escreve nela**: o unico `set arquivado_em` do modulo esta em
`fin_regra`. Nao ha DELETE para `authenticated`. Um lancamento errado que entre na base
nao tem como sair.

### 12.6 O saldo do extrato e guardado e nunca conferido (aberta)

`saldo_final_informado` recebe o `LEDGERBAL` do OFX e nenhuma RPC compara com a soma dos
movimentos. **Com duas importacoes na base, essa conferencia deixou de ser barata de
adiar**: e ela que pega importacao incompleta ou linha duplicada entre os dois arquivos.

### 12.7 Categoria que zerou some da secao (aberta)

Parar de gastar tambem e um fato, e a Visao nao o mostra.

### 12.8 Duas regras ativas sem `dominio` (aberta)

Remedido hoje: **2 regras ativas com `dominio` nulo**. Classificam categoria e deixam o
dominio em aberto, entao as linhas que elas pegam continuam fora de todo total. A tela nao
chama atencao para "regra que classifica pela metade".

### 12.9 `fin_movimento.venda_id`, o decimo campo orfao (aberta)

Existe desde a Fatia 1, com FK e indice parcial, e e devolvido pela RPC `fin_movimentos`
desde entao. **Nao tem um unico leitor na aba Financeiro.** Medido hoje: **0 de 1.132
movimentos com `venda_id` preenchido**, contra **14 vendas** registradas. E o gancho da
Fatia 5, pronto e nunca usado.

### 12.10 Divida da ferramenta, herdada do handoff v11 (aberta)

1. **Flake `DOM: 0 chars`**, 1 em 10 medido em 01/09, sempre na primeira corrida da
   sessao, sem diagnostico.
2. **O extrator da trava conta `ok()` escrito dentro de COMENTARIO**, e reprova a suite
   sem defeito nenhum no produto.
3. **63 sitios de `finQ(...).click()` ou `.value =` sem guarda de espera**, todos no bloco
   do Financeiro. So os 3 da previa do OFX foram protegidos.
4. **Migrations aplicadas contra versionadas: 167 contra 35.** Dessas 138 de diferenca,
   **ZERO sao do perimetro `fin_`**: os 129 objetos `fin_` vivos sao reconstruiveis a
   partir de `supabase/migrations/`. 6 arquivos tem nome divergente do nome gravado no
   banco, entao comparacao por nome de arquivo da falso positivo.

### 12.11 A aba abre no mes corrente, que hoje esta vazio (aberta, achada em 02/09/2026)

`function finMes(){return FIN_MES||l().slice(0,7)}` e `FIN_MES` nasce `""` a cada
carga: nao ha persistencia. Como o ultimo movimento da base e **31/08/2026**, quem abrir
a aba hoje cai em **setembro/2026 com zero linha** e precisa clicar para tras uma vez
para ver qualquer coisa. Nao e defeito de calculo, e de primeira impressao: a aba mais
nova do sistema abre em branco no dia 1 de todo mes, ate a primeira importacao do mes
entrar.

---

## 13. Roadmap declarado e nao construido

| Fatia | Assunto | Nota |
|---|---|---|
| 4 | metas e provisao | `fin_provisao`, `fin_meta`, meta reversa. **Barrada pelo F3 enquanto a cobertura estiver em 4%**: meta sobre base nao julgada e numero economico inventado |
| **5** | **conciliacao venda x caixa** | **e a proxima entrega, ja escolhida pelo dono.** Sao duas frases, e a segunda depende da primeira: (a) `a linha do extrato mostra a qual venda ela pertence, e o dono liga e desliga esse vinculo na propria linha` (mata o orfao da 12.9); (b) `o sistema propoe quais entradas casam com quais vendas, e o dono aprova em lote`. Nenhuma das duas soma caixa com resultado, pelo corolario do Inv. 18. **Ressalva:** vinculo linha a linha NAO esbarra no F3; qualquer TOTAL de "recebido de vendas" esbarra |
| 6 | canal externo de alerta | **bloqueado por decisao, nao por codigo.** O dono pediu WhatsApp; a Cloud API exige numero dedicado que sai do celular, e nao pode ser o numero de venda. Recomendacao segue sendo PWA push |

Fora do roadmap de fatia, e competindo com ele por prioridade: **o julgamento da base**
(secao 11.2) e as dividas 12.4, 12.5 e 12.6, que sao justamente as ferramentas de julgar.
Construir a Fatia 4 antes de julgar a base entrega uma tela que o proprio F3 vai recusar a
desenhar.

---

## 14. A leitura de uma frase so

**A aba esta construida, provada, no ar e sincronizada com o remoto; o que falta nao e
software, e julgamento: 858 linhas e R$ 426.070,20, ou 95,8% do valor bruto, ainda nao
tem dominio, e por isso a aba se recusa (corretamente) a desenhar numero economico.**
A segunda importacao multiplicou a base por seis e o trabalho humano por seis junto. A
proxima entrega escolhida (Fatia 5, conciliacao venda x caixa) cabe porque vinculo linha a
linha nao depende de cobertura; qualquer total dela depende.
