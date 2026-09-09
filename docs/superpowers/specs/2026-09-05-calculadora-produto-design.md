# Spec: a calculadora vira produto — nova dinamica de alimentacao

Data: 05/09/2026. Escopo aprovado pelo dono nesta sessao.

Nota de linguagem: este documento segue a convencao do CLAUDE.md (prosa sem acento,
sem cedilha, sem travessao). Valores reais do sistema (rotulos, codigos, nomes de
funcao, nomes de campo, nomes de fornecedor) aparecem com seus caracteres exatos e
nao sao alterados.

Decisao de origem, registrada: o dono pediu explicitamente **transformar em sistema
comercializavel, com outro lojista usando sem dificuldade**. Isso vai contra a
recomendacao registrada no invariante 17 (nao construir superficie de SaaS antes do
primeiro pagamento) e contra a recomendacao desta sessao de segurar a fase de
onboarding. E escolha consciente do dono, com o custo assumido.

## 0. Decisoes fechadas nesta sessao

| # | Pergunta | Resposta do dono |
|---|---|---|
| D1 | Os 341 produtos do tenant `...0004` servem de historico? | **Nao.** Delete direto, sem snapshot |
| D2 | O que e vendido? | **O conjunto** (Pit Wall com a calc dentro). A calculadora **vira produto separado depois** |
| D3 | Regras de descarte sao configuraveis por tenant? | **Sim, configuraveis** |
| D4 | `Acessório` e margem | **Margem propria**, e passa a **entrar na calc do consultor** |
| — | Assentos | **Time completo incluso**, acesso so por login |
| — | Cota de modelo | **3.000 linhas/mes + 3.000 de abertura** |

Correcao factual registrada junto de D4, porque o dono citou Apple Watch como
acessorio: **`Apple Watch` e categoria propria, nao `Acessório`.** Ja recebe
`iav`/`ipc` e ja aparece na calc do consultor hoje. D4 muda somente a categoria
`Acessório` (12 itens: AirPods 4, AirPods 4 ANC, AirPods Pro 2, AirPods Pro 3,
AirPods Max 2, AirPods Max USB-C, AirTag Pack 4, Apple Pencil 2, Apple Pencil Pro,
Apple Pencil USB-C, Cabo Tipo-C Apple, Fonte Turbo Apple).

---

## 1. Problema, medido em 05/09/2026

Estado vivo consultado antes do desenho, nao herdado de handoff.

### 1.1 A calculadora nao tem como ser alimentada por quem a usa

| Fato | Numero |
|---|---|
| Escritas em `calc_dados` no frontend | **0** (a calc so le, 1 `from('calc_dados')`) |
| Policies de INSERT/UPDATE em `calc_dados`, `tenant`, `app_usuario` | **0**. So SELECT |
| Blob vigente do dono | 494 produtos, 1007 precos, 17,3 KB, de 17/08/2026 |
| Caminho unico de escrita | sessao de Claude Code por MCP, ou SQL Editor |

Consequencia hoje, e ela e sobre o dono antes de ser sobre cliente: **a Pitstop
Imports nao consegue atualizar o proprio preco sem abrir uma sessao de IA.**

### 1.2 O motor de leitura nao e codigo, e um arquivo de skill

O que transforma a lista do fornecedor em preco canonico mora em
`.claude/skills/calculadoras/references/formato-dados.md` (25 KB): 17 fornecedores com
praca, 66 nomes de iPhone, 32 cores com hex, a ordem obrigatoria de condicao (CPO
antes de Lacrado), a tabela de token malformado, as regras de descarte.

Cobertura com esse catalogo: **89% era o numero usado ate 09/09/2026**, quando a
auditoria mostrou que ele **nao tem medicao de origem** (secao 2.6b). Vale como alvo
declarado do dono, nunca como baseline medida.
Cobertura medida sem catalogo calibrado, com parser rustico: **46% de media**, e
**0%** no formato antigo.

O catalogo e o ativo. Ele nao esta no produto: esta num arquivo que so o Claude le.

### 1.3 A calc do consultor e single-tenant por construcao

`public/calc/consultor/dados.js` (29,7 KB) e arquivo estatico do repo. Subir preco e
`git push`. Nao existe versao "de outro lojista" desse arquivo, e nunca vai existir
enquanto ele for arquivo. Furo ja medido em 27/07/2026: `curl` sem sessao nenhuma
devolve a tabela de venda e a escada de comissao inteira.

### 1.4 O tenant nao nasce

`public.tenant` tem **1 linha** e colunas `id, nome, criado_em`. Nao ha plano, status
nem trial. `privado.fn_provisionar_tenant` **nao existe**. Criar acesso e clique no
painel do Supabase mais `insert` manual em `app_usuario`.

### 1.5 O plano do segundo lojista esta inteiro em aberto

`docs/superpowers/plans/2026-08-19-segundo-lojista-tenant.md`, sete tarefas, escrito
em 19/08/2026. Medido em 05/09/2026: **nenhuma executada.** 1 linha orfa em
`calc_dados` com 14 dos 17 fornecedores do dono, 48 scripts com `Pitstop Imports`
fixo, 3 ocorrencias no `index.html`, 1 tenant.

Aquele plano continua valendo e vira o Bloco 0 deste. Nao se duplica nem se ignora.

---

## 2. A nova dinamica

### 2.1 De superficie de consulta para ciclo fechado

Hoje a calculadora e **uma tela que le**. Passa a ser **um ciclo**: consultar volta a
depender de alimentar, e alimentar acontece dentro do proprio produto.

```
                    +-------------------+
                    |   ALIMENTAR       |
   lista do  ---->  |  (superficie nova)|  ----+
   fornecedor       +-------------------+      |
                                               v
        +--------------------+        +-----------------+
        |  CONSULTA (dono)   | <----- |   calc_dados    |
        |  custo, margem,    |        |  blob de custo  |
        |  scanner, usado    |        +-----------------+
        +--------------------+                 |
                                               | derivacao
        +--------------------+        +-----------------+
        | VENDA (consultor)  | <----- |   calc_venda    |
        | preco, comissao    |        | blob de venda   |
        +--------------------+        +-----------------+
```

Tres superficies, tres papeis, uma fonte:

| Superficie | URL | Papel | Le | Escreve |
|---|---|---|---|---|
| Consulta | `/calc/` | `dono` | `calc_dados` | nao |
| **Alimentar** | `/calc/alimentar` | `dono` | catalogo + carga | **sim, por RPC** |
| Venda | `/calc/consultor/` | `vendedor` e `dono` | `calc_venda` | nao |

**Nao existe catalogo mantido pelo dono do produto.** Decisao explicita dele em
07/09/2026: *"nao assumi atualizar nenhum catalogo base. quem vai atualizar e o
cliente."* O que existe e uma **semente**, copiada uma vez no nascimento do tenant;
a partir dai o catalogo e do cliente, e quem o mantem e ele, resolvendo pendencia.
Detalhe em 2.4.

O CHECK de `papel` segue aceitando so `dono` e `vendedor` (o papel `parceiro` foi
criado e revertido na v39).

### 2.2 O ciclo de alimentacao, passo a passo

```
1. COLAR       o lojista cola texto ou sobe o _chat.txt do WhatsApp
2. FORNECEDOR  o sistema lista os cabecalhos que achou e pede nome + praca
3. PARSE       deterministico, contra o catalogo DO TENANT (so ele, ver 2.4)
4. PILHAS      casou | duvidoso | nao reconhecido | descartado
5. LLM         roda SO na pilha "nao reconhecido", e so se houver cota
6. PENDENCIA   agrupada POR CAUSA, nunca por linha
7. DIFF        subiu / caiu / novo / sumiu / variacao acima de 15% item a item
8. APROVAR     escrita transacional: calc_dados + calc_venda + fecha a carga
9. NO AR       sem deploy, sem push, sem sessao de IA
```

### 2.3 O laco de aprendizado e o coracao do produto

Resolver pendencia **escreve no catalogo do tenant**. Nao e formulario de correcao, e
ensino.

| Pendencia mostrada | Linhas afetadas | O que a resposta grava |
|---|---|---|
| `A cor PURPLE nao esta no catalogo` | 31 | `calc_alias` cor: `PURPLE` -> `Lilás` |
| `Cabecalho MELHOR DE CAXIAS nao casa com fornecedor` | 14 listas | `calc_alias` fornecedor -> `Five Cell` |
| `Poco F8 Pro nao e Apple. Voce vende Android?` | 6 precos | `calc_regra` descarte permanente |

**Agrupar por causa e o que torna o dia 1 viavel.** Com 1007 precos e 10% de
pendencia sao 100 decisoes item a item; agrupadas por causa viram cerca de 12. E a
diferenca entre 10 minutos e duas horas, e entre o cliente terminar ou desistir.

Efeito medido no proprio historico do dono: 46% de cobertura sem catalogo, 89% depois
de quatro cargas ensinando. Isso deixa de ser trabalho de sessao de IA e passa a ser
propriedade do produto.

### 2.4 Semente no nascimento, catalogo do cliente para sempre

**Decisao do dono, 07/09/2026:** *"nao assumi atualizar nenhum catalogo base. quem
vai atualizar e o cliente."* Isso corrige o desenho de 05/09, que previa uma camada
global mantida por ele. **Nao ha camada global viva.**

| Camada | `tenant_id` | Quando e lida | Quem mantem |
|---|---|---|---|
| **Semente** | `NULL` | **so no nascimento do tenant**, por `fn_provisionar_tenant`. Nunca no parse | ninguem, depois de escrita. E um retrato, nao um servico |
| **Catalogo do tenant** | preenchido | em todo parse | **o lojista**, resolvendo pendencia |

O parse resolve **exclusivamente** contra `tenant_id = fn_tenant_atual()`. A policy
de SELECT nao expoe linha de semente em tempo de execucao: se expusesse, um cliente
veria catalogo que nao e dele e o dono do produto herdaria, na pratica, a obrigacao
de mante-lo.

O que a semente carrega: nomes canonicos de modelo, cores mais hex, condicoes, as
faixas de RAM/SSD/polegada, os tokens malformados e as regras de leitura. **Nunca
fornecedor nem praca** — sao ativo do dono, e o vazamento de 14 dos 17 fornecedores
pela linha orfa do tenant `...0004` era exatamente essa falha ja armada no banco.

**Modelo novo entra pelo mesmo laco de 2.3.** O `iPhone 18` aparece na lista do
fornecedor do cliente, nao casa com o catalogo dele, vira pendencia agrupada
(`iPhone 18 Pro Max 256GB nao esta no catalogo, 4 precos`) e ele decide. O
mecanismo ja existe e **nao depende de ninguem publicar nada**.

### 2.4.1 O que essa decisao custa, declarado

Duas consequencias que o dono aceita ao nao manter catalogo:

1. **Nao ha aprendizado compartilhado.** Duzentos clientes ensinam
   `PURPLE -> Lilás` duzentas vezes. Cada tenant paga a propria curva: cerca de 46%
   de cobertura na primeira carga e 89% depois de umas quatro, que foi a curva
   medida no historico do dono.
2. **A cobranca recorrente nao se sustenta em catalogo atualizado.** Passa a se
   sustentar no sistema rodando: a tela de alimentar, a calc do consultor, a RLS,
   o acesso da equipe e a hospedagem. E o argumento comercial normal de SaaS, mais
   fraco como fosso que "eu mantenho o catalogo", e e o que ha.

O ganho que sobrevive inteiro: **cliente novo comeca em torno de 80%, nao em 0%**,
porque a semente entrega o lado Apple pronto no dia 1. Ela so nao promete nada
sobre o dia 200.

### 2.5 Normalizar o catalogo, nao o preco

O blob jsonb de `calc_dados` **fica**. Preco nao vira tabela relacional nesta obra.

Motivo: a granularidade de RLS e a LINHA, e a regra de negocio e "um blob por tenant,
visivel so para o papel certo". Uma linha por tenant e exatamente a granularidade
certa. Normalizar preco em tabela cria N linhas por tenant sem ganhar uma unica regra
de acesso nova, e obriga reescrever `validarDados()` e as duas telas.

O que se normaliza e o **catalogo**, porque catalogo precisa ser consultado, ensinado,
versionado e compartilhado entre tenants. Blob nao faz nada disso.

### 2.6 Onde o modelo entra, e quanto custa

O parse deterministico contra o catalogo e gratis e ilimitado. O modelo roda **so na
pilha nao reconhecida**.

| Grandeza | Medido / estimado |
|---|---|
| Precos por carga | 1007 (blob atual) |
| Cobertura com catalogo maduro | 89% (alvo declarado, **nao medido** — ver 2.6b) |
| Linhas que sobram para o modelo | ~100 por carga |
| Cadencia real do dono | 4 cargas em 21 dias (27/07, 03/08, 15/08, 17/08) |
| Custo por carga, Opus 5 ($5/$25 por 1M) | ~$0,30 (estimativa de token, nao medicao) |
| Custo mensal em uso normal | ~$2,40 |
| Abertura de conta (catalogo vazio) | ~$1,00, uma vez |

**Cota decidida: 3.000 linhas nao reconhecidas por mes, mais 3.000 de credito de
abertura, uma vez.** Folga de cerca de 4x sobre o uso normal (800/mes). Teto de custo
na cota cheia: cerca de $1,50/mes por cliente.

A unidade e **linha enviada ao modelo**, nunca linha do arquivo: o lojista pode colar
5 MB de chat que so o que nao casou consome cota.

Ressalva honesta: os numeros de token acima sao **estimativa**. A primeira carga real
pelo wizard deve ser medida com `count_tokens` e a cota reajustada antes de publicar
plano.

### 2.6b Portao de cobertura: comparacao pareada, nao numero absoluto

**Decisao do dono, 09/09/2026 (D7)**, tomada depois de a proveniencia dos 89% ser
auditada e **nao se sustentar**.

O portao do Bloco 2 passa a ser:

> Na MESMA entrada, a tela nova nao pode cobrir menos que o caminho de hoje
> (a skill `calculadoras` rodada por sessao de IA).

Como medir, numa passada so:

1. O dono cola uma lista real na tela nova. Anotar `casou`, `lidas`, `descartadas`.
2. A **mesma** lista passa pelo caminho atual da skill. Anotar os mesmos tres.
3. Passa se `casou_novo >= casou_velho` **na mesma entrada**.

Vantagem sobre um numero fixo: nao depende de arqueologia, nao pode nascer frouxo
nem impossivel, e mede exatamente o que importa (a tela nao pode ser pior que o
processo que ela substitui).

**Auditoria da proveniencia, 09/09/2026.** O par `612 de 690` aparece pela primeira
vez em `.claude/skills/calculadoras/references/procedimento-alimentacao.md:92`,
**dentro de aspas, como exemplo de FORMATO**, na frase *"Fechar com a cobertura real
medida: 'casaram 612 de 690 linhas (89%)'"*. O `612` **nao existe como medicao em
nenhum outro ponto do repo**. O `690` existe uma vez, em `aprendizados.md:425`, mas
como **"690 precos"**, no contexto do volume da derivacao do consultor, nao como
linhas lidas de uma carga. A spec de 05/09 promoveu o exemplo a fato medido. **Erro
meu, registrado aqui em vez de apagado.**

Consequencia pratica: onde este documento e os demais dizem `>= 89%`, vale a
comparacao pareada acima. O 89% sobrevive so como **alvo declarado do dono**, nunca
como baseline medida.

**O denominador continua tendo que aparecer na tela**, com ou sem portao novo:

```
casaram 612 de 690 linhas (89%)
+ 25 linhas descartadas por regra (nao entram na conta)
```

Cobertura sem denominador visivel mente por omissao, igual a aba Conteudo que
mostrava 3 de 8 sem declarar a janela (v33). A conta em vigor no parser e
`casou / lidas`, com `lidas` **excluindo** as descartadas por regra ativa: descarte
e decisao de negocio do dono, nao falha de leitura.

### 2.7 Degradacao: o produto cai em degrau, nunca de vez

| Situacao | O que a tela faz |
|---|---|
| Cota do mes estourada | parse deterministico continua; a pilha nao reconhecida fica pendente e a tela diz o numero exato |
| Custo com mais de 7 dias | carga entra com aviso explicito de custo velho, nunca em silencio |
| `config.validade` vencida | banner vermelho e as quatro funcoes de copiar pedido travam (comportamento atual, mantido) |
| Catalogo do tenant vazio | a calc mostra estado vazio nomeado, nunca tela em branco |
| Leitura do blob falha | barra vermelha de `validarDados()`, comportamento atual, mantido |

---

## 3. Modelo de dados

Tabelas novas e o que muda nas existentes. Toda tabela de dado segue o invariante 7
(`tenant_id` mais policy que o usa); as globais sao a excecao declarada abaixo.

| Tabela | `tenant_id` | Papel |
|---|---|---|
| `calc_modelo` | tenant (+ linhas de semente) | nome canonico, categoria, ativo. Chave e o `codigo` (inv. 12) |
| `calc_cor` | tenant (+ semente) | nome canonico e hex |
| `calc_alias` | tenant (+ semente) | texto que aparece na lista -> codigo canonico. **A tabela do aprendizado** |
| `calc_regra` | tenant (+ semente) | descarte, token malformado, trava de outlier |
| `calc_fornecedor` | tenant, **sem semente** | nome, praca, ativo. Nunca sai do tenant |
| `calc_carga` | tenant | uma importacao: `rascunho`/`aprovada`/`descartada`, blob proposto, contadores, quem aprovou. Append-only |
| `calc_pendencia` | tenant | causa, linhas afetadas, decisao |
| `calc_uso` | tenant | metering de linha enviada ao modelo, por mes |
| `calc_venda` | tenant | blob de venda derivado. **Substitui `dados.js`** |
| `calc_dados` | tenant | **existe.** Ganha FK para `tenant` e unique por tenant |
| `tenant` | — | **existe.** Ganha `plano`, `status`, `trial_ate` |

**As linhas de semente (`tenant_id is null`) sao invisiveis em tempo de execucao.**
A policy de SELECT das cinco tabelas de catalogo filtra por
`tenant_id = privado.fn_tenant_atual()` e **nao** faz `or tenant_id is null`. Elas
existem so para `fn_provisionar_tenant` copiar no nascimento da conta, e essa funcao
vive em `privado` (invariante 8), fora do alcance do PostgREST.

Isso nao e detalhe de implementacao: se a semente fosse legivel em execucao, o
catalogo dela viraria de fato um servico compartilhado, e o dono do produto
herdaria por acidente a obrigacao de mante-lo, que e exatamente o que ele recusou
em 07/09/2026.

Escrita nessas tabelas: nenhuma policy para `authenticated`. Semente entra por
migration; catalogo do tenant entra por RPC, resolvendo pendencia.

### 3.1 Caminho de escrita

Continua **sem policy de INSERT/UPDATE** em nenhuma dessas tabelas. Escrita por RPC
`SECURITY DEFINER`, e a regra que sustenta o isolamento e uma so:

> **O `tenant_id` vem sempre de `privado.fn_tenant_atual()` dentro da funcao, nunca do
> payload do cliente.**

Medido nesta sessao, e e um ponto forte que ja existe: `fn_tenant_atual()` e
`fn_papel_atual()` filtram por `ativo`. Marcar `ativo=false` corta o acesso na query
seguinte, sem precisar revogar token nem esperar o JWT vencer.

RPCs novas:

| RPC | Faz |
|---|---|
| `calc_carga_abrir(p_texto)` | cria a carga em rascunho, roda o parse, devolve pilhas e pendencias |
| `calc_pendencia_resolver(p_carga, p_pendencia, p_decisao)` | grava a decisao **e** o alias/regra no catalogo do tenant |
| `calc_carga_aprovar(p_carga)` | valida, grava `calc_dados`, deriva `calc_venda`, fecha a carga. Transacional |
| `calc_equipe_convidar(p_email, p_papel)` | cria acesso no tenant de quem chamou |
| `calc_equipe_desligar(p_uid)` | `ativo=false` |

`calc_carga_aprovar` carrega a mesma trava de tres numeros que a skill ja usa hoje em
bloco `DO`: produtos, precos e soma esperados saem do parse ANTES da escrita, e a
transacao inteira volta se algum nao bater.

### 3.2 `config`: as margens, agora com `Acessório` proprio

Por D4, a categoria `Acessório` deixa de cair no `else` de `mg()` e ganha as duas
chaves proprias. `config` do blob de custo passa a ser:

| Chave | Valor em 17/08/2026 | Categoria |
|---|---|---|
| `iav` / `ipc` | 550 / 650 | iPhone, iPad, **Apple Watch** |
| `mav` / `mpc` | 1200 / 1300 | MacBook e Mac Mini |
| **`aav` / `apc`** | **a definir pelo dono** | **`Acessório`** |
| — | sem margem | `1ª Linha`, `Garmin`, `Moto Elétrica` |

`d` (300), `s300` e `scusto` seguem como estao. **As margens continuam vivendo no
`config`, nunca no codigo** (regra 5 da secao 4).

Efeito medido que motivou D4: com `Acessório` caindo no `else`, um AirPods Pro de
custo R$1.500 aparece com venda de R$2.050, porque leva a margem de iPhone. Era
pendencia aberta desde 15/08/2026.

`mg()` em `public/calc/index.html` passa a ter quatro ramos, nao tres:
`semMargem(c)` -> `{av:0,pc:0}`; `MacBook`/`Mac Mini` -> `mav`/`mpc`; `Acessório` ->
`aav`/`apc`; o resto -> `iav`/`ipc`.

**Correcao registrada:** `Apple Watch` **nao** e `Acessório`. E categoria propria, ja
recebe `iav`/`ipc` e ja aparece no consultor. D4 nao muda nada para ela.

---

## 4. Regras invioláveis do produto

As travas da skill `calculadoras` sobem de procedimento operacional para regra de
sistema, e passam a ser asseridas por prova, nao por disciplina de quem opera:

1. **Linha nao entendida nunca vira preco.** Duvidoso e nao reconhecido nao entram no
   blob, em nenhuma circunstancia.
2. **Nada e gravado sem diff aprovado por gente.** Nao existe carga automatica.
3. **Variacao acima de 15% e mostrada item a item**, nunca agregada.
4. **Fornecedor sem lista nova nao e apagado nem apresentado como atual.**
5. **Margem, comissao e taxa saem do `config`**, nunca de numero fixo no codigo.
6. **Validade do consultor e reposta em toda carga aprovada.**
7. **Ordem: custo primeiro, venda depois**, na mesma transacao. Invertido gera
   divergencia entre o que o dono ve e o que o consultor cota.
8. **Descarte acontece ANTES do calculo de menor custo.** Aparelho com aviso de peca
   nao genuina e produto paralelo saem antes, senao o item barato que a loja nao vende
   puxa o preco de venda para baixo.
9. **Cobertura se declara medida, nunca estimada**, e SEMPRE com o denominador na
   tela: `casaram X de Y linhas (Z%)`, mais a linha das descartadas. O par
   `612 de 690` e **exemplo de formato, nao medicao** (ver 2.6b).
10. **`tenant_id` vem da sessao, nunca do payload.**
11. **A calculadora tem que poder sair inteira depois.** Por D2 o produto e vendido
    como conjunto agora, mas a calc vira produto separado no futuro. Entao: **nenhuma
    tabela `calc_*` ganha FK para tabela de operacao** (`lead`, `venda`, `conteudo`,
    `captacao`, `dia_*`, `escopo_*`, `fin_*`). As unicas dependencias permitidas sao
    `tenant`, `app_usuario` e os helpers de `privado`, que sao a base de auth
    compartilhada e viajam junto num eventual desmembramento.

    Acoplamento que ja existe e fica registrado, na direcao certa: `public/app.js`
    (linhas 1151 e 1164) le `calc_dados` para a busca de produto e a tabela de
    parcelamento da aba Vendas. O painel depende da calc, **nao o contrario**. Separar
    a calc depois custa a busca de produto do painel, e nada mais.

12. **`Acessório` entra na derivacao do consultor** (D4), com `aav`/`apc`. As classes
    sem margem (`1ª Linha`, `Garmin`, `Moto Elétrica`) continuam fora.

---

## 5. O que muda para cada pessoa

### 5.1 O lojista dono (cliente novo)

Dia 1, sozinho, cerca de 15 minutos: assina, cola o chat, nomeia os fornecedores dele,
responde cerca de 12 pendencias agrupadas, aprova. Calc no ar.

Depois, cerca de 3 minutos por carga: cola, confere o diff, aprova.

Ele **tem** que colar o proprio chat e nomear os proprios fornecedores. Sem isso a
calc dele nasce vazia. O sistema e a maquina, o dado e dele.

### 5.2 O vendedor do cliente

Login proprio. Ve preco de venda e comissao. **Nao ve custo, fornecedor nem margem**,
e isso passa a ser garantido no backend, nao escondido no navegador.

Time completo incluso no plano, sem cobranca por assento (decisao do dono). O dono do
cliente convida e desliga pela propria tela.

### 5.3 O dono do produto (Vini)

Trabalho recorrente por cliente: **nenhum**. Trabalho recorrente total: **nenhum
tambem** — decisao dele em 07/09/2026, *"nao assumi atualizar nenhum catalogo base.
quem vai atualizar e o cliente."* Lancamento da Apple entra em cada tenant pelo laco
de pendencia (2.4), sem ninguem publicar nada.

O que sobra para ele: manter o **sistema** de pe (banco, deploy, cota de modelo,
correcao de defeito) e a semente do dia 1, escrita uma vez.

O limite real de escala nao e token nem banco, e **suporte no dia 1**. Metrica de
parada declarada: se mais de 1 em cada 5 clientes precisar falar com o dono do produto
para concluir a primeira carga, para de vender e conserta o wizard. Com a decisao de
07/09 esse numero fica **mais** critico, nao menos: sem catalogo mantido por ele, o
wizard e a unica coisa entre o cliente e a desistencia.

---

## 6. Fora de escopo, declarado

- **Manutencao continua de catalogo pelo dono do produto.** Recusada por ele em
  07/09/2026. Existe semente, escrita uma vez por migration, e nada alem disso.
- **Tela para editar a semente.** Ela muda tao raro que migration basta.
- **Normalizacao de preco em tabela relacional.** O blob fica (secao 2.5).
- **Preco por faixa de bateria.** O array `bateria` do blob segue vazio; e feature de
  modelo de dados e de tela, adiada pelo dono em 27/07/2026.
- **Papel novo no CHECK de `app_usuario`.** So `dono` e `vendedor`.
- **Escrita de volta no Notion** e qualquer coisa da linha de conteudo.
- **Cobranca automatica.** Entra no ultimo bloco do plano, depois do piloto.
- **App de celular.** A tela e responsiva, medida nas cinco larguras da suite.

---

## 7. Riscos aceitos conscientemente

1. **Superficie de SaaS antes do primeiro pagamento** (invariante 17). Decisao
   explicita do dono nesta sessao.
2. **Sem catalogo mantido, o fosso e fraco e o churn e barato.** Decisao do dono em
   07/09/2026. Consequencias aceitas: nao ha aprendizado compartilhado (duzentos
   clientes ensinam `PURPLE -> Lilás` duzentas vezes), a cobranca recorrente se
   sustenta no sistema rodando e nao em catalogo atualizado, e cada cliente carrega
   sozinho a curva de 46% para 89% de cobertura. O ganho que fica de pe e so o dia 1,
   pela semente.
3. **Churn com a tabela na mao.** Depois de tres cargas o cliente tem catalogo proprio
   e pode sair levando a tabela. A defesa natural e o custo envelhecer em uma semana;
   trava contratual e decisao comercial, nao tecnica.
4. **Um plano Supabase para todos.** O uso dos clientes conta no limite do dono.
5. **O backup diario passa a conter dado comercial de terceiros.** `backup_git.yml`
   grava dump criptografado de tudo. Exige termo de controlador e operador antes do
   primeiro cliente real.
6. **Export bruto de WhatsApp e dado de terceiro.** Nunca entra no repo. O corpus de
   teste do parser tambem nao: ele vive em `privado`, ou e sintetico.

---

## 8. Criterio de aceite do desenho inteiro

O desenho esta cumprido quando, com o dono do produto sem tocar em nada:

1. Uma conta nova nasce, **recebe a semente copiada para o proprio tenant** e importa
   a primeira lista **sem uma linha de SQL**.
1b. Com o JWT desse cliente, `select count(*) from public.calc_modelo where
   tenant_id is null` devolve **0**: semente nao vaza para execucao.
2. A carga do dono da Pitstop Imports roda **sem sessao de Claude Code**, com cobertura
   igual ou maior que a do caminho atual da skill **na mesma entrada** (D7, secao 2.6b).
3. `curl` sem sessao em qualquer URL de preco devolve **nada**.
4. Um `vendedor` logado ve preco de venda e **zero** custo, provado no banco com o JWT
   dele, nao no navegador.
5. Dois tenants com listas diferentes nao se enxergam, provado com `set local role
   authenticated` e `request.jwt.claims` de cada um.
