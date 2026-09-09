# Handoff — Calculadora como produto, v3

Data: 09/09/2026. Linha `calculadora`. Este e o topo dela, e substitui o v2.

Escrito para uma sessao de terminal continuar do zero, sem contexto anterior.
Tudo abaixo foi **medido nesta sessao**, nao herdado de documento.

Nota de linguagem: prosa sem acento, sem cedilha, sem travessao (convencao do
`CLAUDE.md`). Valores reais do sistema aparecem exatos.

---

## 0. Leia nesta ordem, antes de tocar em qualquer coisa

1. `CLAUDE.md` (arranque de toda sessao).
2. **`docs/calculadora/PROCESSO.md`** — o guia de PROCESSO desta linha.
3. `docs/runbook-operacao.md` — sessoes concorrentes, remote real, EXIT CODE.
4. `docs/superpowers/specs/2026-09-05-calculadora-produto-design.md` — o desenho.
   Se o plano divergir dele, **a spec ganha** e voce avisa.
5. `docs/superpowers/plans/2026-09-05-calculadora-produto.md` — o plano. Os Blocos
   0 e 1 tem secao `FECHADO`; o Bloco 2 tem `FATIA 1 ENTREGUE` e segue **ABERTO**.
6. So entao a skill `calculadoras` e os 4 `references/` dela.

---

## 1. Onde a obra esta, em uma frase

**O Bloco 2 esta pela METADE, de proposito.** O 2.1 (schema de carga) e o 2.2
(parser e RPCs) estao no ar e provados; a tela `/calc/alimentar` (2.3) **nao foi
comecada**. Enquanto ela nao existir, o dono **ainda nao consegue** atualizar
preco sem sessao de IA, que e o ponto do bloco inteiro.

O corte em duas fatias foi decisao do dono nesta sessao, contra a alternativa de
emendar tudo: o parser e conferido antes de ser embrulhado em wizard, porque o
defeito de CPO de 27/07/2026 ficou sete dias no ar por ninguem olhar a pilha
intermediaria, so o resultado final.

---

## 2. Decisoes do dono (nao perguntar de novo)

D1 a D5 seguem como no v2 (ver secao 2 de `handoff_calculadora_pitwall_v2.md`).
Resumo do que mais importa aqui: **quem atualiza o catalogo e o CLIENTE** (D5); a
semente e um retrato copiado no nascimento e **invisivel em execucao**.

### Decisao ABERTA que NAO trava o Bloco 2

**D4a — comissao de `Acessório` na escada do consultor.** Trava so o passo 3.3,
dentro do Bloco 3. **Nao inventar numero: ele paga comissao real ao Brendon.**

### Decisao NOVA, aberta, criada nesta sessao

**D6 — `calc_carga.texto_bruto`.** A coluna guarda a lista colada **enquanto a
carga esta em rascunho**, e e apagada no instante em que a carga e aprovada ou
descartada. So o papel `dono` do proprio tenant enxerga.

Ela existe porque `calc_pendencia_resolver` **precisa reprocessar** a lista contra
o catalogo recem-ensinado. Sem ela, o dono resolve 12 pendencias e nao ve numero
nenhum mudar: o laco de aprendizado so valeria na carga do mes seguinte.

A spec diz que o bruto e descartado (secao 2.3 do plano: "o texto e processado e o
bruto e descartado; se um dia for guardado, bucket privado com retencao
declarada"). A leitura adotada foi a segunda metade da frase. **Foi levado ao dono
com o efeito na mesa e ele ainda nao respondeu.** Se ele vetar, tirar a coluna e o
reprocesso, e o aprendizado passa a valer so da carga seguinte.

---

## 3. FATIA 1 DO BLOCO 2, entregue em 09/09/2026

Commit `77f954c`. Cinco migrations, todas versionadas em
`supabase/migrations/20260909_calc_*.sql` (o SQL vive no repo, nao so no banco).

| Migration | O que |
|---|---|
| `calc_carga_schema` | `calc_carga`, `calc_pendencia`, `calc_uso` |
| `calc_parse_helpers` | 8 funcoes puras em `privado` |
| `calc_parse_motor` | `privado.calc_parse` |
| `calc_carga_rpcs` | as 4 RPCs, `texto_bruto`, check de `calc_uso` |
| `calc_parse_correcoes` | fronteira de palavra nas regras de condicao, preco decimal |

### As tres tabelas

`calc_carga`, `calc_pendencia` e `calc_uso`. **RLS so-SELECT, papel `dono`**: custo
de fornecedor o vendedor nao ve. Nenhuma policy de INSERT/UPDATE/DELETE em lugar
nenhum; a escrita e so por RPC `SECURITY DEFINER`, e la o `tenant_id` vem de
`privado.fn_tenant_atual()`, nunca do payload.

`fk_proibida = 0` (restricao global 10): a calc continua podendo sair inteira.

### As quatro RPCs

| RPC | Faz |
|---|---|
| `calc_carga_abrir(p_texto)` | parse, grava a carga em rascunho e as pendencias |
| `calc_pendencia_resolver(p_pendencia, p_decisao, p_aponta)` | ensina o catalogo **e reprocessa** |
| `calc_carga_aprovar(p_carga)` | trava de tres numeros, grava `calc_dados`, fecha |
| `calc_carga_descartar(p_carga)` | fecha e joga fora a lista bruta |

Todas com `search_path` fixo e `grant execute` so para `authenticated` (`anon` nao
tem). A barreira de papel esta no CORPO (`fn_papel_atual() <> 'dono'` levanta
excecao), nao no GRANT, seguindo o precedente de `registrar_venda` e `remover_nf`.

### O parse, e o que ele ja resolve

Ordem de leitura obrigatoria, implementada: token malformado -> descarte -> preco
-> modelo -> capacidade -> **condicao com CPO antes de Lacrado, por
`calc_regra.prioridade`** -> cor -> **fornecedor pelo CABECALHO, nunca pelo
remetente**.

O casamento de modelo e por **multiconjunto de tokens + capacidade + polegada**.
Multiconjunto e nao conjunto porque `MacBook Pro M5 Pro` tem `pro` duas vezes, e e
so isso que o separa de `MacBook Pro M5`. Pre-checado antes de escrever a funcao:
**124 modelos, 123 assinaturas distintas**; a unica colisao e `MacBook Air M4 13"`
contra `15"` quando a lista omite a polegada, e a regra 4b do `formato-dados.md` ja
decide isso ("Air e 13", a 15" sempre vem escrita).

---

## 4. Os seis defeitos que a execucao achou, e nenhum plano via

**Este e o conteudo mais caro deste handoff.** Todos foram medidos, nao supostos.

### 4.1 `\b` em Postgres e BACKSPACE, nao fronteira de palavra

Fronteira de palavra e **`\y`**. Escrever `\b` nao da erro: o regex simplesmente
nunca casa, e a funcao devolve NULL em silencio.

```
regexp_match('macbook air m4 13   ', '\b(11|13|14|15|16)\b')  ->  NULL
regexp_match('macbook air m4 13   ', '\y(11|13|14|15|16)\y')  ->  13
```

Estava em 8 lugares. Teria dado polegada NULL em todo Mac e capacidade NULL em
todo iPhone, **com a suite verde**.

### 4.2 `novo` casava DENTRO de `seminovo` — o pior dos seis

A regra `lacrado|novo` (prioridade 20) nao tinha fronteira de palavra, entao casava
com o `novo` de semi-**novo**. Como 20 < 30, **Lacrado ganhava de Seminovo em toda
linha de seminovo**, e tambem no banner de bloco (`SEMINOVOS`).

Medido: **5 das 12 linhas que casavam sairam com a condicao errada.** Numa carga
real isso mistura a tabela de seminovo com a de lacrado, e o consultor passa a
cotar seminovo com preco de lacrado.

Estava no catalogo vivo **e na semente**, entao toda conta nova nasceria com ele.

**E a mesma classe do CPO invertido de 27/07/2026** (341 produtos com zero CPO):
regra de condicao sem limite explicito. Aquela foi corrigida com `prioridade`; esta
precisou de fronteira de palavra. Corrigido nas duas camadas.

### 4.3 Cabecalho desconhecido nao quebrava o bloco

Um cabecalho que nao casa com fornecedor nenhum nao interrompia o bloco anterior, e
os precos do fornecedor nao identificado eram gravados **com o nome do fornecedor
anterior**. Preco certo no fornecedor errado passa no validador, passa no diff, e
so aparece quando alguem compra pelo custo de outra loja.

Agora uma linha sem preco faz um de tres papeis: `forn` (abre bloco daquele
fornecedor), `cond` (banner tipo `SEMINOVOS`, nao troca fornecedor) ou `quebra`
(nao casou com nada, abre bloco SEM fornecedor). Pendencia a mais e barata;
atribuicao errada, nao.

### 4.4 Preco com ponto decimal sumia inteiro

A regra de token `4,850,00 -> 4850.00` do proprio catalogo produz **ponto**
decimal. O leitor so conhecia o formato brasileiro (ponto de milhar, virgula
decimal), entao em `4850.00` via `4850` e `00`, pegava o ultimo e reprovava na
faixa de sanidade.

A linha **nao entrava no blob E nao virava pendencia**. Sumia sem rastro.
**Linha que some e pior que linha que erra: ninguem procura o que nao sabe que
faltou.**

### 4.5 Cor decorada entrava com o hex de outra cor

`VERDE MENTA` contem `verde` como palavra inteira, entao a cor desconhecida era
gravada como `Verde` com o hex do Verde, calada, violando o "cor desconhecida vira
pendencia; nunca inventar hex sem avisar".

O sinal deterministico que resolve: nessas listas a cor e sempre seguida da
CONDICAO ou do preco. Se logo depois da cor vem outra PALAVRA que nao e condicao,
a cor verdadeira e o par (`verde menta`, `azul titanio`), e vira pendencia.

### 4.6 Linha sem cor num grupo colorido sumia do blob mas contava como casou

Um produto usa `cs` (com cor) OU `v` (sem cor), nunca os dois, porque e o que
`validarDados()` exige. Num grupo que tem cor, a linha sem cor nao tinha onde
entrar. `n_casou` passa a contar **so o que de fato entra no blob**.

---

## 5. A prova

`ferramentas/prova_calc_parse.sql`. **27 assercoes**, bloco `DO` que termina em
`raise exception` para a transacao voltar inteira: nada e gravado em producao.

```
PASSOU: 27 assercoes, 0 falhas
  medido: lidas=18 casou=11 duvidoso=6 nao_reconhecido=1 descarte=2 cobertura=61.1%
```

Efeito colateral zero conferido: `calc_carga=0, calc_pendencia=0, calc_alias=48`.

**Os 61,1% NAO sao a cobertura do produto e NAO batem o portao do bloco.** A
fixture e um **circuito de armadilhas**: das 18 linhas lidas, **7 foram escritas
para falhar de proposito** (2 de cor decorada, 1 Android com a regra desligada, 2
sob cabecalho desconhecido, 1 de condicao pendurada, 1 outlier). O teto atingivel e
11, e o motor casou **11 de 11**. O portao de 89% so a carga real do dono mede.

A lista e **sintetica, escrita a mao** (restricao global 8: nenhum export de
fornecedor entra no repo, nem como corpus de teste).

### 5.1 A prova reprovou uma vez, e o defeito era DELA

Havia **duas copias da fixture** (uma no scratchpad, outra embutida na prova) e
elas divergiram: a da prova tinha 3 linhas a menos, entre elas justamente a que
uma assercao cobrava. A assercao era insatisfativel por construcao.

E o mesmo erro do `CLAUDE.md` 17 versoes desatualizado, em miniatura: **o mesmo
fato em dois lugares.** Agora ha uma copia so, dentro da prova.

Vale registrar duas coisas que so apareceram por a `bandeira` ter rodado, e nao
quem construiu:
- **quem escreveu o parser escreveu a prova**, entao esse erro de fixture passaria
  batido se a mesma pessoa tivesse rodado e lido o resultado;
- na segunda rodada ela **provou que o criterio nao foi afrouxado** para passar
  (teto ainda `<> 11`, assercao do preco decimal intacta, `v_total` ainda 27), e
  registrou que o `git diff` vazio **nao era evidencia de nada**, porque o arquivo
  estava untracked.

---

## 6. Estado vivo, medido em 09/09/2026

### Banco (projeto `unjzpyexgtbcmjfgcqrx`)

```sql
select
  (select count(*) from public.calc_dados)     as calc_linhas,
  (select count(*) from public.calc_modelo)    as modelos_nas_duas_camadas,
  (select count(*) from public.calc_fornecedor) as fornecedores,
  (select count(*) from public.calc_carga)     as cargas,
  (select count(*) from public.calc_pendencia) as pendencias;
```
Esperado hoje: **1, 248, 17, 0, 0**. Mais 494 produtos e 1007 precos no blob.

Advisors de seguranca: **7 WARN, zero achado novo**. A baseline SUBIU de 3 para 7
nesta sessao, e a subida e consequencia declarada do desenho: as 4 RPCs novas caem
no lint `0029_authenticated_security_definer_function_executable`, exatamente como
`registrar_venda` e `remover_nf` ja caiam. **A partir daqui, "achado novo" quer
dizer alem destes SETE.**

### Frontend

**Nao foi tocado nesta fatia.** `public/calc/` esta igual ao commit `9327c30`. A
suite de onze comandos do `CLAUDE.md` nao foi reexecutada porque nenhum arquivo
que ela mede mudou; ela volta a ser obrigatoria na fatia 2, quando a tela entrar.

### Git

Commit `77f954c`, empurrado. Remote real e **`github`** (`origin` e proxy morto).

---

## 7. Proximo passo: FATIA 2 do Bloco 2, a tela `/calc/alimentar`

**Nao ha bloqueador tecnico.** As 4 RPCs estao no ar e provadas.

Quatro passos, so para papel `dono`:

| Passo | Mostra | Le de |
|---|---|---|
| 1 Colar | area de texto e upload do `_chat.txt` | — |
| 2 Fornecedor | cabecalhos achados, com contagem | `calc_carga.resumo->'cabecalhos'` |
| 3 Pendencias | agrupadas por causa, com `n_linhas` e o exemplo | `calc_pendencia` |
| 4 Diff | subiu / caiu / novo / sumiu, variacao acima de 15% item a item, cobertura | `blob_proposto` contra `calc_dados` |

Textos obrigatorios, porque sao trava do produto e nao enfeite:
- cobertura na forma **`casaram 612 de 690 linhas (89%)`**, medida, nunca estimada;
- **`N linhas nao entraram`**, com a lista, sempre visivel;
- descarte com contagem, para o dono ver que existiram;
- lista com mais de 7 dias entra com **aviso explicito de custo velho**.

Quem constroi e o `vitrine`. **Ele travou no watchdog no Bloco 1** (600s sem
progresso, sem escrever uma linha): uma tentativa; se travar de novo, a Torre
executa e REGISTRA.

Ao tocar `public/calc/`, a suite volta inteira, com **EXIT CODE**:
```
node ferramentas/prova_catalogo.js
for w in 360 390 414; do python ferramentas/diag_calc.py $w; done
```
mais os onze comandos do `CLAUDE.md`. E `calc()` com `+` ou `-` COLADO e defeito
silencioso: sempre `calc(a + b)`, com espaco.

### O portao do bloco continua sendo o mesmo, e ele NAO e tecnico

**O dono roda a carga do mes inteira pela tela, sozinho, sem Claude Code**, com
cobertura medida **>= 89%**. Abaixo disso o seed do Bloco 1 esta incompleto e o
bloco nao fecha. Nenhuma prova de maquina substitui isso.

---

## 8. Divida encontrada nesta sessao e NAO paga

**As tres migrations do Bloco 1 nunca foram versionadas no repo.**
`calc_catalogo_duas_camadas`, `calc_catalogo_semente` e
`calc_catalogo_tenant_pitstop` (08/09/2026) existem so no banco: o handoff v2
declarou o Bloco 1 fechado com o SQL fora do git. Conferido com `git ls-files
supabase/migrations/ | grep calc`, que devolve so `20260721_calc_dados.sql`.

Sao recuperaveis (43 KB no total):

```sql
select name, array_to_string(statements, E';\n') from supabase_migrations.schema_migrations
 where name in ('calc_catalogo_duas_camadas','calc_catalogo_semente','calc_catalogo_tenant_pitstop');
```

Vale fazer antes do Bloco 4 (nascimento de tenant), que le a semente: sem o SQL
versionado, o retrato que toda conta nova herda nao tem fonte no repo.

---

## 9. Comandos de arranque, copiaveis

```
cd "C:\Users\jessi\OneDrive\Documentos\pitswall claude"
git log -3 --format='%h %ad %s' --date=format:'%d/%m %H:%M'
git status --short
git fetch github main && git rev-list --left-right --count github/main...HEAD
```

Tree suja ou commit que voce nao fez = **outra sessao viva nesta pasta**. Ler a
secao 1 do `docs/runbook-operacao.md` antes de qualquer coisa.
