# Handoff — Calculadora como produto, v10

Data: 11/09/2026. Linha `calculadora`. **Topo da linha.** Substitui o v9, que e da
MESMA sessao e continua valendo para a 2.4a bis (as guardas do resolver).

Escrito para uma sessao comecando **fria**. Tudo abaixo foi medido nesta sessao.

Nota de linguagem: prosa sem acento, sem cedilha, sem travessao. Valores reais do
sistema aparecem exatos.

---

## 0. Leia nesta ordem

1. `CLAUDE.md` (a regra de ACL do `create or replace` foi CORRIGIDA hoje, ver 6).
2. `docs/calculadora/PROCESSO.md`.
3. Este arquivo.
4. O v9, secoes 2 a 4: as guardas do resolver e por que existem.
5. O plano, secao 2.4 e as decisoes **D14 e D15** (logo depois da D7).

---

## 1. O que esta sessao fez, somando o v9

| Commit | O que |
|---|---|
| `94293e9` | 2.4a bis: o resolver recusa resposta que nao ensina (v9) |
| `b58f33b` | handoff v9 |
| `e10a22d`, `c88277f`, `1867931` | D14 (e a revisao dela) e D15 registradas |
| `b82563d` | **`2.4a zero`: o leitor v2 novo e a prova com a fixture D e a secao Z** |

**Nada de tela.** O `2.4a zero` e de banco. A tela `Alimentar` segue esperando a 2.4.

---

## 2. As decisoes do dono nesta sessao (D14 e D15)

Registro completo no plano. Em uma linha cada:

- **D14 revisada:** linha sem condicao **pergunta**, uma vez por fornecedor, por
  lista, com a resposta da lista anterior pre-selecionada como sugestao. A primeira
  resposta dele (*"a"*, padrao silencioso) CAIU minutos depois: *"na verdade,
  pergunte quando nao houver condição descrita"*. "O perfil desempata, nunca
  decide" segue sem excecao.
- **D15, a regra da condicao:** vale a da linha; linha sem condicao herda a ULTIMA
  declarada daquele fornecedor (banner, cabecalho de bloco, cabecalho de fornecedor
  ou linha de modelo); **inclusive dentro de secao com banner** (`SEMINOVOS`, depois
  uma linha `lacrado`: as de baixo sao Lacrado), **decisao consciente contra a
  recomendacao**; titulo misto (`LACRADOS E SEMINOVOS`) nao herda e linha sem
  condicao sob ele pergunta; `CPO` com `Lacrado` e `CPO`; `Seminovo` junto de outra
  condicao pergunta; fornecedor novo zera.

A regra de heranca veio do dono, pela experiencia de lista real: *"muitas vezes, a
lista inicia com a condição e o restante dos modelos segue sem condição
acompanhando"*.

---

## 3. O `2.4a zero`, medido

Migration `supabase/migrations/20260911_calc_parse_condicao_e_cabecalho.sql`
(version `20260911073053`). **Gerada por script** a partir do corpo vivo do v2
(`20260910_calc_parse_cor_pareada.sql`, conferido por md5 antes), com 11 trocas que
tinham que achar o trecho exatamente uma vez. Script de record:
`gera_24a_zero.py` no scratchpad da sessao, e o que ele faz esta descrito no
cabecalho da migration. Mesma assinatura `(uuid, text)`.

**1. O fornecedor desconhecido chega a pendencia.** Antes do primeiro fornecedor
reconhecido, a pendencia traz a primeira linha de cabecalho da MENSAGEM do WhatsApp
(os mesmos dois carimbos que `calc_limpar` remove). A fixture C passou de
`(sem cabecalho antes da lista)` para `fornecedor "TABELA XPTO IMPORTS"`, e **ensinar
esse fornecedor passou a funcionar** (assercao Z2: apontar para um fornecedor
existente e aceito e a pendencia some). Era o bloqueador do `criar`.

**2. A condicao segue a D15.** Na fixture D:

| | v2 anterior | v2 novo |
|---|---|---|
| casou | 11 de 16 | 11 de 16 |
| precos errados calados | **3** (o misto do Cristiano e a linha da Raposa entravam como Lacrado) | 0 |
| perguntas de condicao | 1 para a carga inteira, Rafael e Dg misturados | 5: uma por fornecedor sem condicao, uma por linha ambigua |

**O numero de cobertura e o MESMO, e por isso ele sozinho nao prova nada.** Z3 a Z8
cobram o conteudo produto a produto.

**3. A pergunta de condicao mudou de chave.** O `texto` da pendencia `condicao` agora
e: o `codigo` do fornecedor (sem condicao nenhuma acima), ou `modelo / linha` (titulo
misto ou linha mista). As tres causas tem frase propria em `causa`. A sentinela
`sem condicao declarada` nao existe mais.

### Prova

`ferramentas/prova_calc_parse.sql`, rodada pela `bandeira`, arquivo inteiro do disco
(68360 bytes, md5 `cc8b074bb80e3c9d227ed68952961300`, conferido tambem DENTRO do
banco antes de rodar, e e o md5 do blob commitado em `b82563d`):

```
PASSOU: 75 assercoes, 0 falhas
  fixture A (formato linha), v2: lidas=18 casou=13 duvidoso=4 nao_reconhecido=1 descarte=2 cobertura=72.2%
  fixture B (formato bloco), v2: lidas=12 casou=11 duvidoso=0 nao_reconhecido=1 cobertura=91.7%
  fixture B (formato bloco), v1: casou=0 de 12 (o v1 nao le bloco, por desenho)
  fixture C (dia 1), v2: lidas=4 casou=0 pendencias=condicao "junior", fornecedor "TABELA XPTO IMPORTS"
  fixture D (condicao), v2: lidas=16 casou=11 perguntas de condicao=5
  resolver: 6 respostas aceitas (todas ensinaram), 15 recusadas com motivo declarado, 0 aceitas caladas
```

Limpeza depois: `cargas=0, pendencias=0, aliases_tenant=61, semente_prova=0,
regras_aprendidas=0`.

**O resolver deu 6 aceitas, e a Torre tinha passado 5 como esperado.** A sexta e
`fornecedor "TABELA XPTO IMPORTS" / descartar`, e o erro foi do ESPERADO, nao do
leitor (secao 4). A `bandeira` recusou reapontar o numero por conta propria, que e o
certo. Os dois numeros (6 / 15) sao os de record agora.

---

## 4. A decisao que o `2.4a zero` abriu, e ela e do dono

Com o texto real do cabecalho, **`descartar` numa pendencia de fornecedor passou a
funcionar**, e o que ele faz e forte. Medido pela `bandeira`:

```
grava   calc_regra: tipo=descarte, padrao='tabela xpto imports', prioridade=100
efeito  a linha do cabecalho vira `aviso`, e o aviso descarta o BLOCO INTEIRO
        abaixo dele, nesta carga e em TODA carga futura com esse cabecalho
```

As linhas vao para `n_descarte`, CONTADAS, nao somem: nao e perda silenciosa. E e
exatamente o que a spec 4.1 diz que `descartar` significa ("isso nunca e preco, nem
agora nem depois"). Mas um clique, sem desfazer (a 2.4c ainda nao existe), apaga um
fornecedor inteiro de todas as listas seguintes.

**Recomendacao da Torre:** manter o comportamento, porque ele e o verbo funcionando,
e a tela dizer por extenso *"nunca mais ler preco deste fornecedor, em nenhuma
lista"*, com `ignorar` (so nesta lista) ao lado. Alternativa: o resolver recusar
`descartar` em pendencia de fornecedor. **Decidir antes de desenhar a tela.**

Divida registrada: nenhuma assercao NOMEIA essa combinacao. Se ela virar recusada, a
prova segue verde e so o numero da mensagem muda. Entra junto com a decisao.

---

## 5. Estado vivo, medido em 11/09/2026

Contagens: **125, 40, 17, 0, 61** (modelos semente, aliases semente, fornecedores,
cargas, aliases do tenant). Orfaos de `calc_alias`: 0, 0, 0.

| Funcao | md5 | len |
|---|---|---|
| `privado.calc_parse_v2` | `e4b7f4ad8ecd66edc784ba8d43a7fbc8` | 32745 |
| `privado.calc_parse` (v1, intocado) | `f74503007e8e373ce2997b54c249c84c` | 19746 |
| `public.calc_carga_abrir` | `6a1176e94c4b5117e3bb0b3ca9ff3b76` | 3957 |
| `public.calc_pendencia_resolver` | `aa8efe9920f12c61207f4b161a4a1177` | 8066 |

ACL do v2: `{postgres=X/postgres}`, igual a antes. Sem sobrecarga em `privado` nem em
`public`. As duas RPCs no v2. **Advisors: 8**, sem entrante.

---

## 6. Armadilhas medidas nesta fatia

**`create or replace function` NAO reseta a ACL.** O `CLAUDE.md` dizia que sim, e o
`base` mediu o contrario no v2 (ACL identica antes e depois), que e o que a
documentacao do Postgres diz. Quem reseta e `DROP` + `CREATE`. O `CLAUDE.md` foi
corrigido; a regra de refazer REVOKE/GRANT fica, por ser gratis e cobrir o `drop`.
**Isso importa JA na proxima fatia**, que muda a assinatura do v2 e portanto e `drop`
e `create`: ali a ACL SOME de verdade, e a E3 da prova so olha `public`.

**O MCP apaga coluna de nome repetido.** `execute_sql` devolve JSON, e colunas sem
alias com o mesmo nome (`count`, `?column?`) viram a mesma chave: a ultima
sobrescreve as outras, calada. O `base` recebeu so a ultima coluna de duas
verificacoes antes de perceber. **Alias em toda coluna de consulta por MCP.**

**Esperado de prova se deriva combinacao por combinacao, nunca por delta.** Pela
SEGUNDA vez nesta sessao a Torre passou um numero errado a `bandeira` (63 no lugar de
66, e depois 5 no lugar de 6). Nas duas ela pegou. O delta do `2.4a zero` foi pensado
como "+1 aceita, o apontar"; eram +2, porque o mesmo texto real que faz o `apontar`
ensinar faz o `descartar` ensinar tambem.

**Cobertura igual nao e leitura igual.** A fixture D casa 11 de 16 antes e depois, e
antes tinha tres precos errados. Teto numerico e so a ultima assercao, nunca a unica.

**Gerar corpo de funcao grande por troca conferida.** O v2 tem 32 KB. Transcrever a
mao arriscaria acento, emoji e barra invertida (as tres ja custaram caro aqui). O
script parte do arquivo que BATE com o banco por md5, exige cada trecho uma vez so e
imprime o md5 novo, que o `base` conferiu no banco depois.

---

## 7. O que NAO foi provado

- **A regra da condicao numa lista REAL.** Efeito ja nomeado na migration: dois
  apelidos do `fmata` carregam condicao no proprio texto (`IPHONE NEW LACRADO NA
  CAIXA`, `SWAP GRADE A / IPHONE STOCK (VITRINE)`), entao linha sem condicao sob
  eles passa a herdar Lacrado ou Seminovo. Vetor: rodar `privado.calc_parse_v2` na
  lista do mes, antes de a tela existir, e comparar com a leitura manual.
- **Isolamento das RPCs contra vendedor e tenant errado**, igual ao v9.
- **O cabecalho candidato fora do formato WhatsApp.** Sem carimbo, a "mensagem" e o
  texto inteiro, e o candidato e a primeira linha de cabecalho da lista. Lista colada
  de dois fornecedores desconhecidos SEM carimbo cai toda no primeiro. Nao ha fixture.
- Suite de frontend: nada em `public/` mudou.

---

## 8. O proximo passo

| # | Item | Trava | Peso |
|---|---|---|---|
| 1 | **Decisao do dono: `descartar` fornecedor** (secao 4) | a tela | conversa |
| 2 | **O leitor recebe as respostas de condicao** (D14): verbo novo no resolver (`decisao` tem check: DDL), argumento novo no v2 (`drop` e `create`: ACL e sobrecarga a mao) | a pergunta de condicao virar resposta | medio |
| 3 | `2.4a` `criar` (`calc_catalogo_criar`), `ter` quase-igual, `quater` origem | a tela | o grosso |
| 4 | A tela `Alimentar` | o portao do Bloco 2 | grande |
| 5 | Isolamento vendedor/tenant na secao G; assercao nomeando `fornecedor/descartar` | nada | pequeno |
| 6 | Derrubar o v1 | o portao do Bloco 2 | pequeno |

O portao do Bloco 2 continua o mesmo: **o dono roda a carga do mes pela tela,
sozinho, sem Claude Code** (D7).

---

## 9. O que continua verdade

- Invariante 17; restricao 8 (fixtures C e D sinteticas, precos inventados).
- `privado.calc_parse_v2` sem grant para `authenticated` e DESENHO.
- Nao criar FK de `calc_*` para tabela de operacao.
- Nao deixar linha nao entendida virar preco, nem sumir. **E condicao que nao esta
  clara tambem nao vira preco: vira pergunta** (D14/D15).
