# Aprendizado de fornecedor — a calculadora entende e memoriza cada lista nova

Spec de record. Escrita em 10/09/2026, a pedido do dono, com a ordem que a
originou citada exata:

> *"desenhe para a calculadora, entender e memorizar, cada novo fornecedor
> enviado. nao darei auxilio de atualizacao de lista de forn para clientes."*

Complementa `2026-09-05-calculadora-produto-design.md`. Onde divergir, **esta
ganha para o tema aprendizado**, porque e posterior e foi medida contra o banco
vivo.

Nota de linguagem: prosa sem acento, sem cedilha, sem travessao. Valores reais do
sistema aparecem exatos.

---

## 1. O requisito, em uma frase

**A segunda lista do mesmo fornecedor pergunta menos que a primeira, e a terceira
quase nao pergunta.** Sem voce no meio, nunca, nem na primeira.

Isso e a promessa comercial do produto, nao um detalhe de implementacao. Se o
cliente tem que te ligar para a lista do fornecedor dele entrar, voce vendeu um
servico com sua semana dentro, nao um sistema.

---

## 2. O que JA existe (medido em 10/09/2026, banco `unjzpyexgtbcmjfgcqrx`)

O laco de aprendizado **nao comeca do zero**. Isto aqui esta pronto e funciona:

| Peca | Estado | Prova |
|---|---|---|
| `calc_pendencia_resolver` escreve no catalogo do tenant e **reprocessa a carga na hora** | vivo | corpo da RPC, migration `20260909_calc_carga_rpcs.sql`, secao 2 |
| `calc_alias` com os quatro tipos (`modelo`, `cor`, `condicao`, `fornecedor`) | vivo | check constraint `calc_alias_tipo_ck`; 101 linhas, sendo **21 de fornecedor** |
| `decisao='descartar'` vira regra permanente em `calc_regra` | vivo | mesma RPC |
| `fornecedor_conferir` viajando no `resumo` da carga | na tree, nao commitado | `20260910_calc_carga_abrir_promove_v2.sql` |
| Unicidade que impede apelido duplicado | vivo | `calc_alias_u UNIQUE NULLS NOT DISTINCT (tenant_id, tipo, texto)` |

O comentario que abre a RPC ja diz a intencao certa: *"E o laco de aprendizado, e
o coracao do produto: resolver pendencia ESCREVE no catalogo do tenant. Sem essa
escrita a mesma pendencia volta no mes seguinte e o cliente paga a mesma curva
para sempre."*

**O desenho estava certo. Ele so nao vai longe o bastante para um cliente sem
suporte.**

---

## 3. Os tres buracos, medidos

### 3.1 `apontar` so aponta para o que JA EXISTE — e falha em silencio

O fluxo e: apelido resolve para `codigo`, e o parser faz join em
`public.calc_modelo` / `public.calc_fornecedor` por aquele `codigo`.

Medido: **`calc_alias.aponta` nao tem FK, nao tem check, e a RPC nao valida
nada.** As unicas constraints da tabela sao `tipo`, `tenant_id` e a unique de
texto.

Consequencia, e ela e a mais cara desta spec:

```
cliente ve   "TABELA XPTO IMPORTS"  -> aponta -> "xpto_imports"
grava        alias ok, sem erro
parser       join em calc_fornecedor por 'xpto_imports' -> nao existe -> null
tela         a linha continua fora, e NADA diz por que
```

Ele respondeu a pergunta, o sistema aceitou, e nao aprendeu. Na segunda lista a
mesma pendencia volta. **Classe de falha "preco errado" da tabela do handoff v6:
a cobertura nao cai de forma que denuncie, ninguem e avisado, e o cliente conclui
que o produto nao funciona.** Ele nao vai abrir um chamado bem escrito: vai parar
de usar.

Para o SEU tenant isso nunca apareceu porque seu catalogo ja tem os 17
fornecedores e os 125 modelos. **O buraco so existe para quem tem fornecedor que
voce nao tem, ou seja, exatamente todo cliente.**

### 3.2 O que se aprende hoje e VOCABULARIO, nunca FORMA

Apelido ensina *"esta palavra significa aquele codigo"*. Nao ensina *"este
fornecedor escreve em bloco, com a cor antes do preco, e sempre CPO"*.

Resultado: o mesmo fornecedor, com o mesmo layout de sempre, e redescoberto do
zero em toda carga. O trabalho de deduzir a forma e refeito todo mes, e quando o
deducao erra (foi o defeito da cor pareada, consertado em 10/09) ninguem tem
contra o que comparar.

### 3.3 Nao existe caminho de escrita de catalogo

Medido: **0 policies de INSERT ou UPDATE em qualquer tabela `calc_*`** (so
SELECT, por desenho: escrita e por RPC) e **0 RPCs de catalogo**. As cinco RPCs
publicas sao `calc_carga_abrir`, `calc_carga_aprovar`, `calc_carga_descartar`,
`calc_pendencia_resolver` e `calc_config_margem_salvar`.

O painel `Catalogo` do Bloco 1 e somente leitura. Nao ha como nascer fornecedor,
modelo ou cor sem migration, ou seja, **sem voce**.

---

## 4. O desenho

### 4.1 Tres verbos, nao um

Hoje `p_decisao` aceita `apontar`, `descartar`, `ignorar`. Falta o verbo que
cria. Os tres que importam:

| Verbo | Significado | Existe? |
|---|---|---|
| `apontar` | isso e outro nome de uma coisa que ja esta no catalogo | sim |
| `criar` | isso e coisa nova, entra no catalogo do tenant | sim, desde 11/09/2026 |
| `descartar` | isso nunca e preco, nem agora nem depois | sim |
| `definir` | a condicao destas linhas, NESTA lista (so pergunta de `condicao`) | sim, desde 11/09/2026 |

`definir` entrou em 11/09/2026 (D14) e e diferente dos outros tres: **nao escreve
no catalogo**. A resposta fica na propria pendencia, vale para aquela carga, pode
ser trocada e desfeita (`ignorar`), e a lista seguinte pergunta de novo, com ela
como sugestao. `descartar` em pergunta de condicao e recusado (trava T4), e
`descartar` em pergunta de fornecedor tira o bloco inteiro dele de toda lista
futura, por decisao do dono (D16 do plano).

**RPC nova: `calc_catalogo_criar(p_pendencia uuid, p_nome text, p_extra jsonb)`**,
`SECURITY DEFINER`, papel `dono`, `tenant_id` de `privado.fn_tenant_atual()`
(restricao global 1). O `tipo` vem da propria pendencia, nunca do payload. Ela
faz, numa transacao so:

1. cria a linha em `calc_fornecedor` / `calc_modelo` / `calc_cor`;
2. cria o `calc_alias` da grafia original que gerou a pendencia;
3. cria alias para **todas as outras grafias do mesmo texto vistas nesta carga**,
   nao so a que ele clicou;
4. reprocessa a carga, igual o `apontar` ja faz.

O `codigo` sai de hash deterministico do nome normalizado (`privado.calc_norm`),
com sufixo numerico em colisao. **Nunca do rotulo que o fornecedor escreveu**
(invariante 12): rotulo e display e muda; codigo e chave e nao muda.

**Construido em 11/09/2026** (`20260911_calc_catalogo_criar.sql`, version
`20260911135930`). Tres correcoes que a execucao impos a esta secao, e o texto
acima fica como estava so para o leitor ver o que mudou:

1. **A releitura nao virou copia.** O item 4 acima ("reprocessa, igual o `apontar`
   ja faz") era, na letra, duplicar as ~90 linhas de cauda do
   `calc_pendencia_resolver`. Duas copias daquele bloco bastaria UMA divergir para
   a cobertura passar a depender do VERBO usado, sem aparecer em contagem nenhuma.
   Saiu para `privado.calc_reprocessar`, UMA copia, chamada pelos dois. E a mesma
   licao da `cond_chave` (7b item 3): o que se le em dois lugares vira uma coluna
   so, o que se executa em dois lugares vira uma funcao so.
2. **O `codigo` nao e hash, e slug.** O catalogo vivo usa slug legivel
   (`mp_imports`, `airpods_4_anc`). Hash faria metade dele ilegivel, e o `codigo`
   e o que aparece em apelido e em pendencia. Slug de `calc_norm(nome)` com sufixo
   numerico em colisao: continua deterministico, continua sendo o codigo.
3. **O item 3 ("alias para todas as outras grafias vistas nesta carga") ficou mais
   estreito, de proposito:** so as grafias que normalizam para o MESMO texto
   (`privado.calc_norm` igual). "Todas as grafias" sem um teste de igualdade seria
   exatamente a uniao automatica que a 4.3 abaixo proibe. Medido na fixture E:
   `XPTO CELL IMPORTS`, `*Xpto  Cell  Imports*` e `xpto cell imports` sao tres
   pendencias e um clique so, porque as tres sao a mesma coisa PROVADA. Grafia
   parecida mas nao igual continua sendo pergunta, e e a 4.3 que a atende.

**E `cor` nao se cria.** Medido em 11/09/2026: o leitor **nunca** devolve pendencia
de `tipo = 'cor'`. Cor que ele nao conhece cai em `duvidoso` junto com a linha, sem
virar pergunta, entao `criar` cor nao teria de onde ser chamado. Criar o ramo assim
mesmo seria codigo sem consumidor e sem prova, que e o que este projeto ja paga com
o parser v1. A RPC recusa com motivo, e o ramo entra no dia em que o leitor aprender
a perguntar cor, junto com a prova dele. `condicao` tambem recusa, por outro motivo:
a resposta dela vale so para aquela lista (D14, verbo `definir`).

### 4.2 O orcamento de perguntas, e por que ele e o produto

Cada campo obrigatorio a mais e uma chance de o cliente travar e te ligar. Entao
o desenho fixa o minimo, e o resto se deriva:

| Tipo | Ele responde | O sistema deriva sozinho |
|---|---|---|
| `fornecedor` | nome e praca | codigo, todas as grafias vistas, o perfil de dialeto |
| `modelo` | **so a categoria**, num dropdown fechado | codigo, nome, capacidade, o alias da grafia |
| `cor` | ~~nada~~ **nao se cria** (11/09/2026): o leitor nunca pergunta cor | — |
| `condicao` | qual das conhecidas, **para esta lista** (`definir`) | nada: nao vira alias nem padrao (D14, 7b item 3) |

**Uma unica pergunta obrigatoria com dropdown em todo o fluxo: a categoria do
modelo.** Ela fica porque decide margem, e margem errada e dinheiro errado. Toda
as outras se deduzem.

### 4.3 A guarda de quase-igual: nunca unir fornecedor sozinho

Antes de criar fornecedor, buscar os existentes por similaridade sobre
`privado.calc_norm`. Achou parecido acima do limiar, **nao cria e nao une**:
devolve a pergunta com as duas grafias lado a lado.

```
Voce ja tem        MP
A lista traz       MP IMPORTS
                   [ e o mesmo ]   [ e outro fornecedor ]
```

Esta regra nao e teorica: e a memoria `fornecedores-mesma-pessoa`, do proprio
dono, e a memoria `contas-secundarias-caique` mostra o custo do lado oposto
(duas grafias que eram a mesma pessoa mudaram um desequilibrio de 30,7% para
6,2%). Unir sozinho mistura o custo de duas pessoas diferentes; nao perguntar
nunca duplica fornecedor ate o catalogo virar lixo. **O certo e perguntar uma
vez e memorizar a resposta para sempre.**

**Construida em 11/09/2026, na MESMA migration do `criar`**, e nao depois como o
custo da secao 6 previa. Motivo: enquanto a 2.4c (desfazer) nao existir, criar
fornecedor e escrita sem volta, e soltar o verbo sem esta guarda seria entregar um
botao irreversivel desprotegido.

`privado.calc_nucleo(text)` tira o enfeite comercial do nome (`TABELA`, `IMPORTS`,
`DISTRIBUIDORA`, `ATACADO`, `CELL`, `STORE`, `LOJA`, `REVENDA`, e as preposicoes) e
ordena o que sobra. `TABELA MP DISTRIBUIDORA` e `MP Imports` caem os dois em `mp`.
Nucleo igual: **nao cria e nao une**, recusa citando as duas grafias e dizendo os
dois caminhos (`apontar` para o codigo dela, ou repetir com
`{"confirmar_novo":"sim"}`). Assercoes K2 e K3.

**Nao e medida de distancia, e igualdade sobre o que sobra**, e a escolha foi
consciente: `pg_trgm` nao esta instalado neste banco (medido), e uma regra que se
explica ao dono em uma frase e melhor do que um limiar que ninguem sabe calibrar.
O preco, declarado: falso positivo custa UMA pergunta a mais; falso negativo (erro
de digitacao, `MP Improts`) nao e pego e vira fornecedor duplicado. Os dois sao
baratos perto de unir sozinho o custo de duas pessoas diferentes, que e o erro que
nao se desfaz.

### 4.4 A camada nova: o dialeto do fornecedor

Nao precisa de tabela nova. `calc_fornecedor` ganha tres colunas:

```sql
alter table public.calc_fornecedor
  add column if not exists perfil          jsonb   not null default '{}'::jsonb,
  add column if not exists n_listas        integer not null default 0,
  add column if not exists cobertura_media numeric;
```

O `perfil` guarda a FORMA daquele fornecedor, aprendida **so de carga aprovada**,
nunca de rascunho:

```json
{
  "layout": "bloco",
  "cor_pos": "antes",
  "condicao_padrao": "CPO",
  "capacidade_no_nome": true,
  "emoji": true,
  "cabecalho_marcas": ["tabela", "atualizada"],
  "visto_em": "2026-09-10",
  "cobertura": [0.61, 0.88, 0.97]
}
```

O historico por carga ja existe e e append-only em `calc_carga.resumo`: o perfil
e o resumo vivo, nao a memoria unica.

**A regra que impede o dialeto de virar defeito silencioso, e ela nao se
flexibiliza: o perfil DESEMPATA, nunca DECIDE.** O parser continua generico. O
perfil so serve para duas coisas:

- **desempatar** leitura ambigua (foi exatamente a classe do defeito da cor
  pareada: uma cor entre dois precos empatava e o desempate escolhia errado);
- **acender bandeira** quando a lista nao se parece com as anteriores daquele
  fornecedor.

Se o perfil virasse regra dura, fornecedor que muda de formato passaria a perder
linha calada, que e a pior familia de defeito que este projeto ja mediu.

**Sem excecao (D14 do plano, revisada em 11/09/2026).** Uma primeira resposta do
dono criava a excecao `condicao_padrao`, que decidiria a condicao de linha sem
condicao. Ele revisou na mesma sessao: *"na verdade, pergunte quando nao houver
condição descrita"*. Entao linha sem condicao gera UMA pergunta por fornecedor, por
lista, com a resposta da lista anterior pre-selecionada como SUGESTAO. O perfil
segue so desempatando, sem excecao.

### 4.5 `formato_mudou`: a bandeira que protege o cliente sem suporte

Aceso quando, para um fornecedor com `n_listas >= 2`:

- a cobertura desta lista cai mais de **15 pontos** abaixo da `cobertura_media`
  dele, **ou**
- o `layout` ou o `cor_pos` detectado difere do memorizado.

A tela para e diz, com os dois numeros na frente:

```
A lista da MP veio diferente das 3 anteriores.
Casaram 62% das linhas. Nas ultimas tres foram 88%, 94% e 97%.
[ conferir as 41 linhas que ficaram de fora ]
```

Os 15 pontos sao **constante declarada, nao medida**, igual ao numero de token da
5.4 da spec anterior: recalibrar depois da terceira carga real de um cliente, com
o numero medido, e corrigir esta spec na hora.

Sem esta bandeira, o fornecedor que muda de formato degrada a tabela do cliente
em silencio, e o primeiro a saber e o cliente dele, na hora de vender pelo preco
errado.

### 4.6 Tudo o que se aprende carrega origem, e da para desfazer

`calc_alias`, `calc_regra`, `calc_modelo`, `calc_cor` e `calc_fornecedor` ganham:

```sql
add column if not exists origem   text not null default 'manual',  -- semente | aprendizado | manual
add column if not exists carga_id uuid,
add column if not exists criado_por uuid;
```

Motivo: **o laco de aprendizado memoriza tambem o erro.** Uma resposta errada do
cliente vira apelido permanente e se aplica calada em toda lista futura. Sem
origem gravada, achar esse apelido depois exige alguem lendo a tabela, e esse
alguem seria voce, que e exatamente o que esta spec existe para evitar.

Com origem, o desfazer e uma linha e o cliente faz sozinho.

**Construido em 11/09/2026**, tambem na mesma migration, e pelo mesmo raciocinio:
`criar` e a primeira RPC que escreve linha NOVA de catalogo, entao sem proveniencia
a linha com mais chance de estar errada nasce ja invisivel. **15 colunas**, com
check em `origem`. Backfill TOTAL para `semente`: tudo que existia no banco entrou
por migration, nada foi aprendido de carga, porque o verbo que aprende nasceu
agora. Medido depois de aplicar: **zero** linha com `origem <> 'semente'`.
`calc_catalogo_criar` e `calc_pendencia_resolver` carimbam `aprendizado`.

Uma diferenca da DDL acima: **nao ha FK de `carga_id` para `calc_carga`**.
Proveniencia nao pode sumir quando a carga sumir, e `calc_carga.aprovado_por` ja e
uuid solto pelo mesmo motivo.

### 4.7 O palpavel: a aba mostra a curva de aprendizado

O painel `Catalogo` (Bloco 1) ganha a secao **"O que a calculadora aprendeu"**,
newest-first (invariante 6):

```
10/09   fornecedor   "TABELA XPTO IMPORTS"   ->  XPTO Imports (SP)     desfazer
10/09   modelo       "ip 15 pro mx 256"      ->  iPhone 15 Pro Max     desfazer
10/09   descarte     "pagamento so pix"      ->  nunca vira preco      desfazer
```

E, por fornecedor, a curva medida:

```
MP Imports      3 listas     61%  ->  88%  ->  97%
XPTO Imports    1 lista      74%
```

Essa curva e a prova visivel de que o produto aprende. E o que o cliente olha
para confiar, e e o unico argumento de venda desta spec que nao precisa de
palavra: sao numeros medidos dele mesmo.

---

## 5. A consequencia que a ordem "nao darei auxilio" comprou

**O Bloco 5 (o modelo lendo a pilha 3) deixa de ser opcional e sobe na fila.**

Motivo, e e aritmetica, nao opiniao: a primeira carga de um tenant novo tem
**todo fornecedor desconhecido** e uma parte dos modelos fora da semente. Sem o
modelo pre-preenchendo as respostas, o cliente encara dezenas de perguntas cruas
no dia 1. O portao do Bloco 6 ja diz o que acontece entao: *"se mais de 1 em cada
5 clientes precisar falar com o dono do produto para concluir a primeira carga,
parar de vender e consertar o wizard."*

O papel do modelo aqui e estreito e nao muda a 5.2: ele **nao le preco e nao
grava nada**. Ele recebe so a pilha nao reconhecida mais o catalogo, e devolve
proposta **ja na forma dos tres verbos** (`criar` / `apontar` / `descartar`), que
o cliente aprova em bloco, numa tela so. A diferenca entre 40 perguntas e um
botao de aprovar e a diferenca entre produto e servico.

Ordem proposta, corrigindo o plano:

```
Bloco 2 (tela Alimentar)  ->  2.4 Aprendizado (esta spec)  ->  Bloco 5 (modelo e cota)
  ->  Bloco 3 (consultor sai do repo)  ->  Bloco 4 (signup e equipe)  ->  Bloco 6
```

O Bloco 4 desce porque criar UMA conta na mao, no painel do Supabase, custa
minutos; um cliente que nao consegue carregar a propria lista custa o produto.

---

## 6. Custo

| Fatia | O que | Sessoes |
|---|---|---|
| 2.4a | verbo `criar`, guarda de quase-igual, colunas de origem | 1,5 |
| 2.4b | perfil de dialeto e `formato_mudou` | 1 |
| 2.4c | aba "o que aprendeu", curva por fornecedor, desfazer | 1 |
| 5 antecipado | modelo na pilha 3, bootstrap, cota | 2 a 3 |

**+5,5 a 6,5 sessoes** sobre a conta de 10/09 (que era 5,5 a 7,5 para o amigo
usar). Total realista para entregar a um cliente sem suporte nenhum: **11 a 14
sessoes**.

Nao ha versao barata disso. A versao barata e voce atendendo o telefone.

---

## 7. Provas que a fatia tem que trazer

Prova que nao esta em suite nenhuma nao roda de novo. Estas entram em
`ferramentas/prova_calc_parse.sql` ou em arquivo irmao:

1. **Apelido apontando para codigo inexistente REPROVA.** Hoje passa calado. Vira
   `raise exception` na RPC e assercao na prova. E o buraco 3.1, e e o primeiro a
   fechar.
2. Fixture com o mesmo fornecedor em **tres grafias** na mesma lista: cria **um**
   fornecedor e **tres** aliases.
3. Fixture de quase-igual: `MP` cadastrado e `MP IMPORTS` na lista **nao cria
   sozinho** e devolve a pergunta.
4. Fixture do mesmo fornecedor com layout trocado entre duas cargas:
   `formato_mudou` verdadeiro, e a cobertura das duas medida.
5. Segunda carga do mesmo fornecedor com o catalogo ja ensinado: **numero de
   pendencias estritamente menor** que o da primeira. E a assercao que prova a
   frase da secao 1, e sem ela a promessa do produto nao tem medicao.
6. Restricao global 10 conferida de novo: `calc_*` sem FK para tabela de
   operacao. As colunas novas nao criam nenhuma.

**Placar em 11/09/2026**, depois do `2.4a`: a 1 fechou na 2.4a bis (handoff v9); a
2 e a 3 fecharam agora (assercoes K1, K2 e K3 de `ferramentas/prova_calc_parse.sql`);
a 6 foi conferida e as colunas novas de fato nao criaram FK nenhuma. **Faltam a 4
(depende da 2.4b) e a 5**, que e a mais importante das seis: ela e o portao do 2.4
e a unica que poe numero na promessa de que o produto aprende. Sem ela, "a segunda
lista pergunta menos" e frase, nao medicao.

---

## 7b. O que a execucao contradisse (11/09/2026)

A RPC `calc_pendencia_resolver` foi CHAMADA pela primeira vez em 11/09 (ate ali
so tinha sido provada na estrutura), com as duas fixtures da prova mais uma
terceira, 21 combinacoes de pendencia x decisao, tudo desfeito no fim. Tres
afirmacoes desta spec nao se sustentam, e uma quarta ficou pequena:

1. **O buraco 3.1 e maior do que a secao 3.1 descreve.** Ela diz que o apelido
   para codigo inexistente deixa a linha "fora, e NADA diz por que". Medido: a
   linha SOME DE TODAS AS PILHAS. `lidas=3 casou=1 nao_reconhecido=2
   pendencias=2` virou `lidas=3 casou=1 nao_reconhecido=0 pendencias=0`: a carga
   fica sem pendencia, pronta para aprovar, com dois produtos a menos.
2. **Nao e um buraco, e uma classe.** Das 21 combinacoes, 4 ensinavam e as
   outras eram aceitas, gravavam no catalogo e nao mudavam a leitura. Por isso a
   2.4a bis entrou como TRES guardas gerais (destino existe; conservacao de
   linhas; a resposta tem que ensinar), e nao como a guarda unica da prova 1.
   Detalhe e tabela: `supabase/migrations/20260911_calc_resolver_nada_calado.sql`.
3. **Condicao NAO se ensina por apelido** (tabela da 4.2, linha `condicao`). O
   leitor, v1 e v2, le condicao so de `calc_regra`; nenhum dos dois consulta
   `calc_alias` com tipo `condicao`. Os 9 apelidos de condicao do tenant sao dado
   morto. E a pendencia de condicao tem sempre o texto-sentinela
   `sem condicao declarada`, que nao e grafia da lista. O caminho que resolve
   linha sem condicao e outro (candidato natural: condicao padrao por
   fornecedor, que e `perfil.condicao_padrao` da 4.4) e **conflita com a regra
   "o perfil desempata, nunca decide"**: preencher condicao que a linha nao diz
   e decidir. **Decidido pelo dono em 11/09/2026, D14 do plano, REVISADA na mesma
   sessao:** pergunta uma vez por fornecedor, por lista, com a resposta anterior
   pre-selecionada como sugestao. A regra da 4.4 fica sem excecao.
   **Construido em 11/09/2026** (`20260911_calc_parse_respostas_de_condicao.sql`):
   o verbo `definir` (4.1), e o leitor recebendo o mapa `texto -> condicao` da
   carga. O resolver passa TODAS as respostas da carga a cada releitura, de
   qualquer resposta: passar so a do momento devolveria para duvidoso, calada,
   cada linha ja respondida.
4. **O verbo `criar` fornecedor nao tem onde se apoiar hoje.** Cabecalho de
   fornecedor desconhecido no TOPO da lista (sem fornecedor anterior) vira a
   sentinela `(sem cabecalho antes da lista)`: o texto `TABELA XPTO IMPORTS` nem
   chega a pendencia nem a `cabecalhos`. No dia 1 de um cliente TODO fornecedor e
   desconhecido, entao toda lista cai numa pendencia so, que nao nomeia ninguem.
   **Antes de `calc_catalogo_criar`, o leitor tem que carregar o texto do
   cabecalho candidato ate a pendencia.** Isso e trabalho de parser (territorio
   da D10 e da D13: `Irajá` e bairro, `Cristiano` e loja), e e o bloqueador real
   da 2.4a.

Duas limitacoes menores, medidas e nao consertadas: cor decorada
(`verde menta`) nao aprende por apelido, e `descartar` de pendencia de CABECALHO
de modelo nao pega a linha do preco (a regra casa por linha, e a linha do preco
nao repete o nome). Com as guardas, as duas passam a ser RECUSADAS com motivo em
vez de aceitas caladas.

5. **A cor nem chega a ser pergunta** (medido em 11/09/2026, ao construir o
   `criar`). A limitacao acima diz que cor decorada "nao aprende por apelido"; e
   mais fundo do que isso: o leitor **nunca** devolve pendencia de `tipo = 'cor'`.
   Cor desconhecida cai em `duvidoso` junto com a linha inteira, sem nomear a cor.
   Entao a linha da 4.2 que dizia "`cor`: ele responde nada, o sistema deriva hex
   aproximado" descrevia um fluxo que nao existe. `calc_catalogo_criar` recusa
   `cor` com motivo, em vez de carregar um ramo sem chamador e sem prova. Quando o
   leitor aprender a perguntar cor, o ramo e a prova dele entram juntos.

6. **O custo da secao 6 subestimou a costura, nao o codigo.** A 2.4a, a `ter` e a
   `quater` estavam orcadas como 1,5 sessao em tres passos; sairam juntas, numa
   migration so, porque as duas ultimas sao o que torna a primeira segura: sem
   quase-igual, `criar` fornecedor e botao irreversivel sem guarda; sem `origem`, o
   que ele grava no catalogo do cliente ninguem acha depois. Fatiar mais fino aqui
   teria entregue, entre uma fatia e outra, um estado pior do que nao ter nada.

---

## 8. O que NAO muda

- Restricao global 1: `tenant_id` sempre de `privado.fn_tenant_atual()`.
- Restricao global 2: nome de fornecedor e praca **nunca** entram na semente. O
  que o cliente cadastra e dele, e os seus 17 nunca vazam para ele.
- Restricao global 8: nenhum export de fornecedor entra no repo, nem as fixtures
  novas, que seguem sinteticas.
- 5.2: proposta do modelo nunca vira preco sozinha.
- Invariante 12: chave e o `codigo`, nunca o `rotulo`.
- Invariante 6: o que se aprende e append-only, com origem e newest-first.
