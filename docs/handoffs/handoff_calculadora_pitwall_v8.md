# Handoff — Calculadora como produto, v8

Data: 10/09/2026. Linha `calculadora`. **Topo da linha.** Substitui o v7.

Escrito para uma sessao comecando **fria**. Tudo abaixo foi medido nesta sessao.

Nota de linguagem: prosa sem acento, sem cedilha, sem travessao. Valores reais do
sistema aparecem exatos.

---

## 0. Leia nesta ordem

1. `CLAUDE.md`.
2. `docs/calculadora/PROCESSO.md`.
3. Este arquivo.
4. **`docs/superpowers/specs/2026-09-10-aprendizado-de-fornecedor.md`**, que NAO e
   desta sessao: nasceu em OUTRA sessao viva na mesma pasta, no mesmo dia, e
   **mudou a ordem dos blocos**. Ver a secao 5.
5. O v7 so para o detalhe do defeito de cor pareada.

---

## 1. O que esta sessao fez

**Fechou os itens 1, 2 e 4 da secao 5 do v7**, e **consertou um defeito que ela
mesma introduziu no caminho**:

| Commit | O que |
|---|---|
| `9a9f79e` | JBL na calc, e a margem por categoria lendo o banco e salvando |
| `f2d7c4c` | o parser v2 promovido a caminho vivo, com a defesa da D10 junto |
| `2fd7abe` | este handoff e o indice |
| `3b88c61` | **`calc_pendencia_resolver` promovido tambem, mais a secao E da prova** |
| `790fd9d` | o indice registrando a promocao pela metade |

**Empurrados** (`5f6c698..790fd9d`), junto com o `e5fb748` da outra sessao.
**Deploy provado**, nao presumido: `curl` em `/calc/` devolve md5
`7e646d01fbfe11f8d335e51871d16a8e`, 135518 bytes, **identico ao disco sem precisar
normalizar CRLF**.

**A tela `Alimentar` (item 3) NAO foi construida, e a razao nao e falta de tempo.**
Ver a secao 5.

### O defeito que esta sessao introduziu e fechou, e e a licao mais cara da noite

A promocao do `f2d7c4c` trocou o parser de `calc_carga_abrir` e **parou ali**. Mas
`calc_pendencia_resolver` REPROCESSA a carga inteira a cada pendencia resolvida, e
continuou no v1. Efeito: a carga abria lida pelo v2 e, **na primeira resposta do
dono**, era reescrita pelo v1, que le menos. Na fixture B (formato bloco, o jeito
como lista real e escrita) isso e `n_casou` caindo de **11 de 12 para 0 de 12**. O
dono resolveria uma pendencia para MELHORAR a carga e a carga desabaria, calada.

Segundo rosto do mesmo defeito: o `resumo` era mesclado com `||` atualizando so tres
chaves, entao **`fornecedor_conferir` sobrevivia ao reprocesso e ficava OBSOLETO**,
descrevendo a leitura do v2 enquanto o blob passara a vir do v1. A defesa da D10
continuava na tela mentindo, que e pior do que nao estar la.

Quem achou: **outra sessao de Claude Code, viva na mesma pasta**, que mediu por MCP e
avisou. Conferido aqui antes de aceitar.

**Nenhuma assercao pegava isso, porque cada versao, sozinha, estava certa.** O que
estava errado era a COMBINACAO de chamadores, e combinacao nao se ve olhando funcao
por funcao. Por isso a prova ganhou a secao E (ver secao 3).

Segunda licao, do mesmo incidente: a primeira tentativa de aplicar a correcao foi
RECUSADA pelo Postgres (`42P13: cannot remove parameter defaults`), porque a
assinatura foi copiada de `pg_get_function_identity_arguments()`, **que nao mostra
default**. Ali o banco gritou. **A variante perigosa e silenciosa:** se a divergencia
fosse de TIPO (`varchar` onde era `text`), nao haveria recusa, e sim uma SOBRECARGA:
duas `calc_pendencia_resolver` convivendo, uma no v1 e outra no v2, com o PostgREST
escolhendo pelos nomes de argumento do POST. **Assinatura se copia da migration de
origem, com defaults, nunca do catalogo.**

---

## 2. Fatia 1: a margem deixou de ser chumbada (commit `9a9f79e`)

Os itens 1 e 2 do v7 eram a MESMA linha de codigo. `mg()` tinha tres ramos, e o
`else` dava margem de iPhone a tudo que nao fosse MacBook nem custo puro. JBL
cairia ali (margem de iPhone numa caixa de som de R$ 2.200, o oposto da D11), e
`Acessório` ja caia desde sempre, porque **a D4 nunca foi implementada**.

### O contrato novo de `mg()`

Medido executando a funcao REAL contra o `config.margens` de verdade do banco:

| Categoria | Antes | Agora |
|---|---|---|
| iPhone / iPad / Apple Watch | +550 / +650 chumbado | +550 / +650, vindo do banco |
| MacBook | +1200 / +1300 chumbado | +1200 / +1300, vindo do banco |
| 1ª Linha / Garmin / Moto Elétrica | 0 / 0 | 0 / 0 (`SEMMARGEM` ganha de tudo) |
| **Acessório** | **+550 / +650 (fonte de R$ 70 saindo a R$ 620)** | **`null`** |
| **JBL** | cairia em +550 / +650 | **`null`** |
| categoria nova, fora de `config.margens` | +550 / +650 | **`null`** |

**`null` = NAO CONFIGURADA, e nunca zero.** Zero e margem legitima: as tres classes
de custo puro vendem no custo de proposito. Confundir os dois faria a categoria
passar a vender no custo calada.

**Margem `null` NAO vira preco.** Os seis chamadores de `mg()` param antes de
qualquer conta e dizem, com palavra, o que falta. Mesma familia de "nao deixar linha
nao entendida virar preco". **Efeito visivel que o dono precisa saber: `Acessório` e
`JBL` deixaram de sugerir preco de venda** ate a margem ser definida. Nao foi
pre-enchido valor: arbitrar margem dele e o que a D4a ja proibiu.

O fallback sem `config.margens` vale byte a byte o comportamento anterior, e isso
NAO e cortesia: `prova_sem_margem.js` monta um `CFG` sem `margens` e assere
exatamente isso. **Ela passou SEM ser editada**, que e o que prova que o fallback
nao quebrou.

### A aba Config

Os dois pares fixos (`cfia/cfip/cfma/cfmp`) sairam da TELA e viraram uma linha por
categoria, na ordem de `KCATS`. Com par fixo, toda categoria nova exigia codigo
novo, e foi assim que `Acessório` ficou esquecido; agora categoria nova e DADO.
As propriedades `CFG.iav/ipc/mav/mpc` FICARAM no literal: sao o fallback.

Campo vazio = `null`, com `placeholder` de travessao e a palavra na linha. As tres
de custo puro sao **somente-leitura**, porque `SEMMARGEM` ganha dentro do `mg()` e
campo editavel ali seria um campo que mente.

E salva de verdade: `calc_config_margem_salvar` (que existia desde o v6 e **nunca
tinha consumidor**) recebe as NOVE categorias sempre, porque a RPC substitui o
objeto inteiro. Erro do banco aparece com a mensagem do banco.

---

## 3. Fatia 2: o v2 virou o caminho vivo (commit `f2d7c4c`)

`public.calc_carga_abrir` passa a chamar `privado.calc_parse_v2`.

**A segunda mudanca nao e opcional, e e o motivo de a promocao nao ter entrado
sozinha.** A D10 inverteu o comportamento: no v1 o cabecalho de fornecedor
desconhecido QUEBRA o bloco; no v2 nao quebra. A trava nao sumiu, MUDOU DE LUGAR,
para `fornecedor_conferir`. Trocar so o chamador apagaria a defesa: o cabecalho
ignorado sumiria calado e as linhas dele sairiam com o nome do fornecedor anterior,
que passa no validador e so aparece quando alguem compra pelo custo de outra loja.

Entao `fornecedor_conferir` passa a viajar no `resumo`, com a forma
`{fornecedor, cabecalho, ignoradas[], n_linhas, suspeita_alta}`. Junto vao os tres
contadores que so o v2 produz (`n_do_cabecalho`, `n_cor_vizinha`,
`n_cond_conflito`): eles dizem POR ONDE a cobertura veio, nao so quanto ela foi.

Oito verificacoes pelo `base`, zero divergencia. As duas que mais importam:

- **V2**: o v1 NAO foi encostado. `md5 = f74503007e8e373ce2997b54c249c84c`, o mesmo
  de antes da migration e o mesmo do v7. Novo valor de record para a proxima sessao
  comparar: `calc_parse_v2` tem md5 `20e11504caaa4b8c5bede180569bf1c3`.
- **V4**: a ACL foi refeita depois do `create or replace`, que e a armadilha que o
  `CLAUDE.md` registra. `authenticated` presente, `anon` ausente, sem entrada PUBLIC.

### A prova encolheu, e a conta fecha

`ferramentas/prova_calc_parse.sql`: o v1 saiu do laco de versoes e o bloco `-- v1`
da secao D foi apagado, como o cabecalho do proprio arquivo mandava fazer no dia da
promocao. Rodada pela `bandeira`, arquivo byte a byte do disco:

**PASSOU, 49 assercoes, 0 falhas** (eram 71).

A queda foi **calculada a partir do diff ANTES de rodar** e bateu exata: 20
assercoes do laco que deixaram de rodar a segunda vez, mais as 2 exclusivas do ramo
do v1. `71 - 22 = 49`. **Nenhuma cobertura unica se perdeu**: as 9 dos helpers e as
17 da fixture B rodam uma vez so e continuam inteiras.

Medido: fixture A `casou=13 de 18, cobertura 72,2%`; fixture B `casou=11 de 12,
91,7%`; fixture B pelo v1 `casou=0`, que e a assercao B0 e segue executando o v1.

### A secao E, que e a parte que sobrevive a esta noite

Depois do defeito da secao 1, a prova ganhou TRES assercoes que cobram a coerencia
ENTRE chamadores, e nao o comportamento de um parser:

- **E1**: toda funcao de `public` que cita o parser usa a **MESMA** versao. A regra
  e "todos no mesmo", **nao** "todos no v2", de proposito: no dia em que nascer um
  v3 ela continua valendo sem ser reescrita, e reprova exatamente na janela
  perigosa, que e a da promocao pela metade.
- **E2**: os dois consumidores conhecidos continuam existindo, para a E1 nao passar
  verde por nao encontrar ninguem.
- **E3**: nenhuma `calc_*` de `public` tem SOBRECARGA. E a irma SILENCIOSA da E1:
  numa sobrecarga a E1 passaria verde, porque as duas existiriam e uma estaria no v2.

**A E1 foi validada contra o defeito REAL, nao contra um injetado**: medida com o
defeito no ar devolveu `versoes_distintas = 2` (reprova) e, depois da migration,
`1` (passa). Ciclo completo de mutacao com o defeito de verdade.

Uma correcao registrada ao que a outra sessao pediu: ela sugeriu asserir que
"resolver pendencia nao pode mudar a cobertura". **Nao foi implementado assim, e de
proposito:** resolver DEVE poder SUBIR a cobertura, que e o ponto do laco de
aprendizado, e uma assercao de igualdade travaria a fatia 2.4 no dia em que ela
funcionar. O que nunca pode e a cobertura CAIR por troca de parser entre os passos,
e e isso que a E1 cobra.

---

## 4. Estado vivo, medido em 10/09/2026 apos os dois commits

```sql
select
  (select count(*) from public.calc_modelo where tenant_id is null) as modelos_semente,
  (select count(*) from public.calc_alias  where tenant_id is null) as aliases_semente,
  (select count(*) from public.calc_fornecedor) as fornecedores_tenant,
  (select count(*) from public.calc_carga) as cargas,
  (select jsonb_array_length(jsonb_path_query_array(dados->'config'->'margens','$.keyvalue()'))
     from public.calc_dados where tenant_id='00000000-0000-0000-0000-000000000001') as margens;
```

Esperado: **125, 40, 17, 0, 9**. Sem mudanca: nenhuma das duas fatias tocou em dado.

`config.margens` hoje: iPhone/iPad/Apple Watch 550/650, MacBook 1200/1300,
1ª Linha/Garmin/Moto Elétrica 0/0, **JBL e Acessório `null`**.

| Funcao | Papel |
|---|---|
| `privado.calc_parse_v2` | **o caminho vivo**, e agora com DOIS consumidores |
| `privado.calc_parse` | o v1, **sem chamador**, coberto so pela assercao B0 |

Os dois consumidores, e a consulta que teria pego o defeito da secao 1 na hora.
**Rodar isto em TODA promocao de parser:**

```sql
select p.proname,
       case when p.prosrc like '%calc_parse_v2%' then 'v2' else 'v1' end as chama
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prosrc like '%calc_parse%'
 order by p.proname;
```

Esperado: `calc_carga_abrir = v2` e `calc_pendencia_resolver = v2`. Qualquer `v1` e
promocao pela metade. (Hoje isso e a assercao E1 da prova, entao roda sozinho.)

Valores de record das duas funcoes, para a proxima sessao comparar:

| Funcao | md5 | len |
|---|---|---|
| `public.calc_carga_abrir` | `584577065264507bb2c7da9291a39790` | 3258 |
| `public.calc_pendencia_resolver` | `85c14e383045cd702c61f062b9c0fe59` | 5205 |
| `privado.calc_parse` (v1, intocado) | `f74503007e8e373ce2997b54c249c84c` | 19746 |
| `privado.calc_parse_v2` | `20e11504caaa4b8c5bede180569bf1c3` | 27427 |

**Advisors: 8**, sem entrante (os sete `SECURITY DEFINER` mais o leaked password).

**Suite: 20 execucoes, EXIT 0 em todas**, incluindo `diag_calc` nas tres larguras
(a aba Config ganhou secao nova) e `diag_largo` nas tres do monitor grande.
`prova_catalogo.js` foi de **50 para 119 assercoes**.

---

## 5. A tela `Alimentar` NAO foi feita, e o motivo e o que mais importa aqui

**Outra sessao de Claude Code estava viva nesta mesma pasta durante esta sessao**, e
commitou `e5fb748` as 23:20, quatro minutos antes do `f2d7c4c`. E a situacao que a
memoria `duas-sessoes-mesma-pasta` descreve. O `git add -A` estar mecanicamente
negado foi o que impediu o commit desta sessao de varrer o trabalho dela: commitado
por caminho explicito, e o `git show --stat` confirma 3 arquivos, todos desta linha.

Ela entregou `docs/superpowers/specs/2026-09-10-aprendizado-de-fornecedor.md` e
**mudou a ordem dos blocos do plano**. Duas consequencias diretas para a tela:

1. **Nasceu a fatia 2.4, aprendizado de fornecedor**, dentro do Bloco 2. Ou seja: a
   superficie que seria construida passou a ter DUAS specs governando, e a de 10/09
   declara ganhar no tema aprendizado.
2. **O Bloco 5 subiu para antes do 3 e do 4**, e deixou de ser opcional.

E ela achou um defeito que cai **exatamente no passo 3 da tela** (Pendencias, que
chama `calc_pendencia_resolver`). Conferido por medicao propria, sem aceitar de
segunda mao:

```
constraints em calc_alias.aponta ............................ 0
calc_pendencia_resolver referencia calc_fornecedor .......... 0
calc_pendencia_resolver referencia calc_modelo .............. 0
```

`calc_alias.aponta` nao tem FK nem check, e a RPC nao valida o destino: **apelido
para fornecedor novo grava sem erro e nao casa nada, calado.** Nunca apareceu no
tenant do dono, que tem catalogo completo. Aparece em todo cliente.

**Construir a tela hoje seria embrulhar esse defeito em wizard**, que e exatamente o
erro que a fatia 1 do Bloco 2 foi cortada para evitar (o defeito de CPO de
27/07/2026 ficou sete dias no ar por ninguem olhar a pilha intermediaria).

Entao: a tela espera a 2.4. Isso e decisao registrada, nao tarefa esquecida.

---

## 6. O proximo passo

| # | Item | Trava | Peso |
|---|---|---|---|
| 1 | **A fatia 2.4**, o verbo `criar` e a validacao de destino | a tela | o grosso |
| 2 | **A tela `Alimentar`** | o portao do Bloco 2 | grande, e vem DEPOIS da 2.4 |
| 3 | Derrubar o v1 (`privado.calc_parse`) | nada | pequeno |
| 4 | Comissao alteravel | Bloco 3 | decisao ja tomada |
| 5 | Modelos e cor que faltam no catalogo | cobertura | insert |

### Comece a 2.4 por aqui, ja medido em 11/09/2026

O desenho e da outra sessao:
`docs/superpowers/specs/2026-09-10-aprendizado-de-fornecedor.md`, secoes **3.1** e
**7**. Leia antes de tocar em `calc_pendencia_resolver`.

Estado do que a 2.4 mexe, medido, nao herdado:

```sql
with T as (select '00000000-0000-0000-0000-000000000001'::uuid as t),
a as (select tipo, texto, aponta from public.calc_alias, T where tenant_id = T.t)
select
  (select count(*) from a) as aliases_tenant,
  (select count(*) from a where tipo='modelo' and not exists (
      select 1 from public.calc_modelo m, T where m.codigo=a.aponta and m.tenant_id=T.t)) as modelo_orfao,
  (select count(*) from a where tipo='fornecedor' and not exists (
      select 1 from public.calc_fornecedor f where f.codigo=a.aponta)) as fornecedor_orfao,
  (select count(*) from a where tipo='cor' and not exists (
      select 1 from public.calc_cor c, T where c.codigo=a.aponta and c.tenant_id=T.t)) as cor_orfa;
```

Esperado: **61, 0, 0, 0**. Mais 40 aliases de semente (`tenant_id is null`), e os
tipos em uso sao `modelo`, `cor`, `fornecedor`, `condicao` (9 de condicao).

**O defeito e LATENTE, nao ativo, e isso muda o trabalho.** `calc_alias.aponta` nao
tem FK nem check, e `calc_pendencia_resolver` nao valida o destino (medido: a funcao
nao referencia `calc_modelo` nem `calc_fornecedor`), entao apelido para destino
inexistente grava calado e nao casa nada. Mas **hoje ha ZERO orfaos** no tenant do
dono, porque o catalogo dele e completo e ele so aponta para o que existe. Ou seja:
**a 2.4 e acrescentar a guarda, nao limpar dado.** Nao ha migracao de dado sujo.

**ARMADILHA, e ela custa caro:** `aponta` casa com a coluna **`codigo`**, nunca com
`nome` (invariante 12, e o corpo da RPC diz isso). `calc_modelo`, `calc_cor` e
`calc_fornecedor` tem AS DUAS colunas. Medir contra `nome` inventa **52 orfaos
falsos** de 61 aliases, e quem acreditar vai "consertar" 52 nao-problemas. Essa
consulta errada foi escrita e rodada nesta sessao antes de ser pega.

O que a 2.4 traz, pela spec: o verbo **`criar`** (que falta, e e por isso que
apontar para fornecedor novo nao tem para onde apontar), o orcamento de UMA pergunta
obrigatoria (categoria do modelo, porque decide margem, e **agora que a margem e
`null` por padrao em categoria nova, essa pergunta ficou mais importante, nao
menos**), o dialeto por fornecedor que DESEMPATA e nunca DECIDE, e a bandeira
`formato_mudou`.

O portao do Bloco 2 continua o mesmo e continua nao sendo tecnico: **o dono roda a
carga do mes pela tela, sozinho, sem Claude Code**, com cobertura nao menor que a do
caminho MANUAL da skill na MESMA entrada (D7).

### Divida declarada, e ela tem data para morrer

O v1 segue no banco **sem chamador e quase sem prova** (so a B0 ainda o executa).
Uma versao anterior do comentario da migration dizia que ele ficava como "rede para
comparar cobertura": **isso estava ERRADO e a correcao esta no arquivo.** O portao
D7 compara a tela contra o caminho MANUAL da skill, nunca contra o v1. Ele nao foi
derrubado agora so para a promocao ser reversivel por um `create or replace` de uma
linha enquanto a tela nao rodou carga real. **Derrubar quando o portao fechar.**

---

## 7. Armadilhas medidas nesta sessao (soma as do v7)

**Promover um parser e trocar TODOS os chamadores, nunca um.** A licao completa esta
na secao 1. O guarda contra a classe inteira e a assercao E1, nao a memoria de quem
promoveu.

**Assinatura de funcao se copia da migration de ORIGEM, com defaults, nunca de
`pg_get_function_identity_arguments()`**, que nao mostra default. Erro de default o
Postgres recusa (`42P13`); erro de TIPO ele aceita e cria SOBRECARGA, calado. A
assercao E3 cobre a segunda.

**`LIKE` mente ao comparar corpo de funcao que tem barra invertida.** O `base`
tentou conferir a linha do `regexp_replace` com `LIKE` e levou um `false` FALSO:
`\` e o caractere de escape padrao do `LIKE` em Postgres e comeu as barras do
proprio padrao. Conferir com `~` ou com igualdade construida por `chr(92)`.

**`aponta` casa com `codigo`, nunca com `nome`.** As tres tabelas de catalogo tem AS
DUAS colunas, entao a consulta errada RODA e devolve numero. Medir orfao de
`calc_alias` contra `nome` inventa 52 orfaos falsos de 61 aliases. Detalhe na
secao 6.

**Cache de borda da Cloudflare serve a versao VELHA por alguns segundos depois do
push, com `CF-Cache-Status: HIT`.** Medido nesta sessao: o primeiro `curl` em
`/calc/` devolveu 128598 bytes, ainda com `id="cfia"`, que a fatia 1 removeu. Parece
build que nao terminou, e nao era. **O cache-buster e o que separa as duas causas**,
porque elas pedem acoes opostas (esperar contra invalidar): com `?cb=<epoch>` vieram
os 135518 bytes do disco na hora. Segundos depois a URL limpa ja servia a versao
nova sozinha. Ver a memoria `conferir-deploy-cloudflare`.

**Duas sessoes na mesma pasta acharam, cada uma, o defeito da outra.** Esta sessao
conferiu o achado da outra (`calc_alias.aponta` sem FK) e a outra conferiu o desta
(`calc_pendencia_resolver` no v1). Nenhuma das duas teria achado o proprio. Nao e
argumento para rodar duas sessoes de proposito, e e argumento para **conferir por
medicao propria antes de aceitar, e para avisar em vez de consertar no territorio
alheio**, que foi o que as duas fizeram.

**O classificador do modo automatico negou `apply_migration` ao `base`, duas vezes.**
Ele tinha `execute_sql` funcionando e **se recusou a rodar o DDL por ali**, o que foi
a decisao certa: tiraria a escrita do registro de migrations e furaria o ponto unico
de escrita auditavel. O destravamento foi decisao do dono, com quatro opcoes e o
efeito de cada uma na mesa; ele escolheu a regra persistente, e
`mcp__supabase__apply_migration` entrou em `permissions.allow` de
`.claude/settings.json`. **As 11 regras de `deny` do `git add -A` seguem intactas**,
conferidas no JSON depois de gravar.

**O MCP do Supabase caiu por token expirado no meio da sessao.** O `base` parou sem
aplicar nada e disse o ponto exato de parada, o que importou: se a migration tivesse
sido aplicada e so as verificacoes tivessem falhado, o proximo passo seria outro.
Destrava com `/mcp` e reautorizar.

**Subagente reporta de contexto VELHO.** O `base` afirmou que
`prova_calc_parse.sql` ainda rodava o v1 no laco, depois de o arquivo ja ter sido
editado. Ele tinha lido antes da edicao. **Conferir o disco antes de aceitar
afirmacao de subagente sobre estado de arquivo**, mesmo de um que acertou tudo o
mais.

**`public/calc/index.html` NAO tem terminador CRLF.** Medido: 0 bytes CR, 1806 LF.
O `vitrine` recebeu instrucao de preservar CRLF, mediu e corrigiu quem o instruiu.
A fonte do erro e o comentario de `ferramentas/prova_sem_margem.js:32`, que ainda
diz CRLF e **segue desatualizado no repo** (o `\r?` da regex e opcional, entao ela
funciona nos dois casos). O `.gitattributes` tem `* text=auto eol=lf` e registra a
normalizacao de 14/08/2026.

**Contraste nomeado, nao consertado.** A classe `.al.ay`, reusada no bloco novo de
`vCalc`, mede **3,28:1**, abaixo dos 4,5:1 de texto. Ja era assim para a mensagem
"só custo" desde 15/08/2026; o `vitrine` espelhou o padrao aprovado em vez de
inventar token no meio da obra, e **nao consertou em silencio**. Mexer em `--ye`
repinta a calc inteira e e outra tarefa. Nas linhas da Config o problema foi evitado:
o estado vai por `.cfsb` na cor `--mu` (5,56:1), com a distincao carregada por
PALAVRA e ICONE, nao por matiz.

---

## 8. O que continua verdade

- Invariante 17: nao construir superficie de SaaS antes do primeiro pagamento.
- Restricao 8: nao commitar export de fornecedor, nem como fixture.
- `privado.calc_parse_v2` **sem grant para `authenticated` e DESENHO**, e agora que
  ela tem consumidor a tentacao aumenta. Quem chama e a RPC `SECURITY DEFINER` de
  `public`, com a barreira de papel no CORPO. Grant direto criaria caminho que pula
  a barreira. Ver a memoria `parse-v2-sem-grant-e-desenho`.
- Nao criar FK de `calc_*` para tabela de operacao.
- Nao deixar linha nao entendida virar preco. **Corolario novo desta sessao: margem
  nao configurada tambem nao vira preco.**
- `calc_catalogo_tenant_pitstop` segue NAO versionada, de proposito.

---

## 9. O que NAO foi provado, e o vetor exato de cada um

- **A RPC de salvar margem nunca foi chamada de um navegador com sessao.** O payload
  foi provado executando `cfMLer()` real; a resposta do banco, nao. Vetor: abrir
  `/calc/` como dono, definir a margem do JBL, salvar, esperar a confirmacao de nove
  categorias gravadas, recarregar e conferir que o valor voltou.
- **`fornecedor_conferir` nao foi provado numa linha REAL de `calc_carga`.** Foi
  provado que o v2 produz o campo e que a funcao o copia; `cargas` segue 0. Vetor,
  dentro de um `DO` que termina em `raise exception`:
  `set_config('request.jwt.claims', ..., false)` mais `set role authenticated` mais
  a chamada da RPC.
- **`calc_pendencia_resolver` foi provada na ESTRUTURA, nao no COMPORTAMENTO.** O
  corpo, a ACL, as opcoes e a assinatura foram medidos; a RPC nunca foi CHAMADA,
  porque `cargas = 0` e `pendencias = 0` e nao ha linha contra a qual chamar. O
  `11 de 12` da fixture B esta provado no parser, nao no caminho
  `resolver -> reprocesso -> resumo`. **Este e o mesmo vetor dos dois itens acima, e
  os tres fecham juntos numa chamada so:** um `DO` com
  `set_config('request.jwt.claims', '{"sub":"fb2aad8e-b728-4e59-a198-71da2156449d","role":"authenticated"}', true)`
  mais `set local role authenticated`, inserindo uma `calc_carga` com a fixture B,
  chamando `calc_carga_abrir` e depois `calc_pendencia_resolver`, e terminando em
  `raise exception` para nao gravar nada. Conferir que a cobertura NAO cai entre os
  dois passos e que `fornecedor_conferir` chega e e refrescado.
- **O portao do Bloco 2 (D7) segue em aberto.** As duas fixtures sao sinteticas e
  escritas para armar armadilha: 72,2% e 91,7% nao dizem nada sobre a carga real.
