# Handoff calculadora Pit Wall v13 — o `descartar` que descarta (D18)

11/09/2026. Substitui o `handoff_calculadora_pitwall_v12.md`, que continua valendo
para tudo que nao e a D18.

Linguagem: prosa sem acento, sem cedilha, sem travessao (convencao do `CLAUDE.md`).
Valores reais do sistema aparecem com os caracteres exatos.

---

## 1. Arranque: ler nesta ordem

1. `CLAUDE.md`.
2. `docs/calculadora/PROCESSO.md` — **mudou nesta sessao**: a baseline de advisors
   (era sete, sao NOVE) e a secao **5.4**, nova, com as duas regras que esta fatia
   comprovou.
3. `docs/superpowers/specs/2026-09-10-aprendizado-de-fornecedor.md`, secao 4.1.
4. O plano, decisao **D18** (fechada aqui) e a secao 7 do v12.
5. Este arquivo.

---

## 2. O que esta fatia entregou

**O `descartar` de fornecedor passou a descartar.** Ate hoje ele gravava uma regra
que nunca casava, e o bloco que deveria sair da lista ia inteiro para o nome do
fornecedor de CIMA, com preco e tudo. Classe PRECO ERRADO.

A causa era UMA: a regra era gravada com `lower(texto)` e o leitor casa o padrao
contra `privado.calc_norm(linha)`. **Padrao numa normalizacao, texto em outra:
nunca casa, e a falha e CALADA.** Mesma familia do `\b` que era backspace e do
`calc()` com sinal colado.

### 2.1 Os quatro vetores, medidos no codigo VIVO antes do conserto

Fixture sintetica, precos inventados (restricao global 8). `Alfa Imports` e criado
no comeco, e e ele que da aos cabecalhos de baixo um fornecedor RECONHECIDO acima
para ser engolido.

| Vetor | O que o dono clica | O que acontecia |
|---|---|---|
| 13 | descartar `Fábrica Zeta` (acento) | grava `padrao="fábrica zeta"`, `descarte=0`, e o **3.100 entra no blob como produto do Alfa Imports** |
| 15 | descartar `*Fabrica  Zeta*` | idem: o `*` e o espaco duplo somem no `calc_norm` e nao no `lower` |
| 16 | descartar `Fabrica Zeta`, formato BLOCO | o padrao casa, mas o cabecalho de modelo corta o descarte: `descarte=0` |
| 17 | descartar `PROMO` | grava `promo` sem ancora e **apaga o 5.400 do Alfa Imports**, que so tinha a palavra na linha |
| 14 | ASCII em formato linha | funciona, e era o unico da prova (a R14) |

### 2.2 O conserto, em quatro pecas

1. **`calc_regra.escopo`** (`linha` | `fornecedor`) carrega o ALCANCE do descarte.
   Descarte de linha (a semente, `caixa aberta`) continua linha a linha.
2. **O papel `forn_descartado`** no leitor, que vem ANTES de `forn` e de
   `forn_aberto` no `case` (mesma licao da D17: papel novo depois de `forn` e so
   rotulo, porque `h.forn` vem do casamento por NOME). Ele fecha o bloco do
   fornecedor de cima e manda tudo para `n_descarte` ate o proximo cabecalho de
   fornecedor. **Cabecalho de modelo no meio nao interrompe mais**, que era o
   vetor 16.
3. **A ancora sai da MEDIDA contra a propria lista, nao do tipo da pergunta.**
   Conta-se, com a mesma cadeia do leitor (`calc_norm(calc_limpar(linha))`),
   quantas linhas o texto IGUALA, quantas ele COMECA e em quantas ele APARECE:

   | Medida | Padrao gravado | Quem cai aqui |
   |---|---|---|
   | iguala a linha inteira | `^texto$` | cabecalho de fornecedor, `PROMO` |
   | so comeca a linha | `^texto` | pergunta de modelo (o texto e a linha sem o preco do fim) |
   | aparece dentro | `\ytexto\y` | pergunta de cor (`verde menta`) |
   | nao aparece | RECUSA, com mensagem | pergunta cujo texto nao e da lista |

   A ORDEM e a defesa do vetor 17: `PROMO` iguala a linha do cabecalho, entao vira
   `^promo$` e nao casa mais `- 5.400 PROMO` de outro fornecedor. Se a forma de
   dentro viesse antes, o preco alheio voltava a sumir.
   `\y` e fronteira de palavra em Postgres; `\b` e BACKSPACE e falha calado.
4. **As cinco regras de semente com acento** regravadas na normalizacao do leitor.

### 2.3 Duas guardas novas

- **G4: `descartar` tem que aumentar `n_descarte`.** E o achado mais caro da
  fatia: **a G3 ("a resposta tem que ensinar") NAO pega esta classe.** Quando o
  descarte falha, as linhas sao ABSORVIDAS pelo fornecedor de cima e a pendencia
  some da leitura do mesmo jeito. Ensinar e engolir sao indistinguiveis para a G3,
  e foi exatamente assim que a D18 viveu com a prova verde.
- **T5: pergunta de `preco` nao se descarta.** O texto dela e um MOTIVO por
  construcao (`preco com condicao pendurada: a calc nao tem onde guardar
  condicao`), nunca um pedaco da lista. A mensagem diz o caminho: `ignorar`.

---

## 3. O erro que eu cometi no meio, e quem pegou

A primeira migration fez a T5 recusar **`cor` tambem**. Estava errado: descartar
uma pergunta de cor era uma resposta que FUNCIONAVA. O texto (`verde menta`) esta
dentro da linha do preco, a regra casa essa linha e a pendencia some de verdade.
Estreitar o verbo teria tirado do dono uma resposta PERMANENTE, deixando so o
`ignorar`, que vale para uma lista.

Quem pegou foi a assercao **G6** da prova, *"o que ensinava continua ensinando"*,
que existe so para isso. A segunda migration desfez o estreitamento.

**A licao nao e sobre cor: guarda nova se mede contra o que ja funcionava, nao so
contra o defeito que ela quer fechar.**

---

## 4. As duas migrations

| Version | Arquivo | O que faz |
|---|---|---|
| `20260911200343` | `20260911_calc_d18_descartar_descarta.sql` | `calc_regra.escopo`, o papel `forn_descartado` (7 trocas no leitor), o padrao normalizado e ancorado, T5, G4, as 5 regras de semente |
| `20260911233727` | `20260911_calc_d18_ancora_por_medida.sql` | a ancora passa a sair da MEDIDA (3 formas), e a T5 encolhe para `preco` |

Corpos vivos, conferidos por md5 depois de aplicar:

| Funcao | md5 | len |
|---|---|---|
| `privado.calc_parse_v2` | `b4a400617275d972bda2a68d0c7d2669` | 37892 |
| `privado.calc_reprocessar` | `abf5e10c1fd46d44b178ad21f5c39f01` | 5838 |
| `public.calc_pendencia_resolver` | `456d9bc97d532235f8bc8c7445f51b2a` | 12101 |

`privado.calc_reprocessar` mudou uma coisa so: devolve `n_descarte`, para a G4
poder comparar (a carga ja foi sobrescrita quando ele retorna, entao o numero de
antes tem que ser lido ANTES da chamada).

---

## 5. Tres correcoes ao que o v12 e o plano afirmavam

1. **`réplica` (900) e `genérico` (950) estao `ativo = false` por DECISAO do dono**
   (17/08/2026). O preco de replica entrar **nao era** so o defeito de
   normalizacao, e nao e esta fatia que muda isso: e interruptor. As regras ATIVAS
   que falhavam calado eram `peça não genuína`, `somente para mídia` (dentro de
   uma regra ativa) e `à vista` / `só hoje` (na de pendencia). As cinco foram
   regravadas, as duas desligadas inclusive, para o defeito nao voltar no dia em
   que o interruptor subir.
2. **`1ª linha` nunca esteve quebrada**: o `ª` sobrevive ao `calc_norm` (medido).
3. **A baseline de advisors e NOVE, nao sete.** Seis sao `calc_*`
   (`calc_carga_abrir`, `calc_carga_aprovar`, `calc_carga_descartar`,
   `calc_catalogo_criar`, `calc_config_margem_salvar`, `calc_pendencia_resolver`),
   mais `registrar_venda`, `remover_nf` e o leaked password. O `PROCESSO.md` dizia
   sete, e o erro custou uma ida e volta nesta propria fatia: o prompt do `base`
   saiu com o numero velho e ele teve que reportar "9, e nenhum entrante" como
   divergencia. Corrigido no PROCESSO.

---

## 6. Metodo: as duas regras que esta fatia comprovou (PROCESSO 5.4)

**Medir o defeito no codigo VIVO antes de consertar.** A fixture obvia (cabecalho
descartado sem fornecedor conhecido acima) **nao reproduzia o defeito**: a G3
pegava sozinha e devolvia "esta resposta nao ensina nada". O preco errado so
aparece quando existe um fornecedor RECONHECIDO acima para absorver o bloco. Quem
escreve a assercao sem medir antes escreve uma assercao que passa com o defeito no
ar, que foi exatamente o que aconteceu com a R14.

**Pre-provar dentro de bloco revertido ANTES de aplicar.** A receita que funcionou,
em UMA chamada de `execute_sql`:

```
migration sem o cabecalho e sem o `commit;`
  + guarda de md5 dos corpos gravados (pega erro de transcricao)
  + o bloco de prova
  + `raise exception`
```

Tudo volta, e a mensagem diz se o conserto conserta. Duas coisas que o tamanho
cobra: o payload tem que caber em UMA chamada (quebrar em duas aplica a primeira
metade e mata o rollback), e para caber vale tirar comentario **fora de string**
por script (`enxuga_sql.py`, no scratchpad), nunca a mao.

**Nota de padrao, medida pelo `base`:** os arquivos desta linha abrem com `begin;`
e fecham com `commit;` para poderem ser colados no SQL Editor, mas o
`apply_migration` ja e transacional e o `commit;` do corpo fecha a transacao
externa antes do fim da chamada. Entao **nao ha nada depois do `commit;`**.

---

## 7. A prova

**`PASSOU: 113 assercoes, 0 falhas`** (eram 106 antes desta fatia). Rodada pela
`bandeira` em 12/09/2026, uma tentativa, e o bloco de sumario verbatim:

```
PASSOU: 113 assercoes, 0 falhas
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
  D18: descartar fornecedor tira o BLOCO nas quatro formas de cabecalho (acento, asterisco e espaco duplo, formato bloco, ASCII em linha), e o padrao ancorado nao come mais a linha `- 5.400 PROMO` do fornecedor de cima; as 5 regras de semente com acento foram regravadas na normalizacao do leitor
```

**O numero que conta a fatia inteira esta na linha do resolver: `6 respostas
aceitas` (eram 4).** Duas combinacoes que antes eram RECUSADAS passaram a ensinar,
e sao justamente descartes de fornecedor: a regra que nunca casava fazia a G3
recusar a resposta ("nao ensina nada"), ou pior, aceita-la porque o bloco tinha
sido engolido. Com o padrao na normalizacao certa elas ensinam de verdade.

Producao intacta depois da rodada, medida ANTES e DEPOIS: 0 cargas, 0 pendencias,
0 linhas com `origem = 'aprendizado'` nas cinco tabelas. A `bandeira` acrescentou
duas sondas por conta propria, e as duas deram 0: o modelo de semente
`so_na_semente_prova` (que nasce com `tenant_id` nulo, fora do filtro de tenant) e
os quatro padroes ancorados que a D18 grava. O rollback foi total, nao parcial.

`get_advisors(security)`: **9**, os nove da baseline, nomes conferidos um a um.
Zero entrante.

### 7.0 O que entrou na prova

`ferramentas/prova_calc_parse.sql` ganhou a secao **L** e a fixture **F**.

- **L13, L15, L16, L17**: um laco de quatro voltas. Cada volta abre a fixture F do
  zero, cria o `Alfa Imports` e descarta UM dos quatro cabecalhos, dentro da
  propria subtransacao. Cobram as tres propriedades JUNTAS, e o `Alfa Imports` com
  EXATAMENTE dois produtos e o que prova as duas pontas do erro de preco: nada de
  outro fornecedor entra no nome dele, e nada que e dele some.
- **L18**: as cinco regras de semente casam a propria linha.
- **L18b**: a regra GERAL, e ela vale mais que as outras porque nao lista casos:
  nenhum padrao de `descarte` ou de `condicao` pode ter alternativa numa
  normalizacao diferente da do texto contra o qual ele casa.
- **L19**: a T5, contra uma pergunta de `preco`.
- **R14** e **K12** foram atualizadas para o formato novo do padrao.
- **G5** ganhou as tres mensagens novas na lista de motivos DECLARADOS: recusa so
  vale se o codigo declara o motivo.

### 7.1 A rodada que reprovou, e o que ela ensinou sobre assercao

A primeira rodada devolveu `REPROVOU: 7 de 113`. **Quatro das sete eram da
ASSERCAO, nao do codigo:** eu checava que nenhum produto do blob valia `3150`, mas
o blob carrega tambem os fornecedores que **nao vieram nesta lista** (trava 4), e
um deles tem um preco igual. **Assercao que casa por VALOR solto no blob prova o
catalogo, nao a fixture.** Trocada por `descartes[].n_linhas`, que e local.

As outras tres: a lista de motivos declarados da G5, o formato do padrao na K12, e
a G6 (a secao 3 acima).

### 7.2 A prova chegou no limite do transporte, e isso e divida

`ferramentas/prova_calc_parse.sql` tem **136889 bytes**, e **78356** depois de
tirar comentario fora de string (`enxuga_prova.py`). Esse payload de 78 KB **passou
uma vez e travou outra** na mesma sessao. Nao e o banco: o `statement_timeout` e
120000 ms, entao statement pendurado por 926s nao esta no Postgres, e os
componentes medidos somam ~30s. E o transporte do MCP.

Nao da para quebrar em duas chamadas: o bloco e UM `do $prova$` que termina em
`raise exception`, e duas chamadas aplicariam a primeira metade de verdade.

**Divida registrada, e ela vence rapido:** a prova precisa virar DOIS arquivos
runnable, gerados por script a partir de UMA fonte, para as fixtures nao serem
duplicadas. Duas copias de fixture ja divergiram neste projeto e a prova reprovou
por defeito dela, nao do motor (PROCESSO 3.1). **Prova que nao roda vira arquivo
morto e a regressao volta calada**, que e exatamente a falha que o `diag_calc.py`
corrigiu para a geometria da calc.

---

## 8. O que NAO foi provado

- **Isolamento contra vendedor e contra tenant errado**, exceto no `criar`.
  Pendencia desde o v9.
- **Nenhuma lista real do mes.** Todas as fixtures sao sinteticas.
- **O efeito de outlier** do preco de replica entrando (as regras seguem
  desligadas por decisao do dono).
- **A ancora contra outra GRAFIA do mesmo fornecedor.** Limite declarado: um
  fornecedor descartado que volte como `Fabrica Zeta Atacado` vira pergunta de
  novo. E o lado certo do erro (perguntar de novo custa um clique; calar o bloco
  de outra pessoa custa preco errado), mas nao foi medido se ele volta como
  PERGUNTA ou como PRECO no nome de quem esta acima. **Vetor para a proxima
  `bandeira`.**
- Suite de frontend: nada em `public/` mudou.

---

## 9. O proximo passo

| # | Item | Trava | Peso |
|---|---|---|---|
| 1 | A tela `Alimentar` (com as QUATRO obrigacoes: as tres da secao 6 do v12 e a da grafia, abaixo) | o portao do Bloco 2 | grande |
| 2 | **Partir a prova em dois arquivos gerados por script** (secao 7.2) | a prova ja falha por transporte | pequeno |
| 3 | Isolamento vendedor/tenant na secao G | passe de seguranca | pequeno |
| 4 | `2.4b` dialeto do fornecedor, `2.4c` a aba do que aprendeu | | media |
| 5 | Derrubar o v1 | o portao do Bloco 2 | pequeno |

**A tela ganhou uma obrigacao nova, alem das tres do v12:** o botao de descartar
fornecedor amarra o descarte a GRAFIA daquele cabecalho. O texto tem que dizer
isso, senao o dono acha que descartou a pessoa e descobriu que descartou uma
grafia. E o `descartes` do resumo agora traz o motivo com o nome
(`fornecedor descartado pelo dono em 11/09/2026: Fábrica Zeta`), que e o que a
tela mostra.

O portao do Bloco 2 continua o mesmo: **o dono roda a carga do mes pela tela,
sozinho, sem Claude Code** (D7).

---

## 10. O que continua verdade

- Invariante 17; restricao 8 (fixtures sinteticas, precos inventados).
- As funcoes de `privado` sem grant e DESENHO.
- Nao criar FK de `calc_*` para tabela de operacao.
- Nao deixar linha nao entendida virar preco, nem sumir.
- `create or replace` PRESERVA dono e ACL; quem reseta e `DROP` + `CREATE`.
- **Padrao gravado tem que estar na MESMA normalizacao do texto contra o qual ele
  casa.** Foi a causa unica da D18.
- **Guarda nova se mede contra o que ja funcionava.** Foi o erro do meio da D18.
