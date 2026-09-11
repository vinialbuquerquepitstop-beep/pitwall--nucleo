# Handoff — Calculadora como produto, v12

Data: 11/09/2026. Linha `calculadora`. **Topo da linha.** Substitui o v11, da mesma
sessao. Tudo abaixo foi medido nesta sessao.

Nota de linguagem: prosa sem acento, sem cedilha, sem travessao. Valores reais do
sistema aparecem exatos.

---

## 0. Leia nesta ordem

1. `CLAUDE.md`.
2. `docs/calculadora/PROCESSO.md`.
3. Este arquivo, e principalmente a secao 7 (**o que esta quebrado hoje**).
4. O plano, item `2.4a` e as decisoes **D16, D17 e D18**.

---

## 1. O que esta fatia entregou

**O verbo `criar`.** Ate aqui o dono so sabia dizer "isto e outro nome de uma coisa
que ja existe" (`apontar`) e "isto nunca e preco" (`descartar`). Fornecedor novo e
modelo novo so nasciam por migration, ou seja, **so com o dono do produto do outro
lado**. No dia 1 de um cliente todo fornecedor e desconhecido: sem `criar`, o
produto nao existe, existe um servico.

| | Antes | Depois |
|---|---|---|
| fornecedor novo | so por migration | um clique, com **todas as grafias iguais** da lista viram apelido de uma vez |
| fornecedor parecido com um que ja existe | nao havia caminho | pergunta com as duas grafias lado a lado; nao cria e **nao une** |
| modelo novo | so por migration | entra com **uma** pergunta obrigatoria: a categoria (ela decide a margem) |
| o que se aprende | sem rastro | `origem` / `carga_id` / `criado_por` em 5 tabelas |
| assercoes da prova | 89 | **106** |

Saiu tambem a **D17**, decidida pelo dono nesta sessao, que nao estava no plano: ela
apareceu porque a prova do `criar` a encontrou.

**Nada de tela.** Esta fatia e de banco. A tela `Alimentar` segue esperando, e agora
com tres obrigacoes novas (secao 6).

### As quatro migrations, na ordem

| Version | Arquivo | O que |
|---|---|---|
| `20260911135930` | `20260911_calc_catalogo_criar.sql` | o verbo `criar`, a guarda de quase-igual, as 15 colunas de origem, a releitura extraida |
| `20260911164835` | `20260911_calc_parse_pergunta_de_fornecedor_fica.sql` | D17 (a), primeira parte: o leitor recebe as perguntas abertas |
| `20260911183244` | `20260911_calc_d17_pergunta_ignorada_fica.sql` | `forn_aberto` antes de `forn` (**nao consertou**, ver secao 4) e o conserto do `criar` sobre pergunta ignorada |
| `20260911184409` | `20260911_calc_d17_forn_aberto_sem_fornecedor.sql` | o conserto de verdade: cabecalho que e pergunta nao tem fornecedor |

### Tres coisas que a execucao contradisse a spec, e as tres por medicao

1. **A releitura nao podia ser duplicada.** A spec pedia uma RPC separada, o que
   repetiria as ~90 linhas de cauda do `calc_pendencia_resolver` (G2, G3, remontagem
   do blob, refresco do resumo, pendencia nova). Duas copias bastaria UMA divergir
   para a cobertura passar a depender do VERBO usado, sem aparecer em contagem
   nenhuma. Saiu para `privado.calc_reprocessar`, uma copia, chamada pelos dois. Os
   10 trechos movidos foram conferidos byte a byte contra o corpo VIVO antes de
   aplicar, e as 89 assercoes anteriores sao o que prova que a extracao nao mudou
   comportamento.
2. **`codigo` nao e hash, e slug.** O catalogo vivo usa slug legivel (`mp_imports`,
   `airpods_4_anc`). Hash faria metade dele ilegivel, e o `codigo` e o que aparece
   em apelido e em pendencia. Continua deterministico e continua sendo o `codigo`,
   nunca o rotulo (invariante 12).
3. **`cor` nao se cria, e e recusa declarada.** Medido: o leitor **nunca** devolve
   pendencia de `tipo = 'cor'`; cor desconhecida cai em duvidoso junto com a linha.
   Criar cor seria caminho sem chamador e sem prova, que e o que este projeto ja
   paga com o parser v1. `condicao` tambem recusa, por outro motivo (D14: a
   resposta vale so para aquela lista, verbo `definir`).

---

## 2. A decisao do dono nesta sessao (D17)

**Opcao (a).** Resposta citada exata: *"a"*. **A pergunta de fornecedor ja feita
fica de pe: uma resposta nunca faz outra pergunta aberta (ou ignorada) da mesma
carga sumir.**

O que ela nao cobre, **por escolha consciente dele**: o caso do mes seguinte, com
fornecedor NOVO logo depois de um conhecido na PRIMEIRA leitura. Ali a D10 segue
valendo e o alarme da D13 e a unica defesa. A opcao (b), que fecharia isso, foi
recusada porque cria pergunta falsa em lista longa dividida em varias mensagens, e
so da para calibrar com lista real dele.

---

## 3. O defeito que a prova do `criar` encontrou (e virou a D17)

Medido em 11/09, classe **PRECO ERRADO**. No dia 1 cada cabecalho vira pergunta (4
na fixture E). Criar o PRIMEIRO fazia a D10 engolir os de baixo:

| | Antes de responder | Depois de criar o primeiro |
|---|---|---|
| perguntas de fornecedor na leitura | 4 | 1 |
| casou | 0 | 4 (1 do MP + 3 do XPTO) |
| precos do XPTO | fora | **na tabela, no nome do MP** |
| o que avisava | | so `fornecedor_conferir.suspeita_alta` |

A cobertura SUBIA, entao nenhuma guarda de queda pegaria. **Nao nasceu com o
`criar`:** `apontar` a primeira pergunta ja fazia o mesmo desde a 2.4a zero. O
`criar` so tornou o dia 1 o caminho normal ate ele.

---

## 4. As duas licoes de metodo desta sessao, e as duas custaram

**1. Aplicar e so depois provar custou uma migration que declara um conserto que
nao aconteceu.** A `20260911183244` pos `forn_aberto` antes de `forn` e a Torre
tratou isso como conserto. Mas o `case` so escreve o ROTULO `papel`: o fornecedor
da linha vem de `h.forn`, calculado pelo casamento por NOME, que nao olha o papel.
O `base` mediu ao aplicar e o blob saiu com o mesmo 4.100. A assercao K13 tinha
passado por **acaso de dado** (naquele caso o cabecalho nao casava nome nenhum,
entao `h.forn` ja era nulo). A migration seguinte, de UMA linha, foi pre-provada
dentro de um bloco desfeito ANTES de aplicar, e so entao aplicada.
**Regra que fica: mudanca de leitor que pode mexer em PRECO se prova antes de
aplicar, com o `create` dentro de um bloco que se desfaz e a fumaca do caso que
motivou.**

**2. Prova verde nao e contrato cumprido quando a amostra e mais estreita que a
frase.** A `bandeira` reprovou DUAS vezes com tudo verde (104 de 104, depois 106 de
106), porque comparou o comportamento com o TEXTO decidido pelo dono, nao com a
amostra que a prova escolheu. As duas vezes ela estava certa, e as duas achou
preco no nome errado. A K14 prometia o caso geral no comentario e testava um caso.

---

## 5. Prova

`ferramentas/prova_calc_parse.sql`, md5 `23d462b2c43dcbf5820265189a6ccd96`, 121035
bytes, **106 assercoes**, rodada pela `bandeira` com o md5 conferido DENTRO do
banco:

```
PASSOU: 106 assercoes, 0 falhas
  fixture A (formato linha), v2: lidas=18 casou=13 duvidoso=4 nao_reconhecido=1 descarte=2 cobertura=72.2%
  fixture B (formato bloco), v2: lidas=12 casou=11 duvidoso=0 nao_reconhecido=1 cobertura=91.7%
  fixture B (formato bloco), v1: casou=0 de 12 (o v1 nao le bloco, por desenho)
  fixture C (dia 1), v2: lidas=4 casou=0 pendencias=condicao "junior", fornecedor "TABELA XPTO IMPORTS"
  fixture D (condicao), v2: lidas=16 casou=11 perguntas de condicao=5
  resolver: 6 respostas aceitas (todas ensinaram), 15 recusadas com motivo declarado, 0 aceitas caladas
  respostas de condicao (D14): fixture C casou 0 -> 2 com "junior" = Lacrado; fixture D 11 -> 16 de 16 com as 5 respondidas
  fixture E (dia 1, criar), v2: lidas=5 casou=0 pendencias=5
  verbo criar (2.4a): XPTO = 1 fornecedor + 3 apelidos num clique; MP Distribuidora recusado por quase-igual ao MP Imports; JBL Flip 7 so entra com a categoria; tudo com origem=aprendizado
  D17 (a): criar o 1o fornecedor da fixture E fica em casou 1 (era 4): as 3 perguntas do XPTO seguem de pe, e nenhum preco dele entra no nome do MP; a mensagem IGNORADA nao volta pelo nome do fornecedor criado por outra grafia
```

Limpeza medida ANTES e DEPOIS, igual dos dois lados: cargas 0, pendencias 0,
aliases do tenant 61, modelos do tenant 125, fornecedores 17, `so_na_semente_prova`
0, **zero** linhas com `origem = 'aprendizado'` nas cinco tabelas, 40 regras, e o
md5 de `calc_dados` inalterado (`885afa28...`).

**A secao K, em uma linha cada:** K0 a fixture E le como medido; K1 um clique = 1
fornecedor + 3 apelidos com origem; K2 quase-igual recusa; K3 confirmando, cria;
K4 nome que ja existe manda `apontar`; K5/K6 modelo sem categoria ou com categoria
inventada e recusa; K7 com categoria o modelo entra; K8 condicao nao se cria; K9
carga fora de rascunho recusa; K10 a lista de categorias do codigo bate com o
check; K11 ACL; K12 o resolver tambem carimba origem; K13/K14 a D17 contra o
fornecedor de cima; K15 a D17 contra um NOME reconhecido; K16 `criar` sobre a
propria pergunta ignorada.

### O que melhorou no metodo da prova

- **A forma enxuta.** O arquivo passou de 116 KB e nao cabia numa chamada. Um
  script tira SO o que nao executa (comentario inteiro, comentario de fim de linha
  e indentacao, **somente fora de string**: ha `E'...'` que atravessam linha e
  comecam com espacos, e essas nao se tocam), provando a equivalencia (mesmo numero
  de assercoes, mesmos literais, mesmo codigo). O md5 conferido dentro do banco
  passa a ser o do texto enxuto.
- **Cuidado medido:** md5 por BLOCO so serve se os cortes forem feitos pelo mesmo
  script dos dois lados. Cortes diferentes fazem o diagnostico reclamar a toa
  mesmo com o total certo.
- Tres notas da `bandeira` entraram na prova: a K11 aceitava ACL **nula** como
  segura (ACL nula quer dizer EXECUTE para PUBLIC; agora e igualdade estrita); a K2
  contava "nada gravado" DEPOIS do rollback, o que passa por construcao; e o
  comentario do `criar` citava uma assercao pelo nome errado.

---

## 6. Estado vivo, medido em 11/09/2026

| Funcao | md5 | len |
|---|---|---|
| `privado.calc_parse_v2(uuid, text, jsonb, text[])` | `85c430fa9540b653298c85ab5ab5ce6f` | 36324 |
| `public.calc_catalogo_criar(uuid, text, jsonb)` | `cf70594b319b96b7ba313ddab4782af9` | 8579 |
| `privado.calc_reprocessar(uuid, uuid, text, text, text, boolean, text)` | `85c66ad95414f1386a394ba4e6a4bfb3` | 5485 |
| `public.calc_pendencia_resolver` | `de4e22624b4028bf13f2ddca55382267` | 6468 |
| `privado.calc_nucleo(text)` | `9e9545726257a1bd3a877852cf9495c4` | 716 |
| `public.calc_carga_abrir` (intocada) | `6a1176e94c4b5117e3bb0b3ca9ff3b76` | 3957 |
| `privado.calc_parse` (v1, intocado) | `f74503007e8e373ce2997b54c249c84c` | 19746 |

- ACL: as tres de `privado` sem grant nenhum (`{postgres=X/postgres}`), **e e
  desenho**; `calc_catalogo_criar` para `authenticated` e `service_role`, sem
  `anon`. Sem sobrecarga de `calc_*` em lugar nenhum.
- `calc_pendencia_decisao_ck`: `apontar`, `descartar`, `ignorar`, `definir`,
  `criar`.
- **Advisors de seguranca: 9**, sem entrante. O nono e `calc_catalogo_criar`
  (`SECURITY DEFINER` + grant a `authenticated`, com a barreira de papel no CORPO):
  consequencia declarada do desenho, nao achado. **O `PROCESSO.md` ainda descreve
  essa composicao errado** (fala em quatro `calc_*`; sao seis).
- Restricao global 10 conferida: 10 FKs de `calc_*`, todas para `tenant` ou
  `calc_carga`. As 15 colunas novas **nao** criaram FK: `carga_id` e uuid solto de
  proposito, pelo mesmo motivo de `calc_carga.aprovado_por` (proveniencia nao pode
  sumir quando a carga sumir).

### Tres obrigacoes novas para a tela `Alimentar`

1. **D16, por extenso:** o botao de descartar fornecedor diz *"nunca mais ler preco
   deste fornecedor, em nenhuma lista"*, com `ignorar` (so nesta lista) ao lado.
2. **A pergunta ignorada volta em TODA releitura**, com o mesmo texto, e a linha em
   `calc_pendencia` continua dizendo `ignorar` (nao duplica, `on conflict do
   nothing`). A tela tem que ler a decisao GRAVADA, e nao tratar como aberta toda
   pergunta que aparece na leitura. E a armadilha da secao 6 do v11, agora com caso
   concreto.
3. **`n_linhas` da pendencia fica congelado** no valor da primeira insercao: a
   tabela pode dizer x1 enquanto a leitura diz x2.

---

## 7. O QUE ESTA QUEBRADO HOJE (leia antes de construir a tela)

**A `bandeira` REPROVOU esta fatia, com as 106 assercoes verdes**, e o motivo esta
no plano como **D18**. Resumo: **o `descartar` de fornecedor nao descarta, e o que
ele deveria tirar entra no nome do fornecedor de cima.** A regra e gravada com
`lower()`, mas o leitor casa contra `calc_norm()`: cabecalho com acento, com `*` ou
com espaco duplo nunca casa (`n_descarte` 0 e o bloco e absorvido), formato bloco
tambem falha, e um padrao curto sem ancora casa a linha de OUTRO fornecedor e faz a
pergunta dele sumir. Quatro formas de cabecalho, tres quebradas, e a R14 passava
porque a fixture usa a unica que funciona.

**Mesma causa, e este esta no ar desde o Bloco 1:** as regras de descarte da
SEMENTE com acento (`réplica`, `genérico`, `peça não genuína`) **nunca casaram**.
Preco de replica entra como aparelho e, pelo fator de outlier 1.6, pode expulsar da
tabela o preco real de outro fornecedor.

Isso **nao e regressao desta fatia** (vem da 2.4a bis e do Bloco 1), e por isso a
fatia foi commitada: o que esta no banco ja estava no banco, e o repositorio nao
pode discordar dele. Mas **e a proxima fatia, antes da tela.**

## 8. O que NAO foi provado

- **Isolamento contra vendedor e contra tenant errado**, exceto no `criar`: a
  barreira de papel dele foi provada (vendedor recusado, `sub` inexistente com
  claims forjadas recusado). O resto da matriz da secao G segue rodando so com o
  `sub` do dono. Pendencia desde o v9.
- **Nenhuma lista real do mes.** Todas as fixtures sao sinteticas (restricao 8).
- **O efeito de outlier do defeito da semente** (item 7) nao foi medido.
- Suite de frontend: nada em `public/` mudou.

---

## 9. O proximo passo

| # | Item | Trava | Peso |
|---|---|---|---|
| 1 | **D18: o `descartar`** (3 propriedades no plano, uma assercao por vetor 13 a 18) | a tela, e preco errado hoje | media |
| 2 | A tela `Alimentar` (com as tres obrigacoes da secao 6) | o portao do Bloco 2 | grande |
| 3 | Isolamento vendedor/tenant na secao G | passe de seguranca | pequeno |
| 4 | `2.4b` dialeto do fornecedor, `2.4c` a aba do que aprendeu | | media |
| 5 | Derrubar o v1 | o portao do Bloco 2 | pequeno |

O portao do Bloco 2 continua o mesmo: **o dono roda a carga do mes pela tela,
sozinho, sem Claude Code** (D7).

---

## 10. O que continua verdade

- Invariante 17; restricao 8 (fixtures sinteticas, precos inventados).
- As funcoes de `privado` sem grant e DESENHO.
- Nao criar FK de `calc_*` para tabela de operacao.
- Nao deixar linha nao entendida virar preco, nem sumir.
- `create or replace` PRESERVA dono e ACL; quem reseta e `DROP` + `CREATE`.
- **Um padrao gravado tem que estar na MESMA normalizacao do texto contra o qual
  ele casa.** `lower()` contra `calc_norm()` falha calado, e e a mesma familia do
  `\b` que era backspace e do `calc()` com sinal colado.
